# Data books (Ferramentas)

`controle-data-books.html` mostra a planilha "Controle Databooks", que acumula os data books de dormentes de concreto, dormentes de madeira e ombreiras, e os arquivos da pasta Databook_Cavan que ainda não estavam nela. A página fica no menu Ferramentas e todos os perfis (Admin, Fiscalização e Consulta) podem abri-la. É somente consulta: nada é gravado pelo aplicativo.

## Organização

Cada aba da planilha vira uma aba da página, e o endereço guarda a aba aberta (`#concreto`, `#madeira`, `#ombreiras`). O número de cada aba conta os arquivos da área (data books, relatórios ou certificados).

- Dormentes de Concreto e Dormentes de Madeira: as linhas que só diferem no lote ou no número do pedido são agrupadas numa linha da tabela. Cada linha mostra o data book (ou relatório), o mês, o fornecedor e o botão que abre o arquivo no SharePoint. Os lotes e pedidos aparecem na ordem da planilha, e as repetições são indicadas com "×2". Um data book que cobre lotes de dois meses aparece uma vez em cada mês, como está na planilha. Data books que só existem na pasta Databook_Cavan aparecem com "Lotes não informados".
- Ombreiras: primeiro os registros da planilha (data, subcomponente, lote, nota fiscal, certificado e quantidade), com os botões dos certificados HF do lote; depois a lista dos certificados HF da pasta, com os lotes de cada um.

A busca procura em todos os campos, e os lotes ou pedidos encontrados aparecem destacados. O filtro Origem (Planilha Controle Databooks ou Pasta Databook_Cavan) aparece nas abas que têm arquivos da pasta. Os filtros de ano e mês das ombreiras usam a coluna Data. Os botões Excel e PDF do topo exportam as linhas filtradas da aba aberta; o link sai só no Excel.

## Origem dos links da planilha

O link de cada linha é o endereço escrito na célula: primeiro `LINK HTTPS` e, se não houver, `LINK RELATÓRIO`. Os hyperlinks "por trás" das células não são usados. Na aba DORMENTE CONCRETO eles ficaram deslocados em relação às linhas e abrem arquivos de outros data books. O texto de `LINK HTTPS` corresponde a exatamente um nome de data book, e vice-versa.

Os endereços relativos gravados pelo Excel (`…/04 - CONTROLE DATABOOKS/../../:b:/s/…`) são resolvidos para o endereço absoluto do SharePoint. Na carga de 16/09/2026, os 347 links de madeira ficaram idênticos aos hyperlinks das células.

Carga de 16/09/2026:

- DORMENTE MADEIRA: 347 linhas, todas com link (125 relatórios). As linhas finais da tabela, que só tinham o ano, foram ignoradas.
- DORMENTE CONCRETO: 1.915 linhas, 1.914 com link (74 data books), incluindo as que o filtro da planilha escondia. O lote da Conprem MG (`1-09/25-2`) ficou sem link: a célula não tem endereço escrito, e o hyperlink dela abria um data book da Cavan.
- OMBREIRAS: 223 linhas, sem links.

Valores numéricos seguem o formato exibido no Excel (por exemplo, um lote gravado como 7,43 em célula de formato inteiro vira `7`).

## Pasta Databook_Cavan

Em 17/09/2026 foram lidas as pastas 2022, 2023, 2024, 2025, 2026 e Certificados_HF da pasta compartilhada Databook_Cavan (OneDrive). A pasta "Verificação de moldes" ficou de fora. Essas linhas têm `origem = 'pasta'` e `fonte_caminho` com a pasta e o arquivo.

- Data books de concreto: dos 90 PDFs, 59 já estavam na planilha e 31 foram adicionados (19 de 2026, 3 de 2025, 2 de 2023, a revisão `007-22 … Rev.1` e 6 versões de 2024: v.1, PARCIAL e compactadas). A comparação usa o número e o ano do data book (`027_26`) e as marcações de versão (v.1, Rev.1, PARCIAL, compac, PARTE I/II), ignorando espaços, hífens e sublinhados. Ano e mês vêm do nome do arquivo; nas versões sem mês no nome, o mês é o do data book original na planilha. Sem lotes: eles ficam dentro dos PDFs.
- Certificados HF das ombreiras: os 17 PDFs `LD_HFOB08_NF…-COMP.pdf` foram ligados aos lotes pela planilha "Lotes ombreiras HFOB08_Cavan.xlsx" da própria pasta (66 ligações lote/certificado). O certificado NF 155410-11 não aparece nessa planilha e ficou sem lotes. O lote N-008 aponta para "16535-51", corrigido para o arquivo NF 165350-51. Os 14 lotes marcados como "Não encontrado" ficam no grupo "Certificado não encontrado". Os lotes são gravados sem hífen (`M-182` → `M182`), como na planilha Controle Databooks, e só se ligam a registros do mesmo subcomponente (HFOB08).

Os links apontam para os arquivos dentro da pasta compartilhada. Eles abrem para quem tem acesso a essa pasta; quem não tiver recebe "acesso negado" no SharePoint até a dona da pasta compartilhar.

## Banco e segurança

Estrutura: `supabase/migrations/20260916130018_controle_data_books.sql` e `supabase/migrations/20260917112056_controle_data_books_origem_pasta.sql`.

`controle_data_books` tem RLS. Usuários ativos só podem ler, e ninguém recebe permissão de criação, edição ou exclusão pelo aplicativo. Anônimos e sessões sem usuário ativo não veem nada. O banco só aceita links `https://`, e a página também só transforma em link os endereços https válidos, abertos em nova aba com `noopener`. Linhas da planilha exigem `fonte_linha` e `fonte_sha256`; linhas da pasta exigem `fonte_caminho` e não se repetem por caminho e lote.

O repositório é público. Por isso as cargas, que contêm os links internos do SharePoint, não são versionadas.

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
   A carga substitui só as linhas de origem `planilha` numa transação e confere as contagens por área antes do `commit`. Se algo divergir, nada é gravado. As linhas da pasta continuam.
4. Apague o SQL gerado.

Se a planilha passar a trazer um data book que hoje só existe na pasta, ele aparece duas vezes (com e sem lotes) até a lista da pasta ser refeita: repita a comparação com a pasta e substitua as linhas `origem = 'pasta'`.

## Verificação

- `node --test tests/controle-data-books.test.cjs`: menu para todos os perfis, login obrigatório, políticas da tabela, ausência de links internos no repositório, links seguros, agrupamento, filtros, resumo, origem planilha/pasta e ligação dos certificados HF aos lotes.
- `supabase/tests/controle-data-books.sql`: Admin, Fiscalização e Consulta leem todas as linhas; Fiscalização não grava; sessão sem usuário ativo e anônimo não leem. Termina com `ROLLBACK`.
- Carga da pasta conferida no banco (31 data books e 80 linhas de ombreiras, planilha intacta) e os 48 links testados no SharePoint, todos respondendo com o PDF.
- Interface verificada com dados sintéticos em desktop, celular e tema escuro: abas por clique e teclado, busca com destaque, filtros, exportação, paginação da consulta e textos com HTML exibidos como texto.
