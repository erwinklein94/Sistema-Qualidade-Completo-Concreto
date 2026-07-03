-- =====================================================================
-- Ensaios de Acompanhamento (14 dias · Cura Térmica) — registro sem liberação
-- Rode este script no SQL Editor do Supabase UMA vez.
--
-- Motivo:
-- Lotes marcados como CURA TÉRMICA na Produção exigem um ensaio de
-- ACOMPANHAMENTO aos 14 dias após a produção. Esse ensaio é apenas
-- registrado no sistema (com relatório iAuditor) e NÃO libera a série:
-- a liberação continua acontecendo somente pelos Ensaios de Liberação.
--
-- Reaproveita as funções já criadas em 2026-05-26-perfis-e-rls.sql:
--   usuario_ativo(), pode_escrever(), eh_admin(),
--   preencher_campos_auditoria(), registrar_auditoria_alteracao()
-- Idempotente: rodar duas vezes não altera nada.
-- =====================================================================

create table if not exists public.ensaios_acompanhamento (
  id                      uuid primary key default gen_random_uuid(),
  producao_lote_id        uuid,
  data_ensaio             date,
  data_producao           date,
  semana                  int,
  ano                     int,
  periodo_inicio          date,
  periodo_fim             date,
  fornecedor              text,
  projeto                 text,
  bitola                  text,
  lote_ensaiado           text,
  serie                   text,
  resultado               text,
  quantidade_ensaiada     int,
  responsavel             text,
  link_relatorio_iauditor text,
  arquivo_origem          text,
  observacoes             text,
  criado_em               timestamptz not null default now(),
  atualizado_em           timestamptz,
  criado_por              uuid,
  atualizado_por          uuid
);

-- Índices para os filtros da tela
create index if not exists idx_ensaios_acompanhamento_data
  on public.ensaios_acompanhamento (data_ensaio);
create index if not exists idx_ensaios_acompanhamento_lote
  on public.ensaios_acompanhamento (lote_ensaiado);
create index if not exists idx_ensaios_acompanhamento_producao_lote
  on public.ensaios_acompanhamento (producao_lote_id);
create index if not exists idx_ensaios_acompanhamento_filtros
  on public.ensaios_acompanhamento (fornecedor, projeto, bitola, resultado);

-- Auditoria (preenche criado/atualizado e registra alterações)
drop trigger if exists trg_ensaios_acompanhamento_preencher_auditoria on public.ensaios_acompanhamento;
create trigger trg_ensaios_acompanhamento_preencher_auditoria
before insert or update on public.ensaios_acompanhamento
for each row execute function public.preencher_campos_auditoria();

drop trigger if exists trg_ensaios_acompanhamento_registrar_auditoria on public.ensaios_acompanhamento;
create trigger trg_ensaios_acompanhamento_registrar_auditoria
after insert or update or delete on public.ensaios_acompanhamento
for each row execute function public.registrar_auditoria_alteracao();

-- RLS — mesmo modelo dos ensaios de liberação
alter table public.ensaios_acompanhamento enable row level security;
revoke all on table public.ensaios_acompanhamento from anon;
grant select, insert, update, delete on table public.ensaios_acompanhamento to authenticated;

drop policy if exists "ensaios_acompanhamento_select_usuarios_ativos" on public.ensaios_acompanhamento;
create policy "ensaios_acompanhamento_select_usuarios_ativos"
on public.ensaios_acompanhamento
for select
to authenticated
using (public.usuario_ativo());

drop policy if exists "ensaios_acompanhamento_insert_admin_fiscalizacao" on public.ensaios_acompanhamento;
create policy "ensaios_acompanhamento_insert_admin_fiscalizacao"
on public.ensaios_acompanhamento
for insert
to authenticated
with check (public.pode_escrever());

drop policy if exists "ensaios_acompanhamento_update_admin_fiscalizacao" on public.ensaios_acompanhamento;
create policy "ensaios_acompanhamento_update_admin_fiscalizacao"
on public.ensaios_acompanhamento
for update
to authenticated
using (public.pode_escrever())
with check (public.pode_escrever());

drop policy if exists "ensaios_acompanhamento_delete_admin" on public.ensaios_acompanhamento;
create policy "ensaios_acompanhamento_delete_admin"
on public.ensaios_acompanhamento
for delete
to authenticated
using (public.eh_admin());
