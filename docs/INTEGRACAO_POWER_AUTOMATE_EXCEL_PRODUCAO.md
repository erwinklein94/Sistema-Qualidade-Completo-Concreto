# Supabase → Excel Online: Produção de Dormentes

Esta integração atualiza, a cada 3 horas, uma tabela exclusiva no Excel Online
com o mesmo layout do botão **Excel** da página **Produção de Dormentes**.

## Arquitetura

1. O Power Automate dispara por recorrência.
2. A ação HTTP chama a Edge Function `power-automate-producao`.
3. A função lê `producao_lotes` e `ensaios_liberacao`, aplica o mesmo status
   automático da página e devolve as 44 colunas da exportação.
   Apenas os lotes da **Cavan** são enviados: a constante `FORNECEDOR_FILTRO`
   aplica `ilike 'cavan%'` sobre `producao_lotes`. Os lotes da Conprem ficam
   fora da planilha. Para mudar o recorte, altere essa constante e republique.
4. O Excel Online executa um Office Script que substitui o conteúdo da tabela
   `tbProducaoSite` na aba `Base_Producao_Site`.

A substituição integral é intencional: inclusões, edições e exclusões feitas no
site são refletidas no Excel e não há duplicidade. Use essa aba apenas como base
de dados. Relatórios, fórmulas e gráficos devem ficar em outras abas.

## 1. Publicar a Edge Function

No terminal, dentro do projeto:

```powershell
supabase --version
supabase functions deploy power-automate-producao
```

Gere um segredo longo, diferente das chaves do Supabase:

```powershell
$bytes = New-Object byte[] 48
[System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
$secret = [Convert]::ToBase64String($bytes)
$secret
```

Copie o valor mostrado e grave-o nos secrets do projeto:

```powershell
supabase secrets set "POWER_AUTOMATE_PRODUCAO_SECRET=COLE_O_VALOR_AQUI"
```

Nunca use a `service_role`, uma secret key do Supabase ou a publishable key como
segredo do Power Automate. A função usa as credenciais administrativas apenas
internamente.

Teste antes de criar o fluxo:

```powershell
$headers = @{ "x-power-automate-secret" = "COLE_O_VALOR_AQUI" }
$url = "https://kqtvtjgvscjbxrfsbjfg.supabase.co/functions/v1/power-automate-producao"
$resultado = Invoke-RestMethod -Method Get -Uri $url -Headers $headers
$resultado.total
$resultado.rows | Select-Object -First 1
```

## 2. Preparar o arquivo Excel Online

1. Abra o arquivo salvo no **SharePoint** ou **OneDrive for Business**.
2. Abra **Automatizar → Novo Script**.
3. Apague o exemplo e cole o conteúdo de
   `scripts/power-automate/sincronizar-producao-excel.ts`.
4. Salve como `Sincronizar produção do site`.

Na primeira execução, o script cria:

- aba `Base_Producao_Site`;
- tabela `tbProducaoSite`;
- cabeçalhos idênticos aos da exportação da página Produção.

Se o arquivo já possui uma aba de apresentação, mantenha-a e faça suas fórmulas,
tabelas dinâmicas ou Power Query apontarem para `tbProducaoSite`.

## 3. Criar o fluxo agendado

No Power Automate:

1. Crie **Meus fluxos → Novo fluxo → Fluxo de nuvem agendado**.
2. Nome: `Supabase - Produção para Excel`.
3. Gatilho **Recorrência**:
   - Frequência: `Hora`;
   - Intervalo: `3`;
   - Fuso horário: `(UTC-03:00) Brasília`.
4. Adicione a ação **HTTP** e renomeie para
   `Buscar_producao_no_Supabase`:
   - Método: `GET`;
   - URI:
     `https://kqtvtjgvscjbxrfsbjfg.supabase.co/functions/v1/power-automate-producao`;
   - Cabeçalho `x-power-automate-secret`: o segredo criado no passo 1.
5. Nas configurações da ação HTTP, habilite **Entradas seguras** e
   **Saídas seguras** para o segredo não aparecer no histórico.
6. Adicione **Excel Online (Business) → Executar script**:
   - Localização: SharePoint ou OneDrive da empresa;
   - Biblioteca e arquivo: selecione o arquivo corporativo;
   - Script: `Sincronizar produção do site`;
   - `payloadJson`: use a expressão:

```text
string(body('Buscar_producao_no_Supabase'))
```

Se o editor alterar o nome interno, selecione o `Body` da ação HTTP pelo painel
de conteúdo dinâmico e envolva-o com `string()`.

O campo **Arquivo** aceita apenas o `id` do driveItem (formato `01ABC…`), nunca
um caminho de pasta. Se o seletor de pasta não abrir — comum em bibliotecas com
muitos níveis — descubra o `id` chamando no navegador, já autenticado no
SharePoint:

```text
https://<tenant>.sharepoint.com/sites/<site>/_api/v2.0/drives/<driveId>/root:/<caminho>/<arquivo>.xlsx
```

O `driveId` sai de `_api/v2.0/drives`, escolhendo a biblioteca pelo `webUrl` e
copiando o `id` completo (66 caracteres). O caminho é relativo à raiz da
biblioteca, ou seja, não inclui `Documentos Compartilhados`. Um caminho colado
no campo Arquivo produz o erro `O formato de entrada da pasta de trabalho era
inválido`.

7. Salve e use **Testar → Manualmente**.
8. Confirme no Excel:
   - a tabela `tbProducaoSite` foi criada;
   - a quantidade de linhas coincide com `total` na resposta HTTP;
   - uma edição feita no site aparece depois do próximo teste.

## 4. Tratamento de falhas recomendado

Adicione uma ação de e-mail ou Teams configurada para executar quando a ação
HTTP ou o Office Script falhar. Inclua o nome do fluxo e um link para o histórico
da execução. Não inclua o segredo na mensagem.

O conector HTTP pode exigir licença Power Automate Premium. O conector
**Excel Online (Business)** trabalha com arquivos em OneDrive for Business,
SharePoint e Grupos do Microsoft 365.

## Observações

- A função limita a exportação a 5.000 registros, igual à leitura atual da
  página. Acima disso ela falha explicitamente, em vez de atualizar o Excel com
  dados truncados.
- O arquivo não deve estar bloqueado por uma edição prolongada durante o fluxo.
- Mudanças futuras nos cabeçalhos fazem o script falhar de forma segura; atualize
  o Office Script e a tabela conscientemente.
- O fluxo é idempotente: executá-lo novamente produz a mesma base, sem duplicar.
