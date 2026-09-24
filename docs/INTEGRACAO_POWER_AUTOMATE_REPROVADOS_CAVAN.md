# Site → Excel Online: Reprovados Cavan

As reprovas da Cavan lançadas na página **Dormentes Reprovados** chegam sozinhas,
de hora em hora, à aba `REPROVADOS_CAVAN` da planilha
`Indicador semanal_2026.xlsx` (SharePoint da Engenharia de Via Permanente Op. Norte,
pasta *Planilhas de controle*).

## Como funciona

1. Fluxo **Sincronizar site com excel - Reprovados Cavan** no Power Automate
   (cópia do fluxo da Produção), com recorrência de 1 hora aos **:30** (horário de
   Brasília), fora do horário do fluxo da Produção, que roda nas horas cheias.
2. Ação **HTTP**: `GET https://kqtvtjgvscjbxrfsbjfg.supabase.co/functions/v1/power-automate-reprovados`
   com o cabeçalho `x-power-automate-secret`.
3. A Edge Function `power-automate-reprovados` lê `public.reprovados` (fornecedor
   Cavan) e devolve cada reprova com semana operacional, período e total de refugos
   calculados como na tela (`U.semanaOperacionalInfo` e `U.periodoReprova`).
4. Ação **Executar script** roda o Office Script **Sincronizar reprovados Cavan**
   (OneDrive › Documentos › Scripts do Office) com
   `payloadJson = string(body('HTTP'))`.

O script escreve no mesmo layout das linhas lançadas à mão: uma linha por
dormente, datas em `dd/mm/aaaa`, SEMANA e TOTAL DE REFUGOS DA SEMANA mesclados por
semana e linha contínua fechando cada semana.

A linha que fecha a semana fica gravada como borda de baixo da última linha do
bloco: o Excel Online não desenha a borda de cima de um bloco mesclado, e mesclar
ou formatar o bloco seguinte depois leva a borda para ele. Por isso o script
aplica essas bordas por último, de baixo para cima.

## Qual parte da aba o site controla

- Da **semana 36/2026** (27/08/2026) em diante a aba espelha o site: inclusão,
  edição e exclusão feitas no site aparecem na execução seguinte. Lance essas
  semanas no site; o que for digitado direto nesse trecho é sobrescrito.
- As semanas anteriores continuam como foram lançadas à mão e nunca são alteradas.
- O nome definido `SITE_REPROVADOS_CAVAN_INICIO` marca a primeira linha do trecho do
  site e acompanha linhas inseridas ou excluídas acima dele.
- Quando nada mudou, o script não grava na planilha.

Para mudar o início ou o ano (planilha de 2027), altere `SINCRONIZAR_DESDE` e `ANO`
no começo do `main` do Office Script. Ao mudar a formatação, troque o número de
`COMENTARIO_MARCADOR` para forçar uma regravação.

## Segurança

- A função usa o mesmo segredo da função da Produção (`POWER_AUTOMATE_PRODUCAO_SECRET`)
  ou, se existir, `POWER_AUTOMATE_REPROVADOS_SECRET`. Sem o cabeçalho certo, responde 401.
- Publicada com `verify_jwt = false` (registrado em `supabase/config.toml`) porque
  o Power Automate não envia JWT; a autenticação é o segredo.
- O `service_role` só tem leitura em `reprovados`
  (migration `20260924134957_power_automate_reprovados_leitura_service_role`).

## Quando falhar

- **HTTP 500 com "permission denied"**: faltou o `grant select` acima.
- **"O site não devolveu reprovas…"**: a função respondeu vazio; o script para sem
  apagar nada.
- **Arquivo bloqueado**: o Excel Online às vezes recusa a execução enquanto outra
  automação grava; a próxima execução, uma hora depois, recupera.
