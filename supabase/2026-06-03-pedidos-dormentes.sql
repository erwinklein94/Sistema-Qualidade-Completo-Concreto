/* =====================================================================
   PEDIDOS DE DORMENTES DE CONCRETO

   Rode no Supabase > SQL Editor depois do arquivo de perfis/RLS.

   Cria a tabela public.pedidos_dormentes para controlar pedidos feitos
   pela Rumo aos fornecedores Cavan ou Conprem. Cada registro representa
   um pedido e permite manter uma lista editável de lotes previstos.
   ===================================================================== */

create extension if not exists "pgcrypto";

grant usage on schema public to authenticated;

/* Funções de perfil usadas pelas policies. Mantidas idempotentes para que
   este arquivo também funcione quando executado isoladamente depois da
   criação de usuarios_app. */
create or replace function public.normalizar_perfil(valor text)
returns text
language sql
immutable
as $$
  select case
    when translate(lower(trim(coalesce(valor, ''))), 'áàâãéêíóôõúüç', 'aaaaeeiooouuc') = 'admin' then 'admin'
    when translate(lower(trim(coalesce(valor, ''))), 'áàâãéêíóôõúüç', 'aaaaeeiooouuc') in ('qualidade', 'fiscalizacao') then 'fiscalizacao'
    else 'consulta'
  end;
$$;

create or replace function public.usuario_ativo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.usuarios_app u
    where u.id = auth.uid()
      and u.ativo is true
  );
$$;

create or replace function public.perfil_usuario_atual()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select public.normalizar_perfil(u.perfil::text)
    from public.usuarios_app u
    where u.id = auth.uid()
      and u.ativo is true
    limit 1
  ), 'consulta');
$$;

create or replace function public.eh_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.perfil_usuario_atual() = 'admin';
$$;

create or replace function public.pode_escrever()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.perfil_usuario_atual() in ('admin', 'fiscalizacao');
$$;

grant execute on function public.normalizar_perfil(text) to authenticated;
grant execute on function public.usuario_ativo() to authenticated;
grant execute on function public.perfil_usuario_atual() to authenticated;
grant execute on function public.eh_admin() to authenticated;
grant execute on function public.pode_escrever() to authenticated;

create table if not exists public.pedidos_dormentes (
  id uuid primary key default gen_random_uuid(),
  fornecedor text not null,
  projeto text not null,
  numero_pedido text not null,
  quantidade_dormentes integer not null default 0 check (quantidade_dormentes >= 0),
  lotes_planejados text[] not null default '{}'::text[],
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete set null,
  atualizado_por uuid references auth.users(id) on delete set null
);

alter table public.pedidos_dormentes
  add column if not exists fornecedor text,
  add column if not exists projeto text,
  add column if not exists numero_pedido text,
  add column if not exists quantidade_dormentes integer not null default 0,
  add column if not exists lotes_planejados text[] not null default '{}'::text[],
  add column if not exists observacoes text,
  add column if not exists criado_em timestamptz not null default now(),
  add column if not exists atualizado_em timestamptz not null default now(),
  add column if not exists criado_por uuid references auth.users(id) on delete set null,
  add column if not exists atualizado_por uuid references auth.users(id) on delete set null;

alter table public.pedidos_dormentes
  alter column fornecedor set not null,
  alter column projeto set not null,
  alter column numero_pedido set not null,
  alter column quantidade_dormentes set default 0,
  alter column quantidade_dormentes set not null,
  alter column lotes_planejados set default '{}'::text[],
  alter column lotes_planejados set not null;

alter table public.pedidos_dormentes drop constraint if exists pedidos_dormentes_quantidade_check;
alter table public.pedidos_dormentes
  add constraint pedidos_dormentes_quantidade_check check (quantidade_dormentes >= 0);

create unique index if not exists idx_pedidos_dormentes_numero_unico
  on public.pedidos_dormentes (numero_pedido);
create index if not exists idx_pedidos_dormentes_fornecedor on public.pedidos_dormentes (fornecedor);
create index if not exists idx_pedidos_dormentes_projeto on public.pedidos_dormentes (projeto);
create index if not exists idx_pedidos_dormentes_criado_em on public.pedidos_dormentes (criado_em desc);

/* Triggers de auditoria, se as funções já existirem no banco. */
do $$
begin
  if to_regprocedure('public.preencher_campos_auditoria()') is not null then
    execute 'drop trigger if exists trg_pedidos_dormentes_preencher_auditoria on public.pedidos_dormentes';
    execute 'create trigger trg_pedidos_dormentes_preencher_auditoria before insert or update on public.pedidos_dormentes for each row execute function public.preencher_campos_auditoria()';
  end if;

  if to_regprocedure('public.registrar_auditoria_alteracao()') is not null then
    execute 'drop trigger if exists trg_pedidos_dormentes_registrar_auditoria on public.pedidos_dormentes';
    execute 'create trigger trg_pedidos_dormentes_registrar_auditoria after insert or update or delete on public.pedidos_dormentes for each row execute function public.registrar_auditoria_alteracao()';
  end if;
end $$;

alter table public.pedidos_dormentes enable row level security;

revoke all on table public.pedidos_dormentes from anon;
grant select, insert, update, delete on table public.pedidos_dormentes to authenticated;

drop policy if exists "pedidos_dormentes_select_usuarios_ativos" on public.pedidos_dormentes;
drop policy if exists "pedidos_dormentes_insert_admin_fiscalizacao" on public.pedidos_dormentes;
drop policy if exists "pedidos_dormentes_update_admin_fiscalizacao" on public.pedidos_dormentes;
drop policy if exists "pedidos_dormentes_delete_admin" on public.pedidos_dormentes;

create policy "pedidos_dormentes_select_usuarios_ativos"
on public.pedidos_dormentes
for select
to authenticated
using (public.usuario_ativo());

create policy "pedidos_dormentes_insert_admin_fiscalizacao"
on public.pedidos_dormentes
for insert
to authenticated
with check (public.pode_escrever());

create policy "pedidos_dormentes_update_admin_fiscalizacao"
on public.pedidos_dormentes
for update
to authenticated
using (public.pode_escrever())
with check (public.pode_escrever());

create policy "pedidos_dormentes_delete_admin"
on public.pedidos_dormentes
for delete
to authenticated
using (public.eh_admin());
