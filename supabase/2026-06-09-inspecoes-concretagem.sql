-- =====================================================================
-- Inspeções de Concretagem — histórico consultivo independente
-- Rode este script no SQL Editor do Supabase UMA vez.
-- Reaproveita as funções já criadas em 2026-05-26-perfis-e-rls.sql:
--   usuario_ativo(), pode_escrever(), eh_admin(),
--   preencher_campos_auditoria(), registrar_auditoria_alteracao()
-- =====================================================================

create table if not exists public.inspecoes_concretagem (
  id                       uuid primary key default gen_random_uuid(),
  data_inspecao            date,
  lote                     text,
  projeto                  text,
  bitola                   text,
  fornecedor               text,
  pista                    text,
  molde                    text,
  cavidade                 text,
  quantidade_produzida     text,
  slump_abatimento         text,
  slump_espalhamento       text,
  temperatura_lancamento   text,
  resultado                text,
  responsavel              text,
  link_relatorio           text,
  arquivo_origem           text,
  observacoes              text,
  criado_em                timestamptz not null default now(),
  atualizado_em            timestamptz,
  criado_por               uuid,
  atualizado_por           uuid
);

-- Índices para os filtros da tela
create index if not exists idx_inspecoes_concretagem_data
  on public.inspecoes_concretagem (data_inspecao);
create index if not exists idx_inspecoes_concretagem_filtros
  on public.inspecoes_concretagem (fornecedor, projeto, bitola, resultado);
create index if not exists idx_inspecoes_concretagem_lote
  on public.inspecoes_concretagem (lote);
create index if not exists idx_inspecoes_concretagem_pista_molde
  on public.inspecoes_concretagem (pista, molde);

-- Auditoria (preenche criado/atualizado e registra alterações)
drop trigger if exists trg_inspecoes_concretagem_preencher_auditoria on public.inspecoes_concretagem;
create trigger trg_inspecoes_concretagem_preencher_auditoria
before insert or update on public.inspecoes_concretagem
for each row execute function public.preencher_campos_auditoria();

drop trigger if exists trg_inspecoes_concretagem_registrar_auditoria on public.inspecoes_concretagem;
create trigger trg_inspecoes_concretagem_registrar_auditoria
after insert or update or delete on public.inspecoes_concretagem
for each row execute function public.registrar_auditoria_alteracao();

-- RLS — consulta para usuários ativos; escrita para admin/fiscalização; exclusão só admin
alter table public.inspecoes_concretagem enable row level security;
revoke all on table public.inspecoes_concretagem from anon;
grant select, insert, update, delete on table public.inspecoes_concretagem to authenticated;

drop policy if exists "inspecoes_concretagem_select_usuarios_ativos" on public.inspecoes_concretagem;
create policy "inspecoes_concretagem_select_usuarios_ativos"
on public.inspecoes_concretagem
for select
to authenticated
using (public.usuario_ativo());

drop policy if exists "inspecoes_concretagem_insert_admin_fiscalizacao" on public.inspecoes_concretagem;
create policy "inspecoes_concretagem_insert_admin_fiscalizacao"
on public.inspecoes_concretagem
for insert
to authenticated
with check (public.pode_escrever());

drop policy if exists "inspecoes_concretagem_update_admin_fiscalizacao" on public.inspecoes_concretagem;
create policy "inspecoes_concretagem_update_admin_fiscalizacao"
on public.inspecoes_concretagem
for update
to authenticated
using (public.pode_escrever())
with check (public.pode_escrever());

drop policy if exists "inspecoes_concretagem_delete_admin" on public.inspecoes_concretagem;
create policy "inspecoes_concretagem_delete_admin"
on public.inspecoes_concretagem
for delete
to authenticated
using (public.eh_admin());
