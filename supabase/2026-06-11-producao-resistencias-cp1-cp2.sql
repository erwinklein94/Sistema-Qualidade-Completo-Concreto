-- =====================================================================
-- PRODUÇÃO — Resistências com um corpo de prova (CP) por campo
-- Divide "Comp. Axial 7/14/28 dias" e "Tração Flexão 14/28 dias" em
-- dois campos (CP 1 e CP 2), migrando o histórico existente que está
-- gravado como "valor1 / valor2" numa única coluna.
--
-- Regra de migração (sem perda de informação):
--   • coluna original (comp_7, ...)  → fica só com o que vem ANTES da
--     primeira barra "/" (CP 1), sem espaços nas pontas;
--   • coluna nova (comp_7_cp2, ...)  → recebe TUDO o que vem depois da
--     primeira barra (CP 2). Se houver mais de uma barra, o restante é
--     preservado integralmente no CP 2;
--   • valores sem "/" permanecem intactos no CP 1, CP 2 fica nulo.
--
-- Idempotente: o UPDATE só toca linhas que ainda contêm "/" na coluna
-- original e cujo CP 2 ainda está vazio. Rodar duas vezes não altera nada.
-- Pré-requisito: colunas já em formato text
-- (supabase/2026-05-23-producao-campos-complementares.sql).
-- =====================================================================

alter table public.producao_lotes
  add column if not exists comp_7_cp2 text,
  add column if not exists comp_14_cp2 text,
  add column if not exists tracao_14_cp2 text,
  add column if not exists comp_28_cp2 text,
  add column if not exists tracao_28_cp2 text;

-- Comp. Axial 7 dias
update public.producao_lotes set
  comp_7_cp2 = nullif(btrim(substring(comp_7 from position('/' in comp_7) + 1)), ''),
  comp_7     = nullif(btrim(split_part(comp_7, '/', 1)), '')
where comp_7 like '%/%'
  and (comp_7_cp2 is null or btrim(comp_7_cp2) = '');

-- Comp. Axial 14 dias
update public.producao_lotes set
  comp_14_cp2 = nullif(btrim(substring(comp_14 from position('/' in comp_14) + 1)), ''),
  comp_14     = nullif(btrim(split_part(comp_14, '/', 1)), '')
where comp_14 like '%/%'
  and (comp_14_cp2 is null or btrim(comp_14_cp2) = '');

-- Tração na Flexão 14 dias
update public.producao_lotes set
  tracao_14_cp2 = nullif(btrim(substring(tracao_14 from position('/' in tracao_14) + 1)), ''),
  tracao_14     = nullif(btrim(split_part(tracao_14, '/', 1)), '')
where tracao_14 like '%/%'
  and (tracao_14_cp2 is null or btrim(tracao_14_cp2) = '');

-- Comp. Axial 28 dias
update public.producao_lotes set
  comp_28_cp2 = nullif(btrim(substring(comp_28 from position('/' in comp_28) + 1)), ''),
  comp_28     = nullif(btrim(split_part(comp_28, '/', 1)), '')
where comp_28 like '%/%'
  and (comp_28_cp2 is null or btrim(comp_28_cp2) = '');

-- Tração na Flexão 28 dias
update public.producao_lotes set
  tracao_28_cp2 = nullif(btrim(substring(tracao_28 from position('/' in tracao_28) + 1)), ''),
  tracao_28     = nullif(btrim(split_part(tracao_28, '/', 1)), '')
where tracao_28 like '%/%'
  and (tracao_28_cp2 is null or btrim(tracao_28_cp2) = '');

-- Conferência rápida (opcional): deve retornar 0 linhas com "/" restantes
-- select count(*) from public.producao_lotes
--  where comp_7 like '%/%' or comp_14 like '%/%' or tracao_14 like '%/%'
--     or comp_28 like '%/%' or tracao_28 like '%/%';
