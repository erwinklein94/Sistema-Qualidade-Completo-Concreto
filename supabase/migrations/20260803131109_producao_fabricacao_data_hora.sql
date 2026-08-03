alter table public.producao_lotes
  add column if not exists fabricacao_em timestamp without time zone;

update public.producao_lotes
set fabricacao_em = data_fabricacao::timestamp
  + coalesce(hora_fabricacao, time '00:00')
where fabricacao_em is null
  and data_fabricacao is not null;

comment on column public.producao_lotes.fabricacao_em is
  'Data e horário local de fabricação usados no cálculo do tempo de cura.';
