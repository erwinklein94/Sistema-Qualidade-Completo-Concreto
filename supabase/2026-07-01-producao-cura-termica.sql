-- =====================================================================
-- PRODUÇÃO — Marcação de "Cura Térmica" por lote
-- Rode no Supabase > SQL Editor.
--
-- Motivo:
-- Lotes de cura térmica exigem um ENSAIO DE ACOMPANHAMENTO aos 14 dias
-- (informativo, com relatório iAuditor, mas que NÃO libera a série) e a
-- LIBERAÇÃO só ocorre no ensaio de 28 dias. Esta flag é lida na Produção
-- e propagada para o Fluxo de Liberação / Painel de Séries.
--
-- Idempotente: rodar duas vezes não altera nada.
-- =====================================================================

alter table public.producao_lotes
  add column if not exists cura_termica boolean not null default false;
