alter table public.producao_lotes
  add column if not exists hora_fabricacao time without time zone,
  add column if not exists desmolde_em timestamp without time zone;

comment on column public.producao_lotes.hora_fabricacao is
  'Horário local de fabricação usado no cálculo do tempo de cura.';

comment on column public.producao_lotes.desmolde_em is
  'Data e horário local do desmolde usados no cálculo do tempo de cura.';
