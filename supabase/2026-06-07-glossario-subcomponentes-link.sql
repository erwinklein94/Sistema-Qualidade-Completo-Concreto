-- =====================================================================
-- GLOSSÁRIO DE SUBCOMPONENTES — adiciona o campo "Link do relatório"
--
-- Acrescenta a coluna link_relatorio à tabela criada em
-- supabase/2026-06-05-glossario-subcomponentes.sql.
-- O link é exibido no card como o botão "Ver relatório" (abre em nova aba),
-- visível a todos os perfis; preenchido apenas pelo admin ao editar.
--
-- Seguro re-executar (idempotente). RLS e gatilhos da tabela continuam valendo.
-- =====================================================================

alter table public.glossario_subcomponentes
  add column if not exists link_relatorio text;
