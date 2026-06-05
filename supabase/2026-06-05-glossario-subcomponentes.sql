-- =====================================================================
-- GLOSSÁRIO DE SUBCOMPONENTES — aba "Medidas e Tolerâncias" (Subcomponentes)
--
-- Cria a tabela que alimenta o botão "Glossário de subcomponentes" da página
-- Medidas e Tolerâncias. Cada linha é um subcomponente com:
--   - titulo     (nome do subcomponente)
--   - descricao  (texto explicativo)
--   - imagem     (foto WEBP gravada como data URL base64, dentro do banco)
--
-- Espelha a tabela public.glossario_defeitos (aba Reprovados) — mesma
-- estrutura, mesma regra de acesso.
--
-- Regra de acesso (igual às abas de Especificações do sistema):
--   - SELECT: qualquer usuário ativo (admin, fiscalizacao, consulta)
--   - INSERT/UPDATE/DELETE: somente admin
--
-- Observação sobre auditoria:
--   Esta tabela usa apenas o gatilho preencher_campos_auditoria (carimba
--   criado_por/atualizado_por/datas). NÃO usa o gatilho de log completo
--   (registrar_auditoria_alteracao) de propósito: ele copia a linha inteira
--   em jsonb para auditoria_alteracoes e isso duplicaria a foto base64 a
--   cada alteração, inchando a tabela de auditoria sem ganho real.
--
-- PRÉ-REQUISITO: rode antes o arquivo
--   supabase/2026-05-26-perfis-e-rls.sql
-- Ele cria as funções usadas aqui: public.usuario_ativo(), public.eh_admin()
-- e public.preencher_campos_auditoria().
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1) Tabela do glossário de subcomponentes
-- ---------------------------------------------------------------------
create table if not exists public.glossario_subcomponentes (
  id uuid primary key default gen_random_uuid(),

  titulo text not null,
  descricao text,
  imagem text,                       -- foto WEBP como data URL base64 (data:image/webp;base64,...)

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete set null,
  atualizado_por uuid references auth.users(id) on delete set null
);

create index if not exists idx_glossario_subcomponentes_titulo on public.glossario_subcomponentes (titulo);
create index if not exists idx_glossario_subcomponentes_criado_em on public.glossario_subcomponentes (criado_em);

-- ---------------------------------------------------------------------
-- 2) Carimbo automático de criado_por / atualizado_por / datas
-- ---------------------------------------------------------------------
drop trigger if exists trg_glossario_subcomponentes_preencher_auditoria on public.glossario_subcomponentes;
create trigger trg_glossario_subcomponentes_preencher_auditoria
before insert or update on public.glossario_subcomponentes
for each row execute function public.preencher_campos_auditoria();

-- ---------------------------------------------------------------------
-- 3) RLS — leitura para usuário ativo; escrita somente admin
-- ---------------------------------------------------------------------
alter table public.glossario_subcomponentes enable row level security;

revoke all on table public.glossario_subcomponentes from anon;
grant select, insert, update, delete on table public.glossario_subcomponentes to authenticated;

-- Remove policies antigas (re-execução segura)
do $$
declare p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'glossario_subcomponentes'
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

create policy "glossario_subcomponentes_select_usuarios_ativos"
on public.glossario_subcomponentes
for select to authenticated
using (public.usuario_ativo());

create policy "glossario_subcomponentes_insert_admin"
on public.glossario_subcomponentes
for insert to authenticated
with check (public.eh_admin());

create policy "glossario_subcomponentes_update_admin"
on public.glossario_subcomponentes
for update to authenticated
using (public.eh_admin())
with check (public.eh_admin());

create policy "glossario_subcomponentes_delete_admin"
on public.glossario_subcomponentes
for delete to authenticated
using (public.eh_admin());
