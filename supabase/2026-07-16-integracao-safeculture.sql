-- =====================================================================
-- Integração SafetyCulture -> Supabase -> Sistema de Qualidade
--
-- Execute este arquivo no SQL Editor depois dos scripts de perfis/RLS e
-- das tabelas operacionais de inspeções e ensaios.
--
-- O token da API NÃO é salvo nestas tabelas. Ele deve ser cadastrado nos
-- Secrets das Edge Functions com o nome SAFETYCULTURE_API_TOKEN.
-- =====================================================================

create extension if not exists "pgcrypto";

create table if not exists public.safeculture_templates (
  template_id        text primary key,
  nome               text not null,
  destino            text,
  ativo              boolean not null default false,
  auto_classificado  boolean not null default false,
  mapeamento         jsonb not null default '{}'::jsonb,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now(),
  constraint safeculture_templates_destino_check check (
    destino is null or destino in (
      'inspecoes_pista',
      'inspecoes_concretagem',
      'ensaios_bitola',
      'ensaios_arrancamento_usp',
      'ensaios_liberacao',
      'ensaios_acompanhamento'
    )
  )
);

create table if not exists public.safeculture_inspecoes (
  audit_id                 text primary key,
  audit_uuid               uuid,
  template_id              text references public.safeculture_templates(template_id) on delete set null,
  destino                  text,
  nome                     text,
  status_processamento     text not null default 'pendente',
  criado_em_safeculture    timestamptz,
  modificado_em_safeculture timestamptz,
  concluido_em_safeculture timestamptz,
  web_report_url           text,
  payload                  jsonb not null default '{}'::jsonb,
  registro_destino_id      uuid,
  erro_processamento       text,
  processado_em            timestamptz,
  atualizado_em            timestamptz not null default now(),
  constraint safeculture_inspecoes_status_check check (
    status_processamento in ('pendente', 'processado', 'ignorado', 'erro')
  )
);

create table if not exists public.safeculture_sincronizacoes (
  id                    uuid primary key default gen_random_uuid(),
  origem                text not null default 'manual',
  status                text not null default 'executando',
  solicitado_por        uuid references auth.users(id) on delete set null,
  iniciado_em           timestamptz not null default now(),
  finalizado_em         timestamptz,
  checkpoint_inicial    timestamptz,
  checkpoint_final      timestamptz,
  encontrados           integer not null default 0,
  inseridos             integer not null default 0,
  atualizados           integer not null default 0,
  ignorados             integer not null default 0,
  erros                 integer not null default 0,
  detalhes_erros        jsonb not null default '[]'::jsonb,
  mensagem              text,
  constraint safeculture_sync_origem_check check (origem in ('manual', 'cron', 'reprocessamento')),
  constraint safeculture_sync_status_check check (status in ('executando', 'sucesso', 'parcial', 'erro'))
);

create table if not exists public.safeculture_estado_sync (
  id                         boolean primary key default true check (id is true),
  ativo                      boolean not null default true,
  ultima_modificacao_lida    timestamptz,
  ultima_sincronizacao_ok    timestamptz,
  ultima_execucao_id         uuid references public.safeculture_sincronizacoes(id) on delete set null,
  sobreposicao_minutos       integer not null default 5 check (sobreposicao_minutos between 0 and 120),
  atualizado_em              timestamptz not null default now()
);

insert into public.safeculture_estado_sync (id)
values (true)
on conflict (id) do nothing;

create index if not exists idx_safeculture_templates_ativos
  on public.safeculture_templates (ativo, destino);
create index if not exists idx_safeculture_inspecoes_template
  on public.safeculture_inspecoes (template_id);
create index if not exists idx_safeculture_inspecoes_modificado
  on public.safeculture_inspecoes (modificado_em_safeculture desc);
create index if not exists idx_safeculture_inspecoes_status
  on public.safeculture_inspecoes (status_processamento);
create index if not exists idx_safeculture_sincronizacoes_inicio
  on public.safeculture_sincronizacoes (iniciado_em desc);
create index if not exists idx_safeculture_sincronizacoes_solicitado_por
  on public.safeculture_sincronizacoes (solicitado_por);

-- Origem/rastreabilidade nas tabelas operacionais.
alter table if exists public.inspecoes_pista
  add column if not exists producao_lote_id uuid,
  add column if not exists dormentes_reprovados integer,
  add column if not exists origem_dados text not null default 'manual',
  add column if not exists safeculture_audit_id text,
  add column if not exists safeculture_template_id text,
  add column if not exists safeculture_modified_at timestamptz;

alter table if exists public.inspecoes_concretagem
  add column if not exists producao_lote_id uuid,
  add column if not exists origem_dados text not null default 'manual',
  add column if not exists safeculture_audit_id text,
  add column if not exists safeculture_template_id text,
  add column if not exists safeculture_modified_at timestamptz;

