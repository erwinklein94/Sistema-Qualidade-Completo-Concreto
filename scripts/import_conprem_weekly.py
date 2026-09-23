"""Prepare idempotent Conprem imports from the three weekly Excel tabs.

Usage: python scripts/import_conprem_weekly.py workbook.xlsx --out-dir tmp/conprem-sync
The generated SQL is reviewed before being executed against Supabase.
"""

import argparse
from collections import defaultdict
from datetime import date, datetime
import json
from pathlib import Path
import re

import openpyxl
from openpyxl.utils.datetime import from_excel


def clean(value):
    if isinstance(value, (datetime, date)):
        return value.date().isoformat() if isinstance(value, datetime) else value.isoformat()
    if value is None:
        return None
    if isinstance(value, str):
        value = value.strip().replace("\u00a0", " ").strip()
        return value or None
    return value


def number(value):
    value = clean(value)
    if value in (None, "-", "N/A", "N/C"):
        return None
    if isinstance(value, str):
        value = value.replace(",", ".")
    return float(value) if "." in str(value) else int(value)


def integer(value):
    result = number(value)
    return int(result) if result is not None else None


def text(value):
    value = clean(value)
    return str(value) if value is not None else None


def as_date(value):
    value = clean(value)
    if isinstance(value, (int, float)) and 30000 <= value <= 70000:
        return from_excel(value).date().isoformat()
    return text(value)


def week(value):
    match = re.fullmatch(r"(\d{4})-S(\d{1,2})", text(value) or "")
    return (int(match.group(1)), int(match.group(2))) if match else None


def data_rows(workbook, name):
    for line, raw in enumerate(workbook[name].iter_rows(min_row=4, values_only=True), 4):
        row = [clean(value) for value in raw]
        parsed_week = week(row[0])
        if parsed_week and parsed_week[0] == 2026:
            yield line, row, parsed_week


def pick_latest(rows):
    return sorted(rows, key=lambda item: (item[2][1], item[0]))[-1]


def production(workbook):
    groups = defaultdict(list)
    for item in data_rows(workbook, "Conprem-rastreabilidade"):
        line, row, _ = item
        key = (text(row[2]), text(row[4]), text(row[5]))
        if any(value is None for value in key):
            raise ValueError(f"Rastreabilidade linha {line}: chave incompleta")
        groups[key].append(item)
    mapping = {
        "CD-011/26-00": ("MALHA CENTRAL", "Bitola Larga"),
        "CD-012/26-00": ("FERRO NORTE", "Bitola Larga"),
        "CD-012/26-00-1": ("MALHA PAULISTA BITOLA MISTA", "Bitola Mista"),
    }
    cols = ["aco_seq_nf", "aco_cert_interno", "aco_cert_externo", "cimento_seq_nf",
            "cimento_cert_interno", "cimento_cert_externo", "areia_seq_nf",
            "areia_cert_interno", "areia_cert_externo", "brita_seq_nf",
            "brita_cert_interno", "brita_cert_externo", "aditivo_seq_nf",
            "aditivo_cert_externo", "adicao_seq_nf", "adicao_cert_externo",
            "lote_ombreira", "grampo", "isolador_frontal", "isolador_lateral",
            "palmilha_trilho", "palmilha_usp", "observacoes"]
    result = []
    for _, items in sorted(groups.items()):
        line, row, (_, current_week) = pick_latest(items)
        order = text(row[1])
        if order not in mapping:
            raise ValueError(f"Rastreabilidade linha {line}: ordem desconhecida {order}")
        project, gauge = mapping[order]
        record = dict(fornecedor="Conprem MG", projeto=project, bitola=gauge,
                      semana=current_week, ano=2026, ordem_fabricacao=order,
                      pedido=text(row[2]), produto=text(row[3]), lote=text(row[4]),
                      data_fabricacao=as_date(row[5]), total_produzido=integer(row[6]),
                      serie_concreto=text(row[7]),
                      referencias_semanais=[{"linha": source_line, "valores": source_row}
                                            for source_line, source_row, _ in sorted(items)])
        record.update({col: text(row[i]) for i, col in enumerate(cols, 8)})
        result.append(record)
    return result, len(groups)


