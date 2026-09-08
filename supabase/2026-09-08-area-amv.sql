/* =====================================================================
   ÁREA AMV — Inspeção de peças de aparelho de mudança de via / Supabase

   Rode este arquivo no Supabase SQL Editor DEPOIS das migrations de
   perfis/RLS/auditoria do sistema (2026-05-26-perfis-e-rls.sql e
   2026-05-23-auditoria-e-usuarios.sql). Em seguida rode a carga do
   histórico: 2026-09-08-area-amv-carga-historico.sql.

   O modelo segue a forma do relatório de origem — o template
   "Materiais | AMV" do SafetyCulture, RELATÓRIO DE INSPEÇÃO DE PEÇAS DE
   AMV — que é hierárquico em três níveis:

     amv_inspecoes            1 linha por relatório (fornecedor, data,
                              local, responsável, projeto, pedido,
                              quantidades programadas/disponíveis/
                              ajustadas/reprovadas)
       amv_pecas_inspecionadas  1 linha por peça detalhada no relatório
                                (o bloco DETALHAMENTO DAS PEÇAS
                                INSPECIONADAS repete de 1 a 6 vezes)
         amv_defeitos             1 linha por defeito descrito na peça

   O campo TIPO DE PEÇA é texto livre no relatório (239 valores distintos
   em 254 peças do histórico), então as colunas de classificação
   (familia, trilho, inclinacao, mao, geometria, montagem, derivacao)
   são derivadas do texto por funções desta migration. Elas existem para
   filtrar e agrupar; o texto original fica preservado em tipo_peca.

   Regras de acesso, iguais às das inspeções de dormentes:
   - admin e fiscalização: criam e editam.
   - admin: exclui.
   - consulta: apenas visualiza.
   ===================================================================== */

create extension if not exists "pgcrypto";

/* ---------------------------------------------------------------------
   Classificação da peça a partir do texto livre de TIPO DE PEÇA.

   Os padrões evitam letras acentuadas de propósito ("jacar" em vez de
   "jacaré", "conjuga" em vez de "conjugação"), porque no histórico o
   mesmo item aparece escrito de várias formas. A ordem importa: um
   "JACARÉ CURVO 14_60 AMV D1E" é jacaré, não AMV completo.
   --------------------------------------------------------------------- */
create or replace function public.amv_familia_peca(tipo text)
returns text language sql immutable as $$
  select case
    when tipo is null or btrim(tipo) = '' then null
    when tipo ~* 'jacar'                   then 'Jacaré'
    when tipo ~* 'meias?[ -]*chaves?'      then 'Meia chave'
    when tipo ~* 'contra[ -]*trilho'       then 'Contratrilho'
    when tipo ~* 'ponteira'                then 'Ponteira'
    when tipo ~* 'agulha'                  then 'Agulha'
    when tipo ~* 'barras?[ ]*de[ ]*conjuga' then 'Barra de conjugação'
    when tipo ~* 'inversor'                then 'Aparelho inversor'
    when tipo ~* 'manobra'                 then 'Aparelho de manobra'
    when tipo ~* '(^|[^a-z])amv([^a-z]|$)' then 'AMV completo'
    when tipo ~* 'trilho'                  then 'Trilho'
    else 'Outros'
  end;
$$;

create or replace function public.amv_trilho_peca(tipo text)
returns text language sql immutable as $$
  select case
    when tipo is null then null
    when tipo ~* 'uic[ -]*60' then 'UIC60'
    when tipo ~* 'tr[ -]*68'  then 'TR-68'
    when tipo ~* 'tr[ -]*57'  then 'TR-57'
    when tipo ~* 'tr[ -]*45'  then 'TR-45'
    when tipo ~* 'tr[ -]*37'  then 'TR-37'
    else null
  end;
$$;

/* Inclinação do jacaré: aparece como "1:14", "N1:10", "n°14" ou "n14". */
create or replace function public.amv_inclinacao_peca(tipo text)
returns text language sql immutable as $$
  select coalesce(
    '1:' || (regexp_match(tipo, '1[ ]*[:-][ ]*(20|14|12|10|8)(?![0-9])'))[1],
    '1:' || (regexp_match(tipo, 'n[ ]*[º°]?[ ]*(20|14|12|10|8)(?![0-9])', 'i'))[1]
  );
$$;

create or replace function public.amv_mao_peca(tipo text)
returns text language sql immutable as $$
  select case
    when tipo is null then null
    when tipo ~* 'direit|(^|[^a-z])dir([^a-z]|$)'
     and tipo ~* 'esquerd|(^|[^a-z])esq([^a-z]|$)' then 'Direita e esquerda'
    when tipo ~* 'direit|(^|[^a-z])dir([^a-z]|$)'  then 'Direita'
    when tipo ~* 'esquerd|(^|[^a-z])esq([^a-z]|$)' then 'Esquerda'
    else null
  end;
