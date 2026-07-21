-- A sincronização do SafetyCulture passou a criar lotes de produção a partir da
-- inspeção de concretagem, mas a 2026-07-16-integracao-safeculture.sql só havia
-- concedido leitura em producao_lotes ao service_role. Toda inspeção que
-- precisava cadastrar o lote falhava com "permission denied" (42501) e, como
-- qualquer erro congelava o checkpoint, a integração inteira parava.
grant insert, update on table public.producao_lotes to service_role;
