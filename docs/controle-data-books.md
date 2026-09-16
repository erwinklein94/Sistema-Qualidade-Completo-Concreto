# Data books (Ferramentas)

`controle-data-books.html` mostra a planilha "Controle Databooks", que acumula os data books de dormentes de concreto, dormentes de madeira e ombreiras. A página fica no menu Ferramentas e todos os perfis (Admin, Fiscalização e Consulta) podem abri-la. É somente consulta: nada é gravado pelo aplicativo.

## Organização

Cada aba da planilha vira uma aba da página, e o endereço guarda a aba aberta (`#concreto`, `#madeira`, `#ombreiras`).

- Dormentes de Concreto e Dormentes de Madeira: as linhas que só diferem no lote ou no número do pedido são agrupadas numa linha da tabela. Cada linha mostra o data book (ou relatório), o mês, o fornecedor e o botão que abre o arquivo no SharePoint. Os lotes e pedidos aparecem na ordem da planilha, e as repetições são indicadas com "×2". Um data book que cobre lotes de dois meses aparece uma vez em cada mês, como está na planilha.
- Ombreiras: uma linha por registro (data, subcomponente, lote, nota fiscal, certificado e quantidade). A aba ainda não tem links preenchidos na planilha.

A busca procura em todos os campos, e os lotes ou pedidos encontrados aparecem destacados. Os filtros de ano e mês das ombreiras usam a coluna Data. Os botões Excel e PDF do topo exportam as linhas filtradas da aba aberta; o link sai só no Excel.

## Origem dos links

O link de cada linha é o endereço escrito na célula: primeiro `LINK HTTPS` e, se não houver, `LINK RELATÓRIO`. Os hyperlinks "por trás" das células não são usados. Na aba DORMENTE CONCRETO eles ficaram deslocados em relação às linhas e abrem arquivos de outros data books. O texto de `LINK HTTPS` corresponde a exatamente um nome de data book, e vice-versa.

Os endereços relativos gravados pelo Excel (`…/04 - CONTROLE DATABOOKS/../../:b:/s/…`) são resolvidos para o endereço absoluto do SharePoint. Na carga de 16/09/2026, os 347 links de madeira ficaram idênticos aos hyperlinks das células.

Carga de 16/09/2026:

- DORMENTE MADEIRA: 347 linhas, todas com link (125 relatórios). As linhas finais da tabela, que só tinham o ano, foram ignoradas.
- DORMENTE CONCRETO: 1.915 linhas, 1.914 com link (74 data books), incluindo as que o filtro da planilha escondia. O lote da Conprem MG (`1-09/25-2`) ficou sem link: a célula não tem endereço escrito, e o hyperlink dela abria um data book da Cavan.
- OMBREIRAS: 223 linhas, sem links.

Valores numéricos seguem o formato exibido no Excel (por exemplo, um lote gravado como 7,43 em célula de formato inteiro vira `7`).

## Banco e segurança

Estrutura: `supabase/migrations/20260916130018_controle_data_books.sql`.

`controle_data_books` tem RLS. Usuários ativos só podem ler, e ninguém recebe permissão de criação, edição ou exclusão pelo aplicativo. Anônimos e sessões sem usuário ativo não veem nada. O banco só aceita links `https://`, e a página também só transforma em link os endereços https válidos, abertos em nova aba com `noopener`.

O repositório é público. Por isso a carga, que contém os links internos do SharePoint, não é versionada: ela é gerada localmente a partir da planilha.

## Atualizar com uma nova versão da planilha

1. Baixe a versão atual de "Controle Databooks.xlsx".
2. Gere a carga fora do repositório:
   ```powershell
   .\scripts\importar-controle-data-books.ps1 -Planilha "C:\caminho\Controle Databooks.xlsx" -Saida "$env:TEMP\carga-data-books.sql" -NomeFonte "Controle Databooks.xlsx"
   ```
   O script mostra quantas linhas e links saíram de cada aba e lista avisos (célula com hyperlink sem endereço escrito, mês fora da lista, data ou quantidade não reconhecida).
3. Aplique a carga a partir da raiz do repositório:
   ```powershell
   .tools\supabase-cli\bin\supabase.exe db query --linked --file "$env:TEMP\carga-data-books.sql"
   ```
   A carga substitui todo o conteúdo numa transação e confere as contagens por área antes do `commit`. Se algo divergir, nada é gravado.
4. Apague o SQL gerado.

## Verificação

- `node --test tests/controle-data-books.test.cjs`: menu para todos os perfis, login obrigatório, políticas da tabela, ausência de links internos no repositório, links seguros, agrupamento, filtros e resumo.
- `supabase/tests/controle-data-books.sql`: Admin, Fiscalização e Consulta leem todas as linhas; Fiscalização não grava; sessão sem usuário ativo e anônimo não leem. Termina com `ROLLBACK`.
- Interface verificada com dados sintéticos em desktop, celular e tema escuro: abas por clique e teclado, busca com destaque, filtros, exportação, paginação da consulta e textos com HTML exibidos como texto.
