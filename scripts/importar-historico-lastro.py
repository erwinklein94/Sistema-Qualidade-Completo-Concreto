"""Extrai o Excel de pedreiras sem executar fórmulas nem alterar a fonte.
Uso: python scripts/importar-historico-lastro.py arquivo.xlsx destino.sql
A carga é idempotente por auditID e mantém todas as 45 colunas em dados_originais.
"""
import collections
import datetime
import hashlib
import json
from pathlib import Path
import sys
import openpyxl


def extrair(arquivo):
    book = openpyxl.load_workbook(arquivo, read_only=True, data_only=True)
    rows = list(book.worksheets[0].values)
    headers = rows[0]
    assert len(headers) == 45 and headers[0] == 'auditID', 'Formato inesperado'
    registros = []
    for linha, row in enumerate(rows[1:], 2):
        if not any(v is not None for v in row):
            continue
        def valor(v):
            return v.isoformat() if isinstance(v, (datetime.datetime, datetime.date)) else v
        criterios = {f'c{i+1:02}': {'resposta': row[c], 'notas': row[c+1]} for i, c in enumerate(range(14, 40, 2))}
        assert all(v['resposta'] in (None, 'Sim', 'Não', 'N/D') for v in criterios.values())
        registros.append(dict(audit_id=row[0], audit_nome=row[1], origem_dados='historico',
            fornecedor=row[6], data_inspecao=row[8].date().isoformat() if row[8] else None,
            responsavel=row[10], localizacao=row[12], respostas=criterios,
            notas_gerais={k: row[c] for k, c in [('fornecedor',7),('data_inspecao',9),('responsavel',11),('localizacao',13)]},
            status='concluida' if row[42] else 'rascunho',
            fonte_arquivo=Path(arquivo).name, fonte_linha=linha,
            fonte_sha256=hashlib.sha256(Path(arquivo).read_bytes()).hexdigest(),
            dados_originais={h: valor(v) for h, v in zip(headers,row)}))
    assert len({r['audit_id'] for r in registros}) == len(registros), 'auditID duplicado'
    book.close()
    return registros


def sql_carga(registros):
    statements = ['-- Histórico de pedreiras. Reexecução não sobrescreve registros existentes.', 'BEGIN;']
    for r in registros:
        raw = json.dumps(r, ensure_ascii=False).replace("'", "''")
        statements.append("INSERT INTO public.lastro_inspecoes (audit_id,audit_nome,origem_dados,fornecedor,data_inspecao,responsavel,localizacao,respostas,notas_gerais,status,fonte_arquivo,fonte_linha,fonte_sha256,dados_originais)\n"
            "SELECT audit_id,audit_nome,origem_dados,fornecedor,data_inspecao,responsavel,localizacao,respostas,notas_gerais,status,fonte_arquivo,fonte_linha,fonte_sha256,dados_originais\n"
            f"FROM jsonb_populate_record(NULL::public.lastro_inspecoes, '{raw}'::jsonb) ON CONFLICT (audit_id) DO NOTHING;")
    statements.append('COMMIT;')
    return '\n'.join(statements) + '\n'


if __name__ == '__main__':
    registros = extrair(sys.argv[1])
    Path(sys.argv[2]).write_text(sql_carga(registros), encoding='utf-8')
    contagens = collections.Counter(v['resposta'] for r in registros for v in r['respostas'].values())
    print(json.dumps({'relatorios': len(registros), 'respostas': dict(contagens)}, ensure_ascii=False))
