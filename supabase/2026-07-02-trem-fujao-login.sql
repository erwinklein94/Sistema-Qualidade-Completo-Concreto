-- =====================================================================
-- Trem fujão da tela de login — liga/desliga global decidido pelo Admin
-- Chave: trem_fujao_login ('1' = ativado, '0' = desativado)
--
-- A tela de login roda ANTES da autenticação, então este script libera
-- a leitura anônima APENAS desta chave. Nenhuma outra linha de
-- configuracoes_sistema fica visível para visitantes não logados, e a
-- escrita continua exclusiva do perfil admin (políticas já existentes).
--
-- Pré-requisito: supabase/2026-06-09-configuracoes-sistema.sql já rodado.
-- Rode este script no SQL Editor do Supabase UMA vez.
-- =====================================================================

-- Chave global (padrão: ativado)
insert into public.configuracoes_sistema (chave, valor, descricao)
values (
  'trem_fujao_login',
  '1',
  'Trem fujão da tela de login: locomotiva animada que foge do cursor. ''1'' = ativado, ''0'' = desativado. Decisão global do Admin, aplicada a todos os visitantes.'
)
on conflict (chave) do nothing;

-- Leitura anônima SOMENTE da chave do trem (a tela de login não tem sessão)
grant select on table public.configuracoes_sistema to anon;

drop policy if exists "configuracoes_sistema_select_anon_trem_fujao" on public.configuracoes_sistema;
create policy "configuracoes_sistema_select_anon_trem_fujao"
on public.configuracoes_sistema
for select
to anon
using (chave = 'trem_fujao_login');
