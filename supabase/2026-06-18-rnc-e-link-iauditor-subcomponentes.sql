/* =====================================================================
   RNC + LINK DO RELATÓRIO IAUDITOR — Subcomponentes / Supabase

   Rode este arquivo no Supabase SQL Editor DEPOIS de:
   - supabase/2026-05-26-perfis-e-rls.sql (funções usuario_ativo/eh_admin/auditoria)
   - supabase/2026-05-31-subcomponentes-integrado-concreto.sql (tabelas base)

   Conteúdo:
   1) Adiciona a coluna opcional link_iauditor em inspecoes_subcomponentes.
   2) Cria a tabela rnc_subcomponentes (quadros de aviso de Não Conformidade).

   Regras de acesso da RNC:
   - admin: cria, edita e exclui os quadros de aviso.
   - fiscalizacao: apenas visualiza.
   - consulta: apenas visualiza.
   ===================================================================== */

create extension if not exists "pgcrypto";

/* ---------------------------------------------------------------------
   1) Link opcional do relatório do iAuditor por inspeção
   --------------------------------------------------------------------- */
alter table public.inspecoes_subcomponentes
  add column if not exists link_iauditor text;

/* ---------------------------------------------------------------------
   2) Tabela dos quadros de aviso de RNC
      Cada linha é um quadro de aviso com uma não conformidade.
   --------------------------------------------------------------------- */
create table if not exists public.rnc_subcomponentes (
  id uuid primary key default gen_random_uuid(),
  titulo text not null default 'Não conformidade',
  conteudo text not null default '',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete set null,
  atualizado_por uuid references auth.users(id) on delete set null
);

alter table public.rnc_subcomponentes
  add column if not exists titulo text not null default 'Não conformidade',
  add column if not exists conteudo text not null default '',
  add column if not exists criado_em timestamptz not null default now(),
  add column if not exists atualizado_em timestamptz not null default now(),
  add column if not exists criado_por uuid references auth.users(id) on delete set null,
  add column if not exists atualizado_por uuid references auth.users(id) on delete set null;

create index if not exists idx_rnc_subcomponentes_criado_em on public.rnc_subcomponentes (criado_em desc);

/* ---------------------------------------------------------------------
   Timestamps/usuário (reaproveita a função genérica do sistema)
   --------------------------------------------------------------------- */
drop trigger if exists trg_rnc_subcomponentes_preencher_auditoria on public.rnc_subcomponentes;
create trigger trg_rnc_subcomponentes_preencher_auditoria
before insert or update on public.rnc_subcomponentes
for each row execute function public.preencher_campos_auditoria();

/* Se a auditoria geral já existir, registra as alterações da RNC também. */
do $$
begin
  if to_regprocedure('public.registrar_auditoria_alteracao()') is not null then
    execute 'drop trigger if exists trg_rnc_subcomponentes_registrar_auditoria on public.rnc_subcomponentes';
    execute 'create trigger trg_rnc_subcomponentes_registrar_auditoria after insert or update or delete on public.rnc_subcomponentes for each row execute function public.registrar_auditoria_alteracao()';
  end if;
end $$;

/* ---------------------------------------------------------------------
   RLS — ver para todos os usuários ativos; gravar só admin
   --------------------------------------------------------------------- */
alter table public.rnc_subcomponentes enable row level security;

revoke all on table public.rnc_subcomponentes from anon;
grant select, insert, update, delete on table public.rnc_subcomponentes to authenticated;

drop policy if exists "rnc_subcomponentes_select_usuarios_ativos" on public.rnc_subcomponentes;
drop policy if exists "rnc_subcomponentes_insert_admin" on public.rnc_subcomponentes;
drop policy if exists "rnc_subcomponentes_update_admin" on public.rnc_subcomponentes;
drop policy if exists "rnc_subcomponentes_delete_admin" on public.rnc_subcomponentes;

create policy "rnc_subcomponentes_select_usuarios_ativos"
on public.rnc_subcomponentes
for select
to authenticated
using (public.usuario_ativo());

create policy "rnc_subcomponentes_insert_admin"
on public.rnc_subcomponentes
for insert
to authenticated
with check (public.eh_admin());

create policy "rnc_subcomponentes_update_admin"
on public.rnc_subcomponentes
for update
to authenticated
using (public.eh_admin())
with check (public.eh_admin());

create policy "rnc_subcomponentes_delete_admin"
on public.rnc_subcomponentes
for delete
to authenticated
using (public.eh_admin());

/* ---------------------------------------------------------------------
   Verificação rápida
   ---------------------------------------------------------------------

   select count(*) from public.rnc_subcomponentes;
   select column_name from information_schema.columns
     where table_name = 'inspecoes_subcomponentes' and column_name = 'link_iauditor';
*/
