-- =====================================================================
-- Configurações do Sistema — parâmetros administrados pelo Admin
-- Primeira chave criada: custo_dormente, usada pelo Indicador Semanal
-- para calcular o Custo da Não Qualidade:
--   refugos da semana × custo unitário do dormente.
-- Rode este script no SQL Editor do Supabase UMA vez.
-- Reaproveita as funções já criadas em 2026-05-26-perfis-e-rls.sql:
--   usuario_ativo(), eh_admin(),
--   preencher_campos_auditoria(), registrar_auditoria_alteracao()
-- =====================================================================

create extension if not exists "pgcrypto";

create table if not exists public.configuracoes_sistema (
  id              uuid primary key default gen_random_uuid(),
  chave           text not null unique,
  valor           text,
  descricao       text,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz,
  criado_por      uuid,
  atualizado_por  uuid
);

create index if not exists idx_configuracoes_sistema_chave
  on public.configuracoes_sistema (chave);

-- Linha única usada pelo Indicador Semanal. O valor fica como TEXT no
-- padrão pt-BR (ex.: "850,00"), igual aos demais campos de valores do
-- sistema. Vazio significa "ainda não configurado".
insert into public.configuracoes_sistema (chave, valor, descricao)
values (
  'custo_dormente',
  '',
  'Custo unitário (R$) do dormente de concreto. O Indicador Semanal multiplica os dormentes reprovados da semana por este valor para calcular o Custo da Não Qualidade.'
)
on conflict (chave) do nothing;

-- Auditoria (preenche criado/atualizado e registra alterações)
drop trigger if exists trg_configuracoes_sistema_preencher_auditoria on public.configuracoes_sistema;
create trigger trg_configuracoes_sistema_preencher_auditoria
before insert or update on public.configuracoes_sistema
for each row execute function public.preencher_campos_auditoria();

drop trigger if exists trg_configuracoes_sistema_registrar_auditoria on public.configuracoes_sistema;
create trigger trg_configuracoes_sistema_registrar_auditoria
after insert or update or delete on public.configuracoes_sistema
for each row execute function public.registrar_auditoria_alteracao();

-- RLS — consulta para usuários ativos; escrita somente admin
alter table public.configuracoes_sistema enable row level security;
revoke all on table public.configuracoes_sistema from anon;
grant select, insert, update, delete on table public.configuracoes_sistema to authenticated;

drop policy if exists "configuracoes_sistema_select_usuarios_ativos" on public.configuracoes_sistema;
drop policy if exists "configuracoes_sistema_insert_admin" on public.configuracoes_sistema;
drop policy if exists "configuracoes_sistema_update_admin" on public.configuracoes_sistema;
drop policy if exists "configuracoes_sistema_delete_admin" on public.configuracoes_sistema;

create policy "configuracoes_sistema_select_usuarios_ativos"
on public.configuracoes_sistema
for select
to authenticated
using (public.usuario_ativo());

create policy "configuracoes_sistema_insert_admin"
on public.configuracoes_sistema
for insert
to authenticated
with check (public.eh_admin());

create policy "configuracoes_sistema_update_admin"
on public.configuracoes_sistema
for update
to authenticated
using (public.eh_admin())
with check (public.eh_admin());

create policy "configuracoes_sistema_delete_admin"
on public.configuracoes_sistema
for delete
to authenticated
using (public.eh_admin());
