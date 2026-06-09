-- =====================================================================
-- Ensaios de Bitola — histórico consultivo independente
-- Rode este script no SQL Editor do Supabase UMA vez.
-- Reaproveita as funções já criadas em 2026-05-26-perfis-e-rls.sql:
--   usuario_ativo(), pode_escrever(), eh_admin(),
--   preencher_campos_auditoria(), registrar_auditoria_alteracao()
-- =====================================================================

create table if not exists public.ensaios_bitola (
  id              uuid primary key default gen_random_uuid(),
  data_ensaio     date,
  lote            text,
  projeto         text,
  bitola          text,
  fornecedor      text,
  resultado       text,
  responsavel     text,
  link_relatorio  text,
  arquivo_origem  text,
  observacoes     text,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz,
  criado_por      uuid,
  atualizado_por  uuid
);

-- Índices para os filtros da tela
create index if not exists idx_ensaios_bitola_data
  on public.ensaios_bitola (data_ensaio);
create index if not exists idx_ensaios_bitola_filtros
  on public.ensaios_bitola (projeto, bitola, resultado);
create index if not exists idx_ensaios_bitola_lote
  on public.ensaios_bitola (lote);

-- Auditoria (preenche criado/atualizado e registra alterações)
drop trigger if exists trg_ensaios_bitola_preencher_auditoria on public.ensaios_bitola;
create trigger trg_ensaios_bitola_preencher_auditoria
before insert or update on public.ensaios_bitola
for each row execute function public.preencher_campos_auditoria();

drop trigger if exists trg_ensaios_bitola_registrar_auditoria on public.ensaios_bitola;
create trigger trg_ensaios_bitola_registrar_auditoria
after insert or update or delete on public.ensaios_bitola
for each row execute function public.registrar_auditoria_alteracao();

-- RLS — mesmo modelo dos ensaios de liberação
alter table public.ensaios_bitola enable row level security;
revoke all on table public.ensaios_bitola from anon;
grant select, insert, update, delete on table public.ensaios_bitola to authenticated;

drop policy if exists "ensaios_bitola_select_usuarios_ativos" on public.ensaios_bitola;
create policy "ensaios_bitola_select_usuarios_ativos"
on public.ensaios_bitola
for select
to authenticated
using (public.usuario_ativo());

drop policy if exists "ensaios_bitola_insert_admin_fiscalizacao" on public.ensaios_bitola;
create policy "ensaios_bitola_insert_admin_fiscalizacao"
on public.ensaios_bitola
for insert
to authenticated
with check (public.pode_escrever());

drop policy if exists "ensaios_bitola_update_admin_fiscalizacao" on public.ensaios_bitola;
create policy "ensaios_bitola_update_admin_fiscalizacao"
on public.ensaios_bitola
for update
to authenticated
using (public.pode_escrever())
with check (public.pode_escrever());

drop policy if exists "ensaios_bitola_delete_admin" on public.ensaios_bitola;
create policy "ensaios_bitola_delete_admin"
on public.ensaios_bitola
for delete
to authenticated
using (public.eh_admin());
