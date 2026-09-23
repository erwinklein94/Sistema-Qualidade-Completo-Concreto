alter table public.conprem_reprovados
  add column if not exists observacoes text;

comment on column public.conprem_reprovados.observacoes is
  'Observações e referência ao arquivo do Resumo Semanal CONPREM.';