def assays(workbook, production_rows):
    groups = defaultdict(list)
    for item in data_rows(workbook, "Conprem-Ensaios"):
        line, row, _ = item
        key = (text(row[3]), as_date(row[6]), number(row[7]), number(row[8]), number(row[9]))
        if key[0] is None or key[1] is None:
            raise ValueError(f"Ensaios linha {line}: chave incompleta")
        groups[key].append(item)
    by_lot = {record["lote"]: record for record in production_rows}
    cols = ["med_ext_passa", "med_ext_nao_passa", "med_int_passa", "med_int_nao_passa",
            "inclinacao_1", "inclinacao_2", "torcao_relativa", "altura_ombreira_1",
            "altura_ombreira_2", "posicao_insertos", "montagem_fixacoes", "comprimento_mm",
            "largura_apoio_sup_mm", "largura_apoio_inf_mm", "altura_apoio_mm",
            "largura_centro_sup_mm", "largura_centro_inf_mm", "altura_centro_mm",
            "momento_pos_apoio", "momento_neg_apoio", "momento_pos_centro",
            "momento_neg_centro", "arrancamento_ombreiras", "precarga_usp_kgf",
            "carga_max_usp_kgf", "resultado_usp", "torcao_ombreiras",
            "aderencia_carga_final"]
    numeric_cols = {"torcao_relativa", "comprimento_mm", "largura_apoio_sup_mm",
                    "largura_apoio_inf_mm", "altura_apoio_mm", "largura_centro_sup_mm",
                    "largura_centro_inf_mm", "altura_centro_mm", "precarga_usp_kgf",
                    "carga_max_usp_kgf"}
    result = []
    unresolved = []
    for key, items in sorted(groups.items()):
        # Latest report wins; prefer a real purchase number to a temporary N/C.
        line, row, (_, current_week) = max(items, key=lambda item:
                                           (item[2][1], item[0], text(item[1][2]) != "N/C"))
        purchase = next((text(item[1][2]) for item in sorted(items, reverse=True)
                         if text(item[1][2]) not in (None, "N/C")), None)
        if purchase is None and key[0] in by_lot:
            purchase = by_lot[key[0]]["pedido"]
        if purchase is None:
            unresolved.append((line, key[0]))
            purchase = "N/C"
        result_value = (text(row[42]) or "").lower()
        outcome = "Aprovado" if result_value == "aprovado" else "Reprovado" if result_value == "reprovado" else "Pendente"
        record = dict(fornecedor="Conprem MG", semana=current_week, ano=2026,
                      ordem_fabricacao=text(row[1]), pedido=purchase,
                      projeto=by_lot[key[0]]["projeto"] if key[0] in by_lot else None,
                      bitola=by_lot[key[0]]["bitola"] if key[0] in by_lot else None,
                      lote_ensaiado=key[0], data_fabricacao=as_date(row[4]),
                      turno=text(row[5]), data_ensaio=key[1], pista=key[2],
                      molde=key[3], linha=key[4], resultado=outcome,
                      executor=text(row[39]),
                      relatorio_fotografico=text(row[40]),
                      fiscalizacao=text(row[41]), observacoes=text(row[43]),
                      arquivo_ensaio_dormentes=text(row[43]),
                      arquivo_relatorio_fotografico=text(row[44]),
                      arquivo_termo_liberacao=text(row[45]),
                      arquivo_ensaio_liberacao=text(row[46]),
                      referencias_semanais=[{"linha": source_line, "valores": source_row}
                                            for source_line, source_row, _ in sorted(items)])
        for i, col in enumerate(cols, 10):
            record[col] = number(row[i]) if col in numeric_cols else text(row[i])
        result.append(record)
    return result, unresolved


def summaries(workbook):
    result = []
    for line, row, (_, current_week) in data_rows(workbook, "Conprem-Resumo Semanal"):
        product = text(row[6]) or ""
        purchase = text(row[7]) or ""
        project = ("MALHA CENTRAL" if "TR57" in product else
                   "MALHA PAULISTA BITOLA MISTA" if current_week == 33 else "FERRO NORTE")
        gauge = "Bitola Mista" if current_week == 33 else "Bitola Larga"
        record = dict(fornecedor="Conprem MG", semana=current_week, ano=2026,
                      numero_resumo=text(row[1]), data_emissao=as_date(row[2]),
                      periodo_inicio=as_date(row[3]), periodo_fim=as_date(row[4]),
                      unidade=text(row[5]), produto_material=product,
                      pedido_local=purchase, qtd_fabricada=integer(row[8]),
                      ensaios_realizados=integer(row[9]),
                      refugo_fissuras=integer(row[10]), refugo_vazios=integer(row[11]),
                      refugo_ombreiras=integer(row[12]), refugo_quebras=integer(row[13]),
                      refugo_usp=integer(row[14]), refugo_falhas_fabricacao=integer(row[15]),
                      refugo_outros=integer(row[16]), total_refugos=integer(row[17]),
                      taxa_refugo=number(row[18]), ensaios_por_mil=number(row[19]),
                      planejamento_inicio=as_date(row[20]), planejamento_fim=as_date(row[21]),
                      qtd_planejada=integer(row[22]), observacoes=text(row[23]),
                      lote=f"Semana 2026-S{current_week}", projeto=project, bitola=gauge,
                      motivo_detalhado="Resumo Semanal CONPREM — fechamento da semana")
        if not all(record[key] for key in ("numero_resumo", "periodo_inicio", "pedido_local")):
            raise ValueError(f"Resumo linha {line}: chave incompleta")
        result.append(record)
    return result


