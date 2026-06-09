-- =====================================================================
-- Ensaios de Arrancamento USP — histórico consultivo independente
-- Rode este script no SQL Editor do Supabase UMA vez.
-- Reaproveita as funções já criadas em 2026-05-26-perfis-e-rls.sql:
--   usuario_ativo(), pode_escrever(), eh_admin(),
--   preencher_campos_auditoria(), registrar_auditoria_alteracao()
-- =====================================================================

create table if not exists public.ensaios_arrancamento_usp (
  id              uuid primary key default gen_random_uuid(),
  data_ensaio     date,
  lote            text,
  projeto         text,
  bitola          text,
  fornecedor      text,
  usp             text,
  tipo_ombreira   text,
  lote_ombreira   text,
  arrancamento_a  text,
  arrancamento_b  text,
  arrancamento_c  text,
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
create index if not exists idx_ensaios_arrancamento_usp_data
  on public.ensaios_arrancamento_usp (data_ensaio);
create index if not exists idx_ensaios_arrancamento_usp_filtros
  on public.ensaios_arrancamento_usp (fornecedor, projeto, bitola, resultado);
create index if not exists idx_ensaios_arrancamento_usp_lote
  on public.ensaios_arrancamento_usp (lote);
create index if not exists idx_ensaios_arrancamento_usp_usp
  on public.ensaios_arrancamento_usp (usp);

-- Auditoria (preenche criado/atualizado e registra alterações)
drop trigger if exists trg_ensaios_arrancamento_usp_preencher_auditoria on public.ensaios_arrancamento_usp;
create trigger trg_ensaios_arrancamento_usp_preencher_auditoria
before insert or update on public.ensaios_arrancamento_usp
for each row execute function public.preencher_campos_auditoria();

drop trigger if exists trg_ensaios_arrancamento_usp_registrar_auditoria on public.ensaios_arrancamento_usp;
create trigger trg_ensaios_arrancamento_usp_registrar_auditoria
after insert or update or delete on public.ensaios_arrancamento_usp
for each row execute function public.registrar_auditoria_alteracao();

-- RLS — consulta para usuários ativos; escrita para admin/fiscalização; exclusão só admin
alter table public.ensaios_arrancamento_usp enable row level security;
revoke all on table public.ensaios_arrancamento_usp from anon;
grant select, insert, update, delete on table public.ensaios_arrancamento_usp to authenticated;

drop policy if exists "ensaios_arrancamento_usp_select_usuarios_ativos" on public.ensaios_arrancamento_usp;
create policy "ensaios_arrancamento_usp_select_usuarios_ativos"
on public.ensaios_arrancamento_usp
for select
to authenticated
using (public.usuario_ativo());

drop policy if exists "ensaios_arrancamento_usp_insert_admin_fiscalizacao" on public.ensaios_arrancamento_usp;
create policy "ensaios_arrancamento_usp_insert_admin_fiscalizacao"
on public.ensaios_arrancamento_usp
for insert
to authenticated
with check (public.pode_escrever());

drop policy if exists "ensaios_arrancamento_usp_update_admin_fiscalizacao" on public.ensaios_arrancamento_usp;
create policy "ensaios_arrancamento_usp_update_admin_fiscalizacao"
on public.ensaios_arrancamento_usp
for update
to authenticated
using (public.pode_escrever())
with check (public.pode_escrever());

drop policy if exists "ensaios_arrancamento_usp_delete_admin" on public.ensaios_arrancamento_usp;
create policy "ensaios_arrancamento_usp_delete_admin"
on public.ensaios_arrancamento_usp
for delete
to authenticated
using (public.eh_admin());
