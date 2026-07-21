-- Guarda o lote identificado no relatório para que a tela de Dados do Sistema
-- consiga mostrar qual lote falhou, e não apenas o audit_id do SafetyCulture.
alter table public.safeculture_inspecoes
  add column if not exists lote text;

comment on column public.safeculture_inspecoes.lote is
  'Lote identificado no relatório do SafetyCulture, usado no painel de sincronização.';

create index if not exists idx_safeculture_inspecoes_atualizado_em
  on public.safeculture_inspecoes (atualizado_em desc);

-- Backfill dos relatórios já processados, a partir do registro de destino.
update public.safeculture_inspecoes as i set lote = d.lote
  from public.inspecoes_pista as d
 where i.registro_destino_id = d.id and i.destino = 'inspecoes_pista' and i.lote is null;

update public.safeculture_inspecoes as i set lote = d.lote
  from public.inspecoes_concretagem as d
 where i.registro_destino_id = d.id and i.destino = 'inspecoes_concretagem' and i.lote is null;

update public.safeculture_inspecoes as i set lote = d.lote
  from public.ensaios_bitola as d
 where i.registro_destino_id = d.id and i.destino = 'ensaios_bitola' and i.lote is null;

update public.safeculture_inspecoes as i set lote = d.lote
  from public.ensaios_arrancamento_usp as d
 where i.registro_destino_id = d.id and i.destino = 'ensaios_arrancamento_usp' and i.lote is null;

update public.safeculture_inspecoes as i set lote = d.lote_ensaiado
  from public.ensaios_liberacao as d
 where i.registro_destino_id = d.id and i.destino = 'ensaios_liberacao' and i.lote is null;

update public.safeculture_inspecoes as i set lote = d.lote_ensaiado
  from public.ensaios_acompanhamento as d
 where i.registro_destino_id = d.id and i.destino = 'ensaios_acompanhamento' and i.lote is null;
