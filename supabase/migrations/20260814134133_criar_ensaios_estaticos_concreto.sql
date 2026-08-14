-- =====================================================================
-- Ensaios Estáticos Concreto — formulário de rastreabilidade Cavan
-- Histórico independente; integração com producao_lotes em etapa futura.
-- =====================================================================

create table if not exists public.ensaios_estaticos_concreto (
  id                                uuid primary key default gen_random_uuid(),
  cliente                           text not null default 'RUMO',
  projeto                           text not null,
  lote                              text not null,
  pista                             text not null,
  data_moldagem                     date not null,
  hora_moldagem                     time,

  slump_abatimento_1                numeric(8,2) check (slump_abatimento_1 >= 0),
  slump_abatimento_2                numeric(8,2) check (slump_abatimento_2 >= 0),
  slump_abatimento_3                numeric(8,2) check (slump_abatimento_3 >= 0),
  slump_espalhamento_1              numeric(8,2) check (slump_espalhamento_1 >= 0),
  slump_espalhamento_2              numeric(8,2) check (slump_espalhamento_2 >= 0),
  slump_espalhamento_3              numeric(8,2) check (slump_espalhamento_3 >= 0),

  desprotensao_em                   timestamptz,
  desprotensao_resistencia_1        numeric(8,2) check (desprotensao_resistencia_1 >= 0),
  desprotensao_resistencia_2        numeric(8,2) check (desprotensao_resistencia_2 >= 0),
  desprotensao_resistencia_3        numeric(8,2) check (desprotensao_resistencia_3 >= 0),

  ensaio_7_em                       date,
  compressao_7_cp1                  numeric(8,2) check (compressao_7_cp1 >= 0),
  compressao_7_cp2                  numeric(8,2) check (compressao_7_cp2 >= 0),
  compressao_7_cp3                  numeric(8,2) check (compressao_7_cp3 >= 0),
  tracao_7_cp1                      numeric(8,2) check (tracao_7_cp1 >= 0),
  tracao_7_cp2                      numeric(8,2) check (tracao_7_cp2 >= 0),
  tracao_7_cp3                      numeric(8,2) check (tracao_7_cp3 >= 0),

  ensaio_14_em                      date,
  compressao_14_cp1                 numeric(8,2) check (compressao_14_cp1 >= 0),
  compressao_14_cp2                 numeric(8,2) check (compressao_14_cp2 >= 0),
  compressao_14_cp3                 numeric(8,2) check (compressao_14_cp3 >= 0),
  tracao_14_cp1                     numeric(8,2) check (tracao_14_cp1 >= 0),
  tracao_14_cp2                     numeric(8,2) check (tracao_14_cp2 >= 0),
  tracao_14_cp3                     numeric(8,2) check (tracao_14_cp3 >= 0),

  ensaio_28_em                      date,
  compressao_28_cp1                 numeric(8,2) check (compressao_28_cp1 >= 0),
  compressao_28_cp2                 numeric(8,2) check (compressao_28_cp2 >= 0),
  compressao_28_cp3                 numeric(8,2) check (compressao_28_cp3 >= 0),
  tracao_28_cp1                     numeric(8,2) check (tracao_28_cp1 >= 0),
  tracao_28_cp2                     numeric(8,2) check (tracao_28_cp2 >= 0),
  tracao_28_cp3                     numeric(8,2) check (tracao_28_cp3 >= 0),

  responsavel                       text,
  observacoes                       text,
  criado_em                         timestamptz not null default now(),
  atualizado_em                     timestamptz,
  criado_por                        uuid,
  atualizado_por                    uuid
);

comment on table public.ensaios_estaticos_concreto is
  'Histórico independente do formulário de ensaios estáticos de concreto da Cavan.';

create index if not exists idx_ensaios_estaticos_concreto_data
  on public.ensaios_estaticos_concreto (data_moldagem desc, hora_moldagem desc, criado_em desc);
create index if not exists idx_ensaios_estaticos_concreto_lote
  on public.ensaios_estaticos_concreto (lote);
create index if not exists idx_ensaios_estaticos_concreto_filtros
  on public.ensaios_estaticos_concreto (cliente, projeto, pista);

drop trigger if exists trg_ensaios_estaticos_preencher_auditoria on public.ensaios_estaticos_concreto;
create trigger trg_ensaios_estaticos_preencher_auditoria
before insert or update on public.ensaios_estaticos_concreto
for each row execute function public.preencher_campos_auditoria();

drop trigger if exists trg_ensaios_estaticos_registrar_auditoria on public.ensaios_estaticos_concreto;
create trigger trg_ensaios_estaticos_registrar_auditoria
after insert or update or delete on public.ensaios_estaticos_concreto
for each row execute function public.registrar_auditoria_alteracao();

alter table public.ensaios_estaticos_concreto enable row level security;
revoke all on table public.ensaios_estaticos_concreto from anon;
grant select, insert, update, delete on table public.ensaios_estaticos_concreto to authenticated;

drop policy if exists "ensaios_estaticos_select_usuarios_ativos" on public.ensaios_estaticos_concreto;
create policy "ensaios_estaticos_select_usuarios_ativos"
on public.ensaios_estaticos_concreto
for select
to authenticated
using (public.usuario_ativo());

drop policy if exists "ensaios_estaticos_insert_admin_fiscalizacao" on public.ensaios_estaticos_concreto;
create policy "ensaios_estaticos_insert_admin_fiscalizacao"
on public.ensaios_estaticos_concreto
for insert
to authenticated
with check (public.pode_escrever());

drop policy if exists "ensaios_estaticos_update_admin_fiscalizacao" on public.ensaios_estaticos_concreto;
create policy "ensaios_estaticos_update_admin_fiscalizacao"
on public.ensaios_estaticos_concreto
for update
to authenticated
using (public.pode_escrever())
with check (public.pode_escrever());

drop policy if exists "ensaios_estaticos_delete_admin" on public.ensaios_estaticos_concreto;
create policy "ensaios_estaticos_delete_admin"
on public.ensaios_estaticos_concreto
for delete
to authenticated
using (public.eh_admin());
