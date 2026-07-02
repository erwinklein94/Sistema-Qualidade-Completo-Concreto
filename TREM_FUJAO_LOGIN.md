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