alter table if exists public.ensaios_bitola
  add column if not exists producao_lote_id uuid,
  add column if not exists origem_dados text not null default 'manual',
  add column if not exists safeculture_audit_id text,
  add column if not exists safeculture_template_id text,
  add column if not exists safeculture_modified_at timestamptz;

alter table if exists public.ensaios_arrancamento_usp
  add column if not exists producao_lote_id uuid,
  add column if not exists origem_dados text not null default 'manual',
  add column if not exists safeculture_audit_id text,
  add column if not exists safeculture_template_id text,
  add column if not exists safeculture_modified_at timestamptz;

alter table if exists public.ensaios_liberacao
  add column if not exists origem_dados text not null default 'manual',
  add column if not exists safeculture_audit_id text,
  add column if not exists safeculture_template_id text,
  add column if not exists safeculture_modified_at timestamptz;

alter table if exists public.ensaios_acompanhamento
  add column if not exists origem_dados text not null default 'manual',
  add column if not exists safeculture_audit_id text,
  add column if not exists safeculture_template_id text,
  add column if not exists safeculture_modified_at timestamptz;

-- Integridade dos vínculos com a produção. Os blocos são idempotentes para
-- permitir reaplicar o script sem duplicar constraints.
do $$
begin
  if to_regclass('public.inspecoes_pista') is not null
     and not exists (
       select 1 from pg_constraint
       where conrelid = 'public.inspecoes_pista'::regclass
         and conname = 'inspecoes_pista_producao_lote_id_fkey'
     ) then
    alter table public.inspecoes_pista
      add constraint inspecoes_pista_producao_lote_id_fkey
      foreign key (producao_lote_id) references public.producao_lotes(id)
      on delete set null;
  end if;

  if to_regclass('public.inspecoes_concretagem') is not null
     and not exists (
       select 1 from pg_constraint
       where conrelid = 'public.inspecoes_concretagem'::regclass
         and conname = 'inspecoes_concretagem_producao_lote_id_fkey'
     ) then
    alter table public.inspecoes_concretagem
      add constraint inspecoes_concretagem_producao_lote_id_fkey
      foreign key (producao_lote_id) references public.producao_lotes(id)
      on delete set null;
  end if;

  if to_regclass('public.ensaios_bitola') is not null
     and not exists (
       select 1 from pg_constraint
       where conrelid = 'public.ensaios_bitola'::regclass
         and conname = 'ensaios_bitola_producao_lote_id_fkey'
     ) then
    alter table public.ensaios_bitola
      add constraint ensaios_bitola_producao_lote_id_fkey
      foreign key (producao_lote_id) references public.producao_lotes(id)
      on delete set null;
  end if;

  if to_regclass('public.ensaios_arrancamento_usp') is not null
     and not exists (
       select 1 from pg_constraint
       where conrelid = 'public.ensaios_arrancamento_usp'::regclass
         and conname = 'ensaios_arrancamento_usp_producao_lote_id_fkey'
     ) then
    alter table public.ensaios_arrancamento_usp
      add constraint ensaios_arrancamento_usp_producao_lote_id_fkey
      foreign key (producao_lote_id) references public.producao_lotes(id)
      on delete set null;
  end if;

  if to_regclass('public.ensaios_acompanhamento') is not null
     and not exists (
       select 1 from pg_constraint
       where conrelid = 'public.ensaios_acompanhamento'::regclass
         and conname = 'ensaios_acompanhamento_producao_lote_id_fkey'
     ) then
    alter table public.ensaios_acompanhamento
      add constraint ensaios_acompanhamento_producao_lote_id_fkey
      foreign key (producao_lote_id) references public.producao_lotes(id)
      on delete set null;
  end if;
end
$$;

-- Registros históricos com nome de arquivo vieram do importador de PDF.
update public.inspecoes_pista
set origem_dados = 'pdf'
where safeculture_audit_id is null
  and nullif(trim(coalesce(arquivo_origem, '')), '') is not null
  and origem_dados = 'manual';

update public.inspecoes_concretagem
set origem_dados = 'pdf'
where safeculture_audit_id is null
  and nullif(trim(coalesce(arquivo_origem, '')), '') is not null
  and origem_dados = 'manual';

update public.ensaios_bitola
set origem_dados = 'pdf'
where safeculture_audit_id is null
  and nullif(trim(coalesce(arquivo_origem, '')), '') is not null
  and origem_dados = 'manual';

update public.ensaios_arrancamento_usp
set origem_dados = 'pdf'
where safeculture_audit_id is null
  and nullif(trim(coalesce(arquivo_origem, '')), '') is not null
  and origem_dados = 'manual';

update public.ensaios_acompanhamento
set origem_dados = 'pdf'
where safeculture_audit_id is null
  and nullif(trim(coalesce(arquivo_origem, '')), '') is not null
  and origem_dados = 'manual';

