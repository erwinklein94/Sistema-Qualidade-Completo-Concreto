-- =====================================================================
-- Comemoração da Copa — chave global festa_hexa_ativa
-- Reaproveita a tabela public.configuracoes_sistema criada em
-- 2026-06-09-configuracoes-sistema.sql (leitura: usuários ativos;
-- escrita: somente admin).
--
-- Rodar este script é OPCIONAL: se a chave não existir, o site assume
-- a comemoração como ATIVADA e o próprio botão do admin cria a linha
-- na primeira alteração. O script apenas semeia a chave com descrição.
--
-- Valores: '1' = comemoração ativada (padrão) | '0' = desativada.
-- =====================================================================

insert into public.configuracoes_sistema (chave, valor, descricao)
values (
  'festa_hexa_ativa',
  '1',
  'Comemoração da Copa do Mundo ("Rumo ao Hexa!!!"): confetes e itens de futebol exibidos a cada gravação confirmada no Supabase. 1 = ativada para todos os perfis; 0 = desativada. Alterada pelo admin em Dados do Sistema.'
)
on conflict (chave) do nothing;
