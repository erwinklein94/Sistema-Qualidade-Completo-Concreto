/* =====================================================================
   REMOVE A TRILHA DE AUDITORIA LINHA A LINHA

   Rode este arquivo DEPOIS de todos os anteriores. Ele desfaz, de uma
   vez, os gatilhos de auditoria que os SQLs antigos espalharam pelas
   tabelas — por isso não foi preciso editar cada um daqueles arquivos,
   que continuam valendo como registro histórico do que foi aplicado.

   Por que saiu:

   A tabela public.auditoria_alteracoes já não existia mais no banco,
   mas a função registrar_auditoria_alteracao() e os 25 gatilhos que a
   chamavam continuavam de pé. Como a função insere nessa tabela, TODA
   gravação nas tabelas com o gatilho falhava com
   42P01 relation "public.auditoria_alteracoes" does not exist —
   producao_lotes, reprovados, inspecoes_pista, pedidos_dormentes,
   todas as conprem_* e as de subcomponentes.

   O que NÃO sai daqui: preencher_campos_auditoria(), que carimba
   criado_em/criado_por e atualizado_em/atualizado_por. Continua nas 30
   tabelas onde já estava. É esse gatilho que alimenta o "quem criou /
   quem alterou" que as telas mostram, e ele não depende de tabela
   nenhuma.

   As telas de auditoria (auditoria.html e a aba Auditoria dentro de
   Subcomponentes) foram removidas do site no mesmo commit.
   ===================================================================== */

do $blk$
declare r record;
begin
  for r in
    select c.relname as tabela, t.tgname as gatilho
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and not t.tgisinternal
      and t.tgfoid = 'public.registrar_auditoria_alteracao()'::regprocedure
  loop
    execute format('drop trigger if exists %I on public.%I', r.gatilho, r.tabela);
  end loop;
end $blk$;

drop function if exists public.registrar_auditoria_alteracao();

/* A tabela em si já não existia. A linha abaixo fica comentada de
   propósito: se um dia ela reaparecer num restore, quem for limpar
   decide na hora se descarta o histórico.

   drop table if exists public.auditoria_alteracoes;
*/

/* Verificação:
   select to_regprocedure('public.registrar_auditoria_alteracao()');  -- null
   select to_regclass('public.auditoria_alteracoes');                 -- null
   select count(*) from pg_trigger t
     where not t.tgisinternal
       and t.tgfoid = 'public.preencher_campos_auditoria()'::regprocedure;  -- 30
*/
