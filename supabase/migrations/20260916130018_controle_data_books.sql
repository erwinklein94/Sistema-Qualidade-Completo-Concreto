-- Página Data books (menu Ferramentas): consulta da planilha "Controle Databooks",
-- que acumula os data books de dormentes de madeira, dormentes de concreto e ombreiras.
-- Todos os perfis ativos leem; nada é gravado pelo aplicativo. A carga é gerada por
-- scripts/importar-controle-data-books.ps1 e não fica no repositório, porque traz
-- links internos do SharePoint e o repositório é público.
create table public.controle_data_books (
  id bigint generated always as identity primary key,
  area text not null check (area in ('dormente_madeira', 'dormente_concreto', 'ombreiras')),
  ano smallint check (ano between 1990 and 2100),
  mes text,
  fornecedor text,
  inspecionado_por text,
  numero_pedido text,
  lote text,
  subcomponente text,
  data_referencia date,
  nota_fiscal text,
  certificado text,
  quantidade numeric check (quantidade is null or quantidade >= 0),
  data_book text,
  link text check (link is null or link ~ '^https://[^\s"<>]+$'),
  fonte_arquivo text not null,
  fonte_aba text not null,
  fonte_linha integer not null check (fonte_linha >= 2),
  fonte_sha256 text not null,
  importado_em timestamptz not null default now(),
  constraint controle_data_books_linha_unica unique (fonte_aba, fonte_linha)
);

alter table public.controle_data_books enable row level security;
revoke all on table public.controle_data_books from anon, authenticated;
grant select on table public.controle_data_books to authenticated;
create policy controle_data_books_leitura
on public.controle_data_books for select to authenticated
using ((select public.usuario_ativo()));

comment on table public.controle_data_books is
'Planilha Controle Databooks: uma linha por linha preenchida das abas DORMENTE MADEIRA, DORMENTE CONCRETO e OMBREIRAS. Somente leitura para usuários ativos.';