-- Ensaios de liberação antigos não possuem arquivo_origem; o resumo gravado
-- pelo leitor identifica os registros importados.
update public.ensaios_liberacao
set origem_dados = 'pdf'
where safeculture_audit_id is null
  and coalesce(observacoes, '') ilike '%importado do leitor%'
  and origem_dados = 'manual';

create unique index if not exists uq_inspecoes_pista_safeculture
  on public.inspecoes_pista (safeculture_audit_id);
create unique index if not exists uq_inspecoes_concretagem_safeculture
  on public.inspecoes_concretagem (safeculture_audit_id);
create unique index if not exists uq_ensaios_bitola_safeculture
  on public.ensaios_bitola (safeculture_audit_id);
create unique index if not exists uq_ensaios_arrancamento_usp_safeculture
  on public.ensaios_arrancamento_usp (safeculture_audit_id);
create unique index if not exists uq_ensaios_liberacao_safeculture
  on public.ensaios_liberacao (safeculture_audit_id);
create unique index if not exists uq_ensaios_acompanhamento_safeculture
  on public.ensaios_acompanhamento (safeculture_audit_id);

create index if not exists idx_inspecoes_pista_producao_lote
  on public.inspecoes_pista (producao_lote_id);
create index if not exists idx_inspecoes_concretagem_producao_lote
  on public.inspecoes_concretagem (producao_lote_id);
create index if not exists idx_ensaios_bitola_producao_lote
  on public.ensaios_bitola (producao_lote_id);
create index if not exists idx_ensaios_arrancamento_usp_producao_lote
  on public.ensaios_arrancamento_usp (producao_lote_id);
create index if not exists idx_ensaios_acompanhamento_producao_lote
  on public.ensaios_acompanhamento (producao_lote_id);

-- Segurança: tabelas de integração ficam no schema exposto, porém com RLS.
alter table public.safeculture_templates enable row level security;
alter table public.safeculture_inspecoes enable row level security;
alter table public.safeculture_sincronizacoes enable row level security;
alter table public.safeculture_estado_sync enable row level security;

revoke all on table public.safeculture_templates from anon, authenticated;
revoke all on table public.safeculture_inspecoes from anon, authenticated;
revoke all on table public.safeculture_sincronizacoes from anon, authenticated;
revoke all on table public.safeculture_estado_sync from anon, authenticated;

grant select, update on table public.safeculture_templates to authenticated;
grant select on table public.safeculture_sincronizacoes to authenticated;
grant select on table public.safeculture_estado_sync to authenticated;
grant all on table public.safeculture_templates to service_role;
grant all on table public.safeculture_inspecoes to service_role;
grant all on table public.safeculture_sincronizacoes to service_role;
grant all on table public.safeculture_estado_sync to service_role;
grant select on table public.producao_lotes to service_role;
grant select on table public.usuarios_app to service_role;
grant select, insert, update on table public.inspecoes_pista to service_role;
grant select, insert, update on table public.inspecoes_concretagem to service_role;
grant select, insert, update on table public.ensaios_bitola to service_role;
grant select, insert, update on table public.ensaios_arrancamento_usp to service_role;
grant select, insert, update on table public.ensaios_liberacao to service_role;
grant select, insert, update on table public.ensaios_acompanhamento to service_role;

-- A função administrativa já existe no sistema. Mantém o uso nas policies
-- autenticadas, mas remove a execução herdada pelo papel PUBLIC/anon.
revoke all on function public.eh_admin() from public, anon;
grant execute on function public.eh_admin() to authenticated;

drop policy if exists "safeculture_templates_select_admin" on public.safeculture_templates;
create policy "safeculture_templates_select_admin"
on public.safeculture_templates for select to authenticated
using (public.eh_admin());

drop policy if exists "safeculture_templates_update_admin" on public.safeculture_templates;
create policy "safeculture_templates_update_admin"
on public.safeculture_templates for update to authenticated
using (public.eh_admin())
with check (public.eh_admin());

drop policy if exists "safeculture_sync_select_admin" on public.safeculture_sincronizacoes;
create policy "safeculture_sync_select_admin"
on public.safeculture_sincronizacoes for select to authenticated
using (public.eh_admin());

drop policy if exists "safeculture_estado_select_admin" on public.safeculture_estado_sync;
create policy "safeculture_estado_select_admin"
on public.safeculture_estado_sync for select to authenticated
using (public.eh_admin());

-- Nenhuma policy é criada para safeculture_inspecoes: somente a Edge Function,
-- usando a secret key do projeto, pode acessar o JSON bruto.

-- Atualização automática do timestamp dos templates.
create or replace function public.atualizar_timestamp_safeculture_template()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists trg_safeculture_templates_timestamp on public.safeculture_templates;
create trigger trg_safeculture_templates_timestamp
before update on public.safeculture_templates
for each row execute function public.atualizar_timestamp_safeculture_template();

-- Garante que a função de timestamp não vire um endpoint público.
revoke all on function public.atualizar_timestamp_safeculture_template() from public, anon, authenticated;