$$;

/* Um mesmo item pode ser prolongado E curvo, então a geometria é a
   junção do que o texto declarar. */
create or replace function public.amv_geometria_peca(tipo text)
returns text language sql immutable as $$
  select nullif(concat_ws(' · ',
    case when tipo ~* 'prolongad|alongad'               then 'Prolongado' end,
    case when tipo ~* 'curvo|curva'                     then 'Curvo' end,
    case when tipo ~* '(^|[^a-z])(reto|reta)([^a-z]|$)' then 'Reto' end
  ), '');
$$;

create or replace function public.amv_montagem_peca(tipo text)
returns text language sql immutable as $$
  select case
    when tipo is null then null
    when tipo ~* 'duplos?|bipartid' then 'Duplo'
    when tipo ~* 'simples'          then 'Simples'
    else null
  end;
$$;

/* Derivação do jacaré duplo: D1D, D1E, E1D ou E1E. */
create or replace function public.amv_derivacao_peca(tipo text)
returns text language sql immutable as $$
  select upper((regexp_match(tipo, '(?:^|[^a-z0-9])([de]1[de])(?:[^a-z0-9]|$)', 'i'))[1]);
$$;


/* ---------------------------------------------------------------------
   Inspeções — o cabeçalho do relatório.
   --------------------------------------------------------------------- */
create table if not exists public.amv_inspecoes (
  id uuid primary key default gen_random_uuid(),
  audit_id text unique,
  audit_nome text,
  template_id text,
  template_nome text,
  fornecedor text not null default '',
  fornecedor_outro text,
  data_inspecao date,
  hora_inicio timestamptz,
  localizacao text,
  responsavel text,
  projetos text[] not null default '{}',
  numero_pedido text,
  qtd_programadas integer not null default 0,
  qtd_disponiveis integer not null default 0,
  qtd_ajustes integer not null default 0,
  qtd_reprovadas integer not null default 0,
  tipagem_legivel text,
  informacoes_adicionais text,
  autor text,
  iniciado_em timestamptz,
  concluido_em timestamptz,
  origem_dados text not null default 'manual',
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete set null,
  atualizado_por uuid references auth.users(id) on delete set null
);

create index if not exists idx_amv_inspecoes_data on public.amv_inspecoes (data_inspecao desc);
create index if not exists idx_amv_inspecoes_fornecedor on public.amv_inspecoes (fornecedor);
create index if not exists idx_amv_inspecoes_pedido on public.amv_inspecoes (numero_pedido);
create index if not exists idx_amv_inspecoes_responsavel on public.amv_inspecoes (responsavel);
create index if not exists idx_amv_inspecoes_projetos on public.amv_inspecoes using gin (projetos);


/* ---------------------------------------------------------------------
   Peças inspecionadas — o bloco repetido do relatório.
   --------------------------------------------------------------------- */
create table if not exists public.amv_pecas_inspecionadas (
  id uuid primary key default gen_random_uuid(),
  inspecao_id uuid not null references public.amv_inspecoes(id) on delete cascade,
  indice integer not null default 1,
  tipo_peca text not null default '',
  tipo_peca_notas text,
  numero_pedido text,
  tem_defeito boolean,
  familia text,
  trilho text,
  inclinacao text,
  mao text,
  geometria text,
  montagem text,
  derivacao text,
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete set null,
  atualizado_por uuid references auth.users(id) on delete set null,
  unique (inspecao_id, indice)
);

create index if not exists idx_amv_pecas_inspecao on public.amv_pecas_inspecionadas (inspecao_id);
create index if not exists idx_amv_pecas_familia on public.amv_pecas_inspecionadas (familia);
create index if not exists idx_amv_pecas_trilho on public.amv_pecas_inspecionadas (trilho);
create index if not exists idx_amv_pecas_defeito on public.amv_pecas_inspecionadas (tem_defeito);

/* A classificação é preenchida sozinha na inclusão e recalculada quando
   o texto da peça muda. Quem quiser corrigir uma classificação na mão
   pode gravar o valor direto — ele só é sobrescrito se o tipo_peca for
   alterado depois. */
create or replace function public.amv_preencher_classificacao_peca()
returns trigger language plpgsql as $$
declare
  recalcular boolean;