def make_sql(table, records, key_sql, column_types):
    columns = list(records[0])
    assert all(set(record) == set(columns) for record in records)
    json_text = json.dumps(records, ensure_ascii=False, separators=(",", ":")).replace("'", "''")
    typed = ", ".join(f"{col} {column_types.get(col, 'text')}" for col in columns)
    updates = ",\n    ".join(f"{col} = coalesce(s.{col}, t.{col})" for col in columns if col != "fornecedor")
    values = ", ".join(f"s.{col}" for col in columns)
    return (f"merge into public.{table} as t\n"
            f"using (select * from jsonb_to_recordset('{json_text}'::jsonb) as x({typed})) as s\n"
            f"on ({key_sql})\nwhen matched then update set\n    {updates}\n"
            f"when not matched then insert ({', '.join(columns)}) values ({values});\n")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("workbook", type=Path)
    parser.add_argument("--out-dir", type=Path, required=True)
    args = parser.parse_args()
    workbook = openpyxl.load_workbook(args.workbook, read_only=True, data_only=True)
    prod, prod_unique = production(workbook)
    assay, unresolved = assays(workbook, prod)
    summary = summaries(workbook)
    if unresolved:
        print("Ensaios sem pedido comprovado:", unresolved)
    args.out_dir.mkdir(parents=True, exist_ok=True)
    common_num = {"semana": "integer", "ano": "integer"}
    prod_types = {**common_num, "total_produzido": "integer", "data_fabricacao": "date"}
    prod_types["referencias_semanais"] = "jsonb"
    assay_types = {**common_num, "data_fabricacao": "date", "data_ensaio": "date",
                   **{key: "numeric" for key in ("pista", "molde", "linha", "torcao_relativa",
                       "comprimento_mm", "largura_apoio_sup_mm", "largura_apoio_inf_mm",
                       "altura_apoio_mm", "largura_centro_sup_mm", "largura_centro_inf_mm",
                       "altura_centro_mm", "precarga_usp_kgf", "carga_max_usp_kgf")},
                   "resultado": "resultado_ensaio", "referencias_semanais": "jsonb"}
    summary_types = {**common_num,
                     **{key: "date" for key in ("data_emissao", "periodo_inicio", "periodo_fim",
                         "planejamento_inicio", "planejamento_fim")},
                     **{key: "integer" for key in ("qtd_fabricada", "ensaios_realizados",
                         "refugo_fissuras", "refugo_vazios", "refugo_ombreiras", "refugo_quebras",
                         "refugo_usp", "refugo_falhas_fabricacao", "refugo_outros",
                         "total_refugos", "qtd_planejada")},
                     "taxa_refugo": "numeric", "ensaios_por_mil": "numeric"}
    specs = [
        ("conprem_producao_lotes", prod,
         "t.pedido = s.pedido and t.lote = s.lote", prod_types),
        ("conprem_ensaios_dormentes", assay,
         "t.lote_ensaiado = s.lote_ensaiado and t.data_ensaio = s.data_ensaio and "
         "t.pista is not distinct from s.pista and t.molde is not distinct from s.molde and "
         "t.linha is not distinct from s.linha", assay_types),
        ("conprem_reprovados", summary,
         "t.numero_resumo = s.numero_resumo and t.periodo_inicio = s.periodo_inicio and "
         "t.periodo_fim = s.periodo_fim and "
         "split_part(t.pedido_local, ' ', 1) = split_part(s.pedido_local, ' ', 1)", summary_types),
    ]
    for table, rows, key, types in specs:
        chunks = [rows[i:i + 30] for i in range(0, len(rows), 30)] if table == "conprem_ensaios_dormentes" else [rows]
        for index, chunk in enumerate(chunks, 1):
            suffix = f"_{index}" if len(chunks) > 1 else ""
            (args.out_dir / f"{table}{suffix}.sql").write_text(
                make_sql(table, chunk, key, types), encoding="utf-8")
    print(json.dumps({"rastreabilidade_unicas": prod_unique,
                      "ensaios_unicos": len(assay),
                      "resumos": len(summary), "ensaios_sem_pedido": unresolved}, ensure_ascii=False))


if __name__ == "__main__":
    main()
