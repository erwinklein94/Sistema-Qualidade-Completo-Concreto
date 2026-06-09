-- =====================================================================
-- Inspeções de Pista — histórico consultivo independente
-- Rode este script no SQL Editor do Supabase UMA vez.
-- Reaproveita as funções já criadas em 2026-05-26-perfis-e-rls.sql:
--   usuario_ativo(), pode_escrever(), eh_admin(),
--   preencher_campos_auditoria(), registrar_auditoria_alteracao()
-- =====================================================================

create table if not exists public.inspecoes_pista (
  id                       uuid primary key default gen_random_uuid(),
  data_inspecao            date,
  lote                     text,
  projeto                  text,
  bitola                   text,
  fornecedor               text,
  pista                    text,
  trecho_posicao           text,
  molde                    text,
  cavidade                 text,
  atividade                text,
  itens_inspecionados      text,
  nao_conformidades        text,
  acoes_corretivas         text,
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
create index if not exists idx_inspecoes_pista_data
  on public.inspecoes_pista (data_inspecao);
create index if not exists idx_inspecoes_pista_filtros
  on public.inspecoes_pista (fornecedor, projeto, bitola, resultado);
create index if not exists idx_inspecoes_pista_lote
  on public.inspecoes_pista (lote);
create index if not exists idx_inspecoes_pista_pista_molde
  on public.inspecoes_pista (pista, molde);

-- Auditoria (preenche criado/atualizado e registra alterações)
drop trigger if exists trg_inspecoes_pista_preencher_auditoria on public.inspecoes_pista;
create trigger trg_inspecoes_pista_preencher_auditoria
before insert or update on public.inspecoes_pista
for each row execute function public.preencher_campos_auditoria();

drop trigger if exists trg_inspecoes_pista_registrar_auditoria on public.inspecoes_pista;
create trigger trg_inspecoes_pista_registrar_auditoria
after insert or update or delete on public.inspecoes_pista
for each row execute function public.registrar_auditoria_alteracao();

-- RLS — consulta para usuários ativos; escrita para admin/fiscalização; exclusão só admin
alter table public.inspecoes_pista enable row level security;
revoke all on table public.inspecoes_pista from anon;
grant select, insert, update, delete on table public.inspecoes_pista to authenticated;

drop policy if exists "inspecoes_pista_select_usuarios_ativos" on public.inspecoes_pista;
create policy "inspecoes_pista_select_usuarios_ativos"
on public.inspecoes_pista
for select
to authenticated
using (public.usuario_ativo());

drop policy if exists "inspecoes_pista_insert_admin_fiscalizacao" on public.inspecoes_pista;
create policy "inspecoes_pista_insert_admin_fiscalizacao"
on public.inspecoes_pista
for insert
to authenticated
with check (public.pode_escrever());

drop policy if exists "inspecoes_pista_update_admin_fiscalizacao" on public.inspecoes_pista;
create policy "inspecoes_pista_update_admin_fiscalizacao"
on public.inspecoes_pista
for update
to authenticated
using (public.pode_escrever())
with check (public.pode_escrever());

drop policy if exists "inspecoes_pista_delete_admin" on public.inspecoes_pista;
create policy "inspecoes_pista_delete_admin"
on public.inspecoes_pista
for delete
to authenticated
using (public.eh_admin());
