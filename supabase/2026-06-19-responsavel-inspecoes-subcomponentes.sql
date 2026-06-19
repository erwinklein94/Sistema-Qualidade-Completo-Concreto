/* =====================================================================
   RESPONSÁVEL PELA INSPEÇÃO — Subcomponentes / Supabase

   Rode este arquivo no Supabase SQL Editor DEPOIS de:
   - supabase/2026-05-31-subcomponentes-integrado-concreto.sql (tabela base)

   Conteúdo:
   1) Adiciona a coluna responsavel em inspecoes_subcomponentes.
   2) Faz o preenchimento inicial (backfill) das inspeções já existentes
      com "Erwin Klein", que foi o fiscal responsável por todas as
      inspeções realizadas até esta mudança.

   Observação: o backfill só preenche linhas sem responsável. Inspeções
   novas, criadas depois desta migração, recebem o responsável informado
   no formulário da tela "Inspeções Subcomponentes".
   ===================================================================== */

/* ---------------------------------------------------------------------
   1) Coluna do responsável pela inspeção
   --------------------------------------------------------------------- */
alter table public.inspecoes_subcomponentes
  add column if not exists responsavel text;

/* ---------------------------------------------------------------------
   2) Backfill: inspeções já existentes -> Erwin Klein
   --------------------------------------------------------------------- */
update public.inspecoes_subcomponentes
   set responsavel = 'Erwin Klein'
 where responsavel is null
    or btrim(responsavel) = '';

/* ---------------------------------------------------------------------
   Verificação rápida
   ---------------------------------------------------------------------

   select column_name from information_schema.columns
     where table_name = 'inspecoes_subcomponentes' and column_name = 'responsavel';

   select count(*) filter (where responsavel = 'Erwin Klein') as com_erwin,
          count(*) as total
     from public.inspecoes_subcomponentes;
*/
