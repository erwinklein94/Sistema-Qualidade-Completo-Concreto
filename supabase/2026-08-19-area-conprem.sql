-- =====================================================================
-- ÁREA CONPREM — tabelas próprias e migração definitiva dos dados
--
-- Até aqui Cavan e Conprem dividiam as mesmas tabelas, separadas apenas
-- pela coluna fornecedor. A partir deste ponto a Conprem tem tabelas
-- próprias (prefixo conprem_) e a área de Dormentes de Concreto do
-- sistema passa a ser exclusiva da Cavan.
--
-- O que é movido de verdade (linhas saem da tabela antiga):
--   producao_lotes         31 lotes  Conprem MG
--   reprovados              7 registros
--   inspecoes_pista        14 registros
--   inspecoes_concretagem  18 registros + 1 com fornecedor gravado como
--                          "Sim" (erro de importação do iAuditor), que por
--                          decisão do usuário fica com a Conprem. Esse
--                          registro apontava para um lote da Cavan, então
--                          o vínculo é desfeito na migração.
--
-- Criadas vazias, para as telas da área Conprem funcionarem igual às da
-- Cavan: conprem_pedidos_dormentes e conprem_ensaios_liberacao.
-- =====================================================================

begin;

-- ---------------------------------------------------------------- tabelas
create table conprem_producao_lotes        (like producao_lotes        including all);
create table conprem_reprovados            (like reprovados            including all);
create table conprem_inspecoes_pista       (like inspecoes_pista       including all);
create table conprem_inspecoes_concretagem (like inspecoes_concretagem including all);
create table conprem_pedidos_dormentes     (like pedidos_dormentes     including all);
create table conprem_ensaios_liberacao     (like ensaios_liberacao     including all);

comment on table conprem_producao_lotes        is 'Produção de dormentes da CONPREM. Espelha producao_lotes.';
comment on table conprem_reprovados            is 'Dormentes reprovados da CONPREM. Espelha reprovados.';
comment on table conprem_inspecoes_pista       is 'Inspeções de pista da CONPREM. Espelha inspecoes_pista.';
comment on table conprem_inspecoes_concretagem is 'Inspeções de concretagem da CONPREM. Espelha inspecoes_concretagem.';
comment on table conprem_pedidos_dormentes     is 'Pedidos de dormentes à CONPREM. Espelha pedidos_dormentes.';
comment on table conprem_ensaios_liberacao     is 'Ensaios de liberação da CONPREM. Espelha ensaios_liberacao.';

-- ------------------------------------------------------- cópia dos dados
-- Feita antes dos gatilhos para não disparar auditoria de "criação" em
-- registro que apenas mudou de tabela, e para preservar criado_por/criado_em.
insert into conprem_producao_lotes        select * from producao_lotes        where fornecedor = 'Conprem MG';
insert into conprem_reprovados            select * from reprovados            where fornecedor = 'Conprem MG';
insert into conprem_inspecoes_pista       select * from inspecoes_pista       where fornecedor = 'Conprem MG';
insert into conprem_inspecoes_concretagem select * from inspecoes_concretagem where fornecedor in ('Conprem MG', 'Sim');

-- O registro com fornecedor "Sim" passa a valer como Conprem MG.
update conprem_inspecoes_concretagem set fornecedor = 'Conprem MG' where fornecedor = 'Sim';

-- Dois registros de inspeção marcados como Conprem apontavam para lotes que
-- pertencem à Cavan e ficam na tabela antiga (lote 3259 e lote 3060 — este é o
-- do fornecedor "Sim"). O vínculo com o lote é desfeito; o número do lote
-- continua gravado no próprio registro, então nada de informação se perde.
update conprem_reprovados            set producao_lote_id = null where producao_lote_id is not null and producao_lote_id not in (select id from conprem_producao_lotes);
update conprem_inspecoes_pista       set producao_lote_id = null where producao_lote_id is not null and producao_lote_id not in (select id from conprem_producao_lotes);
update conprem_inspecoes_concretagem set producao_lote_id = null where producao_lote_id is not null and producao_lote_id not in (select id from conprem_producao_lotes);

