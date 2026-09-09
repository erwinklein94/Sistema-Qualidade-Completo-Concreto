"""Consolida os quatro arquivos Excel de dormentes de madeira em SQL idempotente.

Os valores das planilhas são tratados somente como dados. Todas as colunas
originais são preservadas em dados_originais, sem executar fórmulas ou comandos.
"""
from decimal import Decimal, InvalidOperation
from hashlib import sha256
import datetime
import json
from pathlib import Path
import sys
import openpyxl

VERSOES = {
    'audit_excel_20260909004218UTC.xlsx': 'recebimento_v1',
    'audit_excel_20260909004139UTC.xlsx': 'recebimento_v2',
    'audit_excel_20260909003948UTC.xlsx': 'recebimento_v3',
    'audit_excel_20260909003900UTC.xlsx': 'recebimento_v4',
}

def original(v):
    if isinstance(v, (datetime.datetime, datetime.date)):
        return v.isoformat()
    if isinstance(v, Decimal):
        return str(v)
    return v

def indice(headers, *sufixos):
    for sufixo in sufixos:
        for i, nome in enumerate(headers):
            texto = str(nome or '').strip()
            if not texto.endswith('_notes') and texto.endswith(sufixo):
                return i
    return None

def obter(row, idx):
    return row[idx] if idx is not None else None

def texto(v):
    valor = str(v).strip() if v is not None else ''
    return valor or None

def numero(v):
    valor = texto(v)
    if valor is None or valor == 'N/D':
        return None
    try:
        n = Decimal(valor.replace(',', '.'))
        return int(n) if n == n.to_integral_value() else float(n)
    except InvalidOperation:
        return None

def data(v):
    if isinstance(v, datetime.datetime):
        return v.date().isoformat()
    if isinstance(v, datetime.date):
        return v.isoformat()
    valor = texto(v)
    return valor[:10] if valor and len(valor) >= 10 else None

def campo(headers, row, sufixo):
    i = indice(headers, sufixo)
    return obter(row, i), obter(row, i + 1) if i is not None and i + 1 < len(row) and str(headers[i + 1]).endswith('_notes') else None

