# Ensaios de Acompanhamento (14 dias · Cura Térmica)

Nova aba na área **Dormentes de Concreto** para registrar os ensaios de
acompanhamento que ocorrem **14 dias após a produção** dos lotes marcados
como **Cura Térmica** na Produção.

## Regras da aba
- Registro **apenas documental**: nenhum registro desta tela libera série.
  A liberação continua acontecendo exclusivamente pela aba **Ensaios de
  Liberação** (ensaio de 28 dias para lotes de cura térmica).
- Segue o mesmo padrão da tela de Ensaios de Liberação: leitor de PDF do
  iAuditor, lançamento manual, filtros, KPIs, tabela, exportações e campo
  de **link do relatório iAuditor/SharePoint**.

## Reconhecimento do relatório de acompanhamento (leitor iAuditor)
O PDF é reconhecido como ensaio de acompanhamento quando:
1. possui ensaios do dormente (cargas/momentos ou dimensionais); **e**
2. traz a marcação **"Ensaio após os 14 dias de produção"** no campo de
   data do ensaio; **e/ou**
3. o lote correspondente está marcado como **cura térmica** na Produção.

O leitor também mostra a **data de produção** lida no PDF e calcula os
**dias decorridos** até o ensaio (alerta visual quando diferente de 14).

## Proteção na aba Ensaios de Liberação
Se um relatório com a marcação de 14 dias de um lote de cura térmica for
importado na aba de **Ensaios de Liberação**, o leitor avisa que se trata
de um acompanhamento, bloqueia o registro rápido como liberação e oferece
um botão para ir à aba **Ensaios de Acompanhamento**.

## Arquivos
- `ensaios-acompanhamento.html` — nova página.
- `js/ensaios-acompanhamento.js` — lógica da página (leitor iAuditor,
  CRUD no Supabase, KPIs, exportações).
- `js/store-supabase.js` — funções `listarEnsaiosAcompanhamento`,
  `salvarEnsaioAcompanhamento`, `removerEnsaioAcompanhamento`.
- `js/comum.js` — item de menu "Ensaios de Acompanhamento" no grupo
  Dormentes de Concreto.
- `js/ensaios-liberacao.js` — detecção do relatório de acompanhamento e
  redirecionamento.
- `supabase/2026-07-03-ensaios-acompanhamento.sql` — **rode este script
  no SQL Editor do Supabase antes de usar a aba** (cria a tabela
  `ensaios_acompanhamento` com índices, auditoria e RLS no mesmo modelo
  das demais tabelas de ensaio).
