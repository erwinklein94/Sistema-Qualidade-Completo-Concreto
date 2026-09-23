alter table public.conprem_producao_lotes
  add column if not exists referencias_semanais jsonb not null default '[]'::jsonb;

alter table public.conprem_ensaios_dormentes
  add column if not exists arquivo_ensaio_dormentes text,
  add column if not exists arquivo_relatorio_fotografico text,
  add column if not exists arquivo_termo_liberacao text,
  add column if not exists arquivo_ensaio_liberacao text,
  add column if not exists referencias_semanais jsonb not null default '[]'::jsonb;

comment on column public.conprem_producao_lotes.referencias_semanais is
  'Linhas e arquivos das versões semanais do Mapa de Rastreabilidade.';

comment on column public.conprem_ensaios_dormentes.referencias_semanais is
  'Linhas e arquivos das versões semanais do controle de ensaios, incluindo valores anteriores corrigidos.';