def extrair(arquivos):
    registros = []
    for arquivo in arquivos:
        digest = sha256(arquivo.read_bytes()).hexdigest()
        book = openpyxl.load_workbook(arquivo, read_only=True, data_only=True)
        for sheet in book:
            rows = list(sheet.values)
            if not rows:
                continue
            headers = list(rows[0])
            lei = str(sheet.title).startswith('Dormente Lei')
            versao = 'dormente_lei_fornecedor' if lei else VERSOES[arquivo.name]
            for linha, row in enumerate(rows[1:], 2):
                if not any(v is not None for v in row):
                    continue
                fornecedor, _ = campo(headers, row, 'Fornecedor')
                outro, _ = campo(headers, row, 'Qual Fornecedor?')
                fornecedor = outro if texto(fornecedor) == 'Outro' and texto(outro) else fornecedor
                realizado, _ = campo(headers, row, 'Realizado em')
                responsavel, _ = campo(headers, row, 'Fiscal' if lei else 'Responsável pela Inspeção')
                entregue, _ = campo(headers, row, 'Quantidade Inspecionada' if lei else 'Qtd Entregue')
                reprovada, _ = campo(headers, row, 'Quantidade Reprovado' if lei else 'Qtd Reprovada')
                taxa, _ = campo(headers, row, 'Taxa de reprovação')
                defeitos = {}
                for nome in ('Podre','Esmoado','Casca','Empeno','Resina','Rachadura e Fendilhamento'):
                    valor, notas = campo(headers, row, nome)
                    defeitos[nome] = {'quantidade': numero(valor), 'notas': texto(notas)}
                tipo = 'dormente_lei_fornecedor' if lei else versao
                info, info_notas = campo(headers, row, 'INFORMAÇÕES ADICIONAIS')
                dados = {str(k): original(v) for k, v in zip(headers, row)}
                registros.append({
                    'audit_id': texto(row[0]), 'audit_nome': texto(row[1]),
                    'template_id': texto(row[2]), 'template_nome': texto(row[3]) or sheet.title,
                    'tipo_relatorio': tipo, 'fornecedor': texto(fornecedor),
                    'data_inspecao': data(realizado), 'localizacao': texto(campo(headers,row,'Localização')[0]),
                    'responsavel': texto(responsavel), 'projeto': texto(campo(headers,row,'Projeto')[0]),
                    'tipo_dormente': texto(campo(headers,row,'Tipo de Dormente')[0]),
                    'nota_fiscal': texto(campo(headers,row,'Nota Fiscal')[0]),
                    'numero_pedido': texto(campo(headers,row,'N° Pedido' if lei else 'Número do Pedido')[0]),
                    'data_entrega': data(campo(headers,row,'Data da Entrega')[0]),
                    'qtd_entregue': numero(entregue), 'qtd_reprovada': numero(reprovada),
                    'taxa_reprovacao': numero(taxa),
                    'teor_umidade_medido': texto(campo(headers,row,'Teor de Umidade Medido')[0]),
                    'teor_umidade_aprovado': texto(campo(headers,row,'Teor de Umidade Aprovado')[0]),
                    'marcacao_lado': texto(campo(headers,row,'Marcação de lado a ser aplicado?')[0]),
                    'carimbo_fiscalizadora': texto(campo(headers,row,'Carimbo Fiscalizadora')[0]),
                    'defeitos': defeitos,
                    'informacoes_adicionais': '\n'.join(x for x in (texto(info), texto(info_notas)) if x) or None,
                    'status': 'concluida' if row[-3] is not None else 'rascunho',
                    'fonte_arquivo': arquivo.name, 'fonte_aba': sheet.title,
                    'fonte_linha': linha, 'fonte_sha256': digest, 'dados_originais': dados,
                })
        book.close()
    ids = [r['audit_id'] for r in registros]
    assert all(ids) and len(ids) == len(set(ids)), 'auditID ausente ou duplicado'
    return registros

def sql_carga(registros):
    linhas = ['-- Carga idempotente: não substitui auditIDs já registrados.', 'begin;']
    colunas = ['audit_id','audit_nome','template_id','template_nome','tipo_relatorio','fornecedor',
        'data_inspecao','localizacao','responsavel','projeto','tipo_dormente','nota_fiscal',
        'numero_pedido','data_entrega','qtd_entregue','qtd_reprovada','taxa_reprovacao',
        'teor_umidade_medido','teor_umidade_aprovado','marcacao_lado','carimbo_fiscalizadora',
        'defeitos','informacoes_adicionais','status','fonte_arquivo','fonte_aba','fonte_linha',
        'fonte_sha256','dados_originais']
    lista = ','.join(colunas)
    for r in registros:
        bruto = json.dumps(r, ensure_ascii=False, separators=(',',':')).replace("'", "''")
        linhas.append(f"insert into public.madeira_inspecoes ({lista})\nselect {lista} from jsonb_populate_record(null::public.madeira_inspecoes, '{bruto}'::jsonb)\non conflict (audit_id) do nothing;")
    linhas.append('commit;')
    return '\n'.join(linhas) + '\n'

if __name__ == '__main__':
    fontes = [Path(p) for p in sys.argv[1:-1]]
    destino = Path(sys.argv[-1])
    registros = extrair(fontes)
    destino.write_text(sql_carga(registros), encoding='utf-8')
    print(json.dumps({'relatorios':len(registros),'concluidos':sum(r['status']=='concluida' for r in registros),
        'por_tipo':{k:sum(r['tipo_relatorio']==k for r in registros) for k in sorted(set(r['tipo_relatorio'] for r in registros))}}, ensure_ascii=False))
