-- Permite corrigir somente a série de acompanhamentos sincronizados sem que a
-- próxima execução do SafetyCulture sobrescreva o ajuste local.
alter table public.ensaios_acompanhamento
  add column if not exists serie_ajustada_manualmente boolean not null default false;

comment on column public.ensaios_acompanhamento.serie_ajustada_manualmente is
  'Indica que a série foi corrigida localmente e deve ser preservada pela sincronização do SafetyCulture.';

-- Corrige os registros já importados em que o campo "Série de lotes" do
-- SafetyCulture repetiu o número do lote. A Produção é a referência oficial.
update public.ensaios_acompanhamento as acompanhamento
set serie = producao.serie
from public.producao_lotes as producao
where acompanhamento.producao_lote_id = producao.id
  and acompanhamento.origem_dados = 'safeculture'
  and not acompanhamento.serie_ajustada_manualmente
  and nullif(trim(producao.serie), '') is not null
  and (
    nullif(trim(acompanhamento.serie), '') is null
    or trim(acompanhamento.serie) = trim(acompanhamento.lote_ensaiado)
  );
