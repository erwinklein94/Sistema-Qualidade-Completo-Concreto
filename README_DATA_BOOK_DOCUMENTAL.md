# Data Books documental - reset e nova carga

## O que foi alterado

A área **Data books** deixou de usar a tabela antiga `public.data_books_dormentes`, que guardava dados por lote/bobina, e passou a usar um modelo próprio para inspeção documental:

- `public.data_book_inspecoes`: cabeçalho de cada PDF/Data Book.
- `public.data_book_itens`: todos os campos avaliados conforme a planilha Excel anexada.

O JavaScript consulta o Supabase e não deixa os dados pesados dentro do código.

## Como aplicar no Supabase

1. Abra o Supabase do projeto.
2. Vá em **SQL Editor**.
3. Rode o arquivo:

```sql
supabase/2026-06-19-data-books-documental-reset-e-carga.sql
```

Esse SQL:
- apaga a estrutura antiga da página de Data Books;
- cria as novas tabelas;
- aplica RLS admin-only;
- insere a primeira leitura do PDF `001_26 - DB CAVAN SL - RUMO_FMT - JANEIRO(3).pdf`.

## Resultado da primeira leitura

Foram carregados **65 itens** da planilha modelo.

Resumo da leitura:
- Temperatura máxima encontrada nos certificados de lote: **56,9 °C**.
- Maior taxa de aumento calculada: **5,67 °C/h**.
- Compressão axial aos 28 dias: **mín. 62,29 MPa; média 82,70 MPa; máx. 96,92 MPa**.
- Tração na flexão aos 28 dias: **mín. 7,10 MPa; média 8,51 MPa; máx. 10,20 MPa**.
- Alguns itens ficaram **NOK** porque a planilha possui tolerâncias mais rígidas que alguns valores extraídos.
- Itens marcados como **NA** são campos que não tiveram evidência objetiva localizada no PDF.

## Para próximos PDFs

Quando um novo PDF de Data Book for analisado, basta gerar um novo SQL de carga para inserir outro registro em `data_book_inspecoes` e seus itens em `data_book_itens`.
