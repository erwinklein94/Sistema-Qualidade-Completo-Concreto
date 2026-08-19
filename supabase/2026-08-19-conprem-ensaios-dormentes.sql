-- =====================================================================
-- CONPREM — Ensaio de Dormentes (FR.10/08)
--
-- As 45 colunas do relatório que a CONPREM envia toda semana: um ensaio
-- completo por lote, com dimensional, cargas, USP e resultado geral.
-- Não cabia em conprem_ensaios_liberacao, que guarda só a decisão de
-- liberação da série. Alimentada pelo Leitor de Recebidos e editável na
-- tela Ensaios de Dormentes da área Conprem.
--
-- Tipos seguem o schema do leitor: numeric no que é medida (pista, molde,
-- linha, torção, comprimento, larguras, alturas, cargas USP), date nas
-- duas datas e text no resto — inclusive nas leituras "OK", "N/A" e "-",
-- que são respostas válidas do formulário.
-- =====================================================================

create table conprem_ensaios_dormentes (
  id uuid primary key default gen_random_uuid(),

  fornecedor text not null default 'Conprem MG',
  projeto text,
  bitola text,

  semana integer,
  ano integer,
  ordem_fabricacao text,
  pedido text,
  cliente text,
  lote_ensaiado text not null,
  data_fabricacao date,
  turno text,
  data_ensaio date not null,
  pista numeric,
  molde numeric,
  linha numeric,

  med_ext_passa text,
  med_ext_nao_passa text,
  med_int_passa text,
  med_int_nao_passa text,
  inclinacao_1 text,
  inclinacao_2 text,
  torcao_relativa numeric,
  altura_ombreira_1 text,
  altura_ombreira_2 text,
  posicao_insertos text,
  montagem_fixacoes text,

  comprimento_mm numeric,
  largura_apoio_sup_mm numeric,
  largura_apoio_inf_mm numeric,
  altura_apoio_mm numeric,
  largura_centro_sup_mm numeric,
  largura_centro_inf_mm numeric,
  altura_centro_mm numeric,

  momento_pos_apoio text,
  momento_neg_apoio text,
  momento_pos_centro text,
  momento_neg_centro text,
  arrancamento_ombreiras text,
  precarga_usp_kgf numeric,
  carga_max_usp_kgf numeric,
  resultado_usp text,
  torcao_ombreiras text,
  aderencia_carga_final text,

  executor text,
  relatorio_fotografico text,
  fiscalizacao text,
  resultado resultado_ensaio not null default 'Pendente',
  observacoes text,

  producao_lote_id uuid references conprem_producao_lotes(id) on delete set null,
  criado_por uuid references auth.users(id),
  atualizado_por uuid references auth.users(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table conprem_ensaios_dormentes is
  'Ensaio de Dormentes (FR.10/08) da CONPREM, com as 45 colunas do relatório. Não confundir com conprem_ensaios_liberacao, que guarda a decisão de liberação de série.';

create index conprem_ensaios_dormentes_lote_idx on conprem_ensaios_dormentes (lote_ensaiado);
create index conprem_ensaios_dormentes_data_idx on conprem_ensaios_dormentes (data_ensaio desc);

create trigger trg_conprem_ensaios_dormentes_preencher_auditoria
  before insert or update on conprem_ensaios_dormentes
  for each row execute function preencher_campos_auditoria();
create trigger trg_conprem_ensaios_dormentes_atualizado_em
  before update on conprem_ensaios_dormentes
  for each row execute function set_atualizado_em();
create trigger trg_conprem_ensaios_dormentes_registrar_auditoria
  after insert or update or delete on conprem_ensaios_dormentes
  for each row execute function registrar_auditoria_alteracao();

alter table conprem_ensaios_dormentes enable row level security;
create policy conprem_ensaios_dormentes_select_usuarios_ativos on conprem_ensaios_dormentes
  for select to authenticated using (usuario_ativo());
create policy conprem_ensaios_dormentes_insert_admin_fiscalizacao on conprem_ensaios_dormentes
  for insert to authenticated with check (pode_escrever());
create policy conprem_ensaios_dormentes_update_admin_fiscalizacao on conprem_ensaios_dormentes
  for update to authenticated using (pode_escrever()) with check (pode_escrever());
create policy conprem_ensaios_dormentes_delete_admin on conprem_ensaios_dormentes
  for delete to authenticated using (eh_admin());

-- CREATE TABLE não herda privilégios: sem isto o PostgREST barra antes da RLS.
grant select, insert, update, delete on public.conprem_ensaios_dormentes to authenticated;
grant select, insert, update on public.conprem_ensaios_dormentes to service_role;
revoke all on public.conprem_ensaios_dormentes from anon;
