# Integração SafetyCulture via API

Esta integração busca inspeções concluídas no SafetyCulture, classifica cada
template e grava os dados nas tabelas de inspeção e ensaios do Supabase.

## O que o usuário precisa baixar do SafetyCulture

Nada. Depois que a integração estiver implantada e o token configurado, não é
necessário baixar PDF, CSV ou planilha.

O PDF continua disponível como alternativa manual, mas o fluxo normal passa a
ser:

1. A inspeção é concluída e sincronizada no SafetyCulture.
2. O Supabase consulta a API automaticamente a cada 30 minutos.
3. O relatório aparece na página correspondente do site.
4. Um administrador também pode clicar em **Sincronizar SafetyCulture** para
   trazer os dados imediatamente.

## Pré-requisitos no SafetyCulture

- Plano Premium ou Enterprise.
- Token com acesso aos templates e inspeções que serão importados.
- Preferencialmente um token de usuário de serviço para a automação.
- As inspeções precisam estar concluídas e sincronizadas com a nuvem do
  SafetyCulture.

O token não deve ser colado em arquivos JavaScript, HTML, SQL ou no GitHub.

## Implantação no Supabase

### 1. Criar as tabelas

No SQL Editor, execute:

`supabase/2026-07-16-integracao-safeculture.sql`

### 2. Implantar a Edge Function

A função está em:

`supabase/functions/safeculture-sync/index.ts`

Pelo Supabase CLI:

```powershell
supabase login
supabase link --project-ref kqtvtjgvscjbxrfsbjfg
supabase functions deploy safeculture-sync --use-api
```

O arquivo `supabase/config.toml` mantém `verify_jwt = true`. A função valida
também o perfil Admin ou o segredo exclusivo do cron.

Também é possível criar `safeculture-sync` diretamente no painel
**Edge Functions** do Supabase e usar o conteúdo de `index.ts`.

### 3. Cadastrar os secrets

Em **Supabase > Edge Functions > Secrets**, crie:

- `SAFETYCULTURE_API_TOKEN`: token obtido no SafetyCulture.
- `SAFETYCULTURE_CRON_SECRET`: texto longo e aleatório usado somente pelo
  agendador.
- `SAFETYCULTURE_INITIAL_DAYS`: opcional; padrão `30`.

Pelo CLI:

```powershell
supabase secrets set SAFETYCULTURE_API_TOKEN="SEU_TOKEN"
supabase secrets set SAFETYCULTURE_CRON_SECRET="SEGREDO_LONGO_ALEATORIO"
supabase secrets set SAFETYCULTURE_INITIAL_DAYS="30"
```

### 4. Testar e mapear templates

Entre no site com perfil Admin:

1. Abra **Sistema > Dados do Sistema**.
2. Localize **Integração SafetyCulture**.
3. Clique em **Testar conexão e descobrir templates**.
4. Confira o destino sugerido para cada template.
5. Corrija o destino, se necessário, marque **Sincronizar** e salve.
6. Clique em **Sincronizar agora**.

### 5. Ativar a automação

Abra `supabase/2026-07-16-safeculture-agendamento.sql`.

Substitua:

- `__SAFECULTURE_ANON_JWT__` pela chave pública JWT `anon` legada do projeto,
  usada somente para a validação do gateway;
- `__SAFECULTURE_CRON_SECRET__` pelo mesmo segredo cadastrado na Edge Function.

Depois execute o arquivo no SQL Editor. O script atualiza os valores existentes
no Vault quando for reaplicado, sem criar secrets duplicados.

Neste workspace, o utilitário local ignorado pelo Git
`.tools/supabase-cli/configure-safeculture-secure.ps1` automatiza o cadastro dos
secrets, o Vault, os jobs e o teste da conexão.

Serão criados:

- Sincronização incremental a cada 30 minutos.
- Reconciliação diária das últimas 48 horas às 03:15 no horário de Brasília
  (`06:15 UTC`, fuso usado pelo Supabase Cron).

## Tabelas de destino

| Tipo de relatório | Tabela |
|---|---|
| Inspeção de pista | `inspecoes_pista` |
| Concretagem | `inspecoes_concretagem` |
| Ensaio de bitola | `ensaios_bitola` |
| Arrancamento USP | `ensaios_arrancamento_usp` |
| Ensaio de liberação | `ensaios_liberacao` |
| Acompanhamento de 14 dias | `ensaios_acompanhamento` |

## Regras importantes

- O `audit_id` impede duplicações.
- Se um relatório for corrigido no SafetyCulture, o registro existente é
  atualizado na próxima sincronização.
- Registros vindos da API ficam bloqueados para edição/exclusão local.
- Nos Ensaios de Acompanhamento, a série vinculada na Produção tem prioridade
  sobre o campo do relatório e é consultada automaticamente ao carregar a
  página. A correção manual fica disponível somente quando o lote não possui
  série localizada na Produção.
- Registros manuais e importados de PDF continuam funcionando.
- A integração não cria automaticamente registros em `producao_lotes`.
- Quando o lote não é encontrado, o relatório é importado sem vínculo e a
  ocorrência fica indicada nas observações.
