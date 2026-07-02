# Trem fujão na tela de login

Uma locomotiva SVG vetorizada, nas cores oficiais da Rumo (azul #003865,
azul claro, verde, verde claro, amarelo), passeia pela tela de login e
**foge do cursor** (ou do toque, no celular) quando ele se aproxima.

- Não interfere no formulário: a camada tem `pointer-events: none` e fica
  atrás do card de login (`z-index: 0`) e acima da foto de fundo.
- Física simples em JS puro: repulsão dentro de um raio de 180px, atrito e
  rebote suave nas bordas da tela; o trem vira para o lado em que corre.
- Balanço sutil contínuo (animação CSS `trem-bob`).
- Acessibilidade: com `prefers-reduced-motion: reduce`, o trem fica parado
  e sem animação; o elemento é `aria-hidden`.

## Arquivos alterados
- `js/login-trem-fujao.js` — novo script com o desenho SVG e a física.
- `css/style.css` — bloco `.login-trem` (posicionamento, sombra, balanço).
- `login.html` — inclusão do script.
- Todas as páginas — versão de cache de `style.css` e `comum.js`
  atualizada para `20260702-menu-trem-v1`.

## Liga/desliga global pelo Admin (2026-07-02)

O trem agora pode ser ativado/desativado pelo botão **"Trem fujão"** na
página **Dados do Sistema** (acessível só ao perfil admin). A decisão é
global: fica salva no Supabase (`configuracoes_sistema`, chave
`trem_fujao_login`) e vale para todos os visitantes da tela de login.

- Como a tela de login roda antes da autenticação, o script
  `supabase/2026-07-02-trem-fujao-login.sql` libera a leitura anônima
  **apenas dessa chave** (nenhuma outra configuração fica exposta) e a
  escrita continua exclusiva do admin pelas políticas já existentes.
- `'0'` = desativado. Ausência da chave, tabela inexistente ou falha de
  conexão = ativado (comportamento padrão).
- A mudança é aplicada quando a página de login é carregada.

### Passo obrigatório no Supabase
Rodar UMA vez no SQL Editor: `supabase/2026-07-02-trem-fujao-login.sql`
(requer o `2026-06-09-configuracoes-sistema.sql` já aplicado).

### Arquivos alterados nesta etapa
- `supabase/2026-07-02-trem-fujao-login.sql` — novo script.
- `dados.html` — card com o botão e status.
- `js/dados.js` — funções `alternarTremFujao`, `sincronizarTremFujao` e
  `atualizarBotaoTremFujao` (padrão da Festa Hexa).
- `js/login-trem-fujao.js` — só cria o trem se a configuração permitir.