begin
  -- old só existe no UPDATE; testar os dois casos numa expressão só
  -- arriscaria ler old.tipo_peca durante um INSERT.
  if tg_op = 'INSERT' then
    recalcular := true;
  else
    recalcular := (new.tipo_peca is distinct from old.tipo_peca);
  end if;

  if recalcular or new.familia is null then new.familia := public.amv_familia_peca(new.tipo_peca); end if;
  if recalcular or new.trilho is null then new.trilho := public.amv_trilho_peca(new.tipo_peca); end if;
  if recalcular or new.inclinacao is null then new.inclinacao := public.amv_inclinacao_peca(new.tipo_peca); end if;
  if recalcular or new.mao is null then new.mao := public.amv_mao_peca(new.tipo_peca); end if;
  if recalcular or new.geometria is null then new.geometria := public.amv_geometria_peca(new.tipo_peca); end if;
  if recalcular or new.montagem is null then new.montagem := public.amv_montagem_peca(new.tipo_peca); end if;
  if recalcular or new.derivacao is null then new.derivacao := public.amv_derivacao_peca(new.tipo_peca); end if;
  return new;
end $$;

drop trigger if exists trg_amv_pecas_classificacao on public.amv_pecas_inspecionadas;
create trigger trg_amv_pecas_classificacao
before insert or update on public.amv_pecas_inspecionadas
for each row execute function public.amv_preencher_classificacao_peca();


/* ---------------------------------------------------------------------
   Defeitos — o que o inspetor descreveu quando marcou "Há defeito nesta
   peça? = Sim". inspecao_id fica repetido aqui de propósito, para a tela
   de defeitos filtrar por fornecedor e período sem dois joins.
   --------------------------------------------------------------------- */
create table if not exists public.amv_defeitos (
  id uuid primary key default gen_random_uuid(),
  peca_id uuid not null references public.amv_pecas_inspecionadas(id) on delete cascade,
  inspecao_id uuid not null references public.amv_inspecoes(id) on delete cascade,
  indice integer not null default 1,
  descricao text not null default '',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references auth.users(id) on delete set null,
  atualizado_por uuid references auth.users(id) on delete set null,
  unique (peca_id, indice)
);

create index if not exists idx_amv_defeitos_peca on public.amv_defeitos (peca_id);
create index if not exists idx_amv_defeitos_inspecao on public.amv_defeitos (inspecao_id);


/* ---------------------------------------------------------------------
   Auditoria: mesmos gatilhos das demais tabelas do sistema.
   --------------------------------------------------------------------- */
do $$
declare t text;
begin
  foreach t in array array['amv_inspecoes', 'amv_pecas_inspecionadas', 'amv_defeitos'] loop
    execute format('drop trigger if exists trg_%s_preencher_auditoria on public.%I', t, t);
    execute format('create trigger trg_%s_preencher_auditoria before insert or update on public.%I for each row execute function public.preencher_campos_auditoria()', t, t);

    if to_regprocedure('public.registrar_auditoria_alteracao()') is not null then
      execute format('drop trigger if exists trg_%s_registrar_auditoria on public.%I', t, t);
      execute format('create trigger trg_%s_registrar_auditoria after insert or update or delete on public.%I for each row execute function public.registrar_auditoria_alteracao()', t, t);
    end if;
  end loop;
end $$;


/* ---------------------------------------------------------------------
   RLS — leitura para todo usuário ativo, escrita para admin e
   fiscalização, exclusão só para admin.
   --------------------------------------------------------------------- */
do $$
declare t text;
begin
  foreach t in array array['amv_inspecoes', 'amv_pecas_inspecionadas', 'amv_defeitos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);

    execute format('drop policy if exists "%s_select_usuarios_ativos" on public.%I', t, t);
    execute format('drop policy if exists "%s_insert_admin_fiscalizacao" on public.%I', t, t);
    execute format('drop policy if exists "%s_update_admin_fiscalizacao" on public.%I', t, t);
    execute format('drop policy if exists "%s_delete_admin" on public.%I', t, t);

    execute format('create policy "%s_select_usuarios_ativos" on public.%I for select to authenticated using (public.usuario_ativo())', t, t);
    execute format('create policy "%s_insert_admin_fiscalizacao" on public.%I for insert to authenticated with check (public.pode_escrever())', t, t);
    execute format('create policy "%s_update_admin_fiscalizacao" on public.%I for update to authenticated using (public.pode_escrever()) with check (public.pode_escrever())', t, t);
    execute format('create policy "%s_delete_admin" on public.%I for delete to authenticated using (public.eh_admin())', t, t);
  end loop;
end $$;


/* Verificação rápida:
   select count(*) from public.amv_inspecoes;
   select familia, count(*) from public.amv_pecas_inspecionadas group by 1 order by 2 desc;
   select count(*) from public.amv_defeitos;
*/