-- --------------------------------------------- remoção das tabelas Cavan
-- Filhos primeiro: as FKs de producao_lotes são ON DELETE SET NULL e não
-- devem zerar vínculo de linha que ainda vai sair junto.
delete from reprovados            where fornecedor = 'Conprem MG';
delete from inspecoes_pista       where fornecedor = 'Conprem MG';
delete from inspecoes_concretagem where fornecedor in ('Conprem MG', 'Sim');
delete from producao_lotes        where fornecedor = 'Conprem MG';

-- -------------------------------------------------------------- vínculos
alter table conprem_producao_lotes
  add constraint conprem_producao_lotes_criado_por_fkey     foreign key (criado_por)     references auth.users(id),
  add constraint conprem_producao_lotes_atualizado_por_fkey foreign key (atualizado_por) references auth.users(id);

alter table conprem_reprovados
  add constraint conprem_reprovados_criado_por_fkey       foreign key (criado_por)       references auth.users(id),
  add constraint conprem_reprovados_atualizado_por_fkey   foreign key (atualizado_por)   references auth.users(id),
  add constraint conprem_reprovados_producao_lote_id_fkey foreign key (producao_lote_id) references conprem_producao_lotes(id) on delete set null;

alter table conprem_inspecoes_pista
  add constraint conprem_inspecoes_pista_producao_lote_id_fkey foreign key (producao_lote_id) references conprem_producao_lotes(id) on delete set null;

alter table conprem_inspecoes_concretagem
  add constraint conprem_inspecoes_concretagem_producao_lote_id_fkey foreign key (producao_lote_id) references conprem_producao_lotes(id) on delete set null;

alter table conprem_pedidos_dormentes
  add constraint conprem_pedidos_dormentes_criado_por_fkey     foreign key (criado_por)     references auth.users(id) on delete set null,
  add constraint conprem_pedidos_dormentes_atualizado_por_fkey foreign key (atualizado_por) references auth.users(id) on delete set null;

alter table conprem_ensaios_liberacao
  add constraint conprem_ensaios_liberacao_criado_por_fkey       foreign key (criado_por)       references auth.users(id),
  add constraint conprem_ensaios_liberacao_atualizado_por_fkey   foreign key (atualizado_por)   references auth.users(id),
  add constraint conprem_ensaios_liberacao_producao_lote_id_fkey foreign key (producao_lote_id) references conprem_producao_lotes(id) on delete set null;

-- ------------------------------------------------- gatilhos e permissões
-- Mesmo conjunto das tabelas originais: preenchimento de auditoria,
-- atualizado_em e registro em auditoria_alteracoes; RLS por perfil.
do $$
declare
  t text;
  tem_atualizado_em boolean;
begin
  foreach t in array array[
    'conprem_producao_lotes', 'conprem_reprovados', 'conprem_inspecoes_pista',
    'conprem_inspecoes_concretagem', 'conprem_pedidos_dormentes', 'conprem_ensaios_liberacao'
  ] loop
    execute format(
      'create trigger trg_%1$s_preencher_auditoria before insert or update on %1$I
         for each row execute function preencher_campos_auditoria()', t);
    execute format(
      'create trigger trg_%1$s_registrar_auditoria after insert or update or delete on %1$I
         for each row execute function registrar_auditoria_alteracao()', t);

    select exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = t and column_name = 'atualizado_em'
    ) into tem_atualizado_em;
    if tem_atualizado_em then
      execute format(
        'create trigger trg_%1$s_atualizado_em before update on %1$I
           for each row execute function set_atualizado_em()', t);
    end if;

    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy %1$s_select_usuarios_ativos on %1$I for select to authenticated
         using (usuario_ativo())', t);
    execute format(
      'create policy %1$s_insert_admin_fiscalizacao on %1$I for insert to authenticated
         with check (pode_escrever())', t);
    execute format(
      'create policy %1$s_update_admin_fiscalizacao on %1$I for update to authenticated
         using (pode_escrever()) with check (pode_escrever())', t);
    execute format(
      'create policy %1$s_delete_admin on %1$I for delete to authenticated
         using (eh_admin())', t);

    -- CREATE TABLE ... (LIKE ...) copia colunas, índices e constraints, mas
    -- NÃO copia privilégios de tabela: sem estes GRANTs o PostgREST responde
    -- "permission denied for table conprem_*" antes mesmo de olhar a RLS.
    -- Quem decide o acesso por perfil continuam sendo as policies acima.
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant select, insert, update on public.%I to service_role', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

commit;
