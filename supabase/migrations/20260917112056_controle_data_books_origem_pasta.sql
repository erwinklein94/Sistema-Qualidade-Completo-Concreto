-- Arquivos da pasta Databook_Cavan (OneDrive) que não estão na planilha Controle Databooks:
-- data books de concreto sem linha na planilha e certificados HF das ombreiras.
-- A carga da planilha passa a substituir só as linhas de origem 'planilha'.
alter table public.controle_data_books
  add column origem text not null default 'planilha' check (origem in ('planilha', 'pasta')),
  add column fonte_caminho text check (fonte_caminho is null or char_length(fonte_caminho) <= 500);

alter table public.controle_data_books
  alter column fonte_linha drop not null,
  alter column fonte_sha256 drop not null,
  add constraint controle_data_books_fonte_origem check (
    (origem = 'planilha' and fonte_linha is not null and fonte_sha256 is not null)
    or (origem = 'pasta' and fonte_caminho is not null)
  );

create unique index controle_data_books_pasta_unica
  on public.controle_data_books (fonte_caminho, coalesce(lote, ''))
  where origem = 'pasta';

comment on column public.controle_data_books.origem is
'planilha: linha da planilha Controle Databooks. pasta: arquivo da pasta Databook_Cavan que não está na planilha (sem lotes, exceto certificados HF ligados pela planilha de lotes da pasta).';
