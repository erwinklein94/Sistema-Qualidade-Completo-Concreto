/* =====================================================================
   RNC — Dormentes de Concreto / Supabase

   Rode este arquivo no Supabase SQL Editor depois das migrations de
   perfis/RLS/auditoria do sistema.

   Regras de acesso:
   - admin: cria, edita e exclui quadros de aviso.
   - fiscalizacao e consulta: apenas visualizam.
   ===================================================================== */

create extension if not exists "pgcrypto";

create table if not exists public.rnc_dormentes (
  id uuid primary key default gen_random_uuid(),
  titulo text not null default 'Não conformidade',
  conteudo text not null default '',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete set null,
  atualizado_por uuid references auth.users(id) on delete set null
);

alter table public.rnc_dormentes
  add column if not exists titulo text not null default 'Não conformidade',
  add column if not exists conteudo text not null default '',
  add column if not exists criado_em timestamptz not null default now(),
  add column if not exists atualizado_em timestamptz not null default now(),
  add column if not exists criado_por uuid references auth.users(id) on delete set null,
  add column if not exists atualizado_por uuid references auth.users(id) on delete set null;

create index if not exists idx_rnc_dormentes_criado_em on public.rnc_dormentes (criado_em desc);

drop trigger if exists trg_rnc_dormentes_preencher_auditoria on public.rnc_dormentes;
create trigger trg_rnc_dormentes_preencher_auditoria
before insert or update on public.rnc_dormentes
for each row execute function public.preencher_campos_auditoria();

/* Se a auditoria geral existir, registra criação/edição/exclusão da RNC. */
do $$
begin
  if to_regprocedure('public.registrar_auditoria_alteracao()') is not null then
    execute 'drop trigger if exists trg_rnc_dormentes_registrar_auditoria on public.rnc_dormentes';
    execute 'create trigger trg_rnc_dormentes_registrar_auditoria after insert or update or delete on public.rnc_dormentes for each row execute function public.registrar_auditoria_alteracao()';
  end if;
end $$;

alter table public.rnc_dormentes enable row level security;

revoke all on table public.rnc_dormentes from anon;
grant select, insert, update, delete on table public.rnc_dormentes to authenticated;

drop policy if exists "rnc_dormentes_select_usuarios_ativos" on public.rnc_dormentes;
drop policy if exists "rnc_dormentes_insert_admin" on public.rnc_dormentes;
drop policy if exists "rnc_dormentes_update_admin" on public.rnc_dormentes;
drop policy if exists "rnc_dormentes_delete_admin" on public.rnc_dormentes;

create policy "rnc_dormentes_select_usuarios_ativos"
on public.rnc_dormentes
for select
to authenticated
using (public.usuario_ativo());

create policy "rnc_dormentes_insert_admin"
on public.rnc_dormentes
for insert
to authenticated
with check (public.eh_admin());

create policy "rnc_dormentes_update_admin"
on public.rnc_dormentes
for update
to authenticated
using (public.eh_admin())
with check (public.eh_admin());

create policy "rnc_dormentes_delete_admin"
on public.rnc_dormentes
for delete
to authenticated
using (public.eh_admin());

/* Verificação rápida:
   select count(*) from public.rnc_dormentes;
*/
