# Página "Ensaio de Bitola" (área Dormentes de Concreto)

Nova página independente, no Menu Concreto logo abaixo de "Ensaios de Liberação".
Funciona como histórico consultivo: cada ensaio leva direto ao relatório pelo link.

## O que faz
- **Leitor de iAuditor**: importe o PDF (arrastar ou escolher). O sistema lê lote,
  projeto, bitola, data, responsável e as medidas, e mostra um preview.
- **Salvar direto**: no preview, basta colar o link do relatório e clicar
  "Salvar relatório" para gravar no histórico.
- **Novo relatório manual**: cadastro sem PDF (data, lote, projeto, bitola,
  fornecedor, resultado, responsável, link e observações).
- **Histórico**: lista filtrável (busca, projeto, bitola, resultado, período) com
  KPIs e botão "Abrir relatório" que abre o link em nova aba. Ver/editar/excluir
  conforme permissão.

A página é independente das demais (não usa produção, séries nem outros módulos).

## Arquivos
- `ensaio-bitola.html`, `js/ensaio-bitola.js` — página e lógica (novos).
- `js/store-supabase.js` — métodos `listarEnsaiosBitola`, `salvarEnsaioBitola`,
  `removerEnsaioBitola`.
- `js/comum.js` — item de menu `ensaioBitola` (abaixo de Ensaios de Liberação).
- `supabase/2026-06-09-ensaios-bitola.sql` — **rode uma vez no SQL Editor do
  Supabase** para criar a tabela `ensaios_bitola` (com RLS e auditoria). Enquanto
  não for criada, a tela mostra um aviso orientando a rodar este script.
