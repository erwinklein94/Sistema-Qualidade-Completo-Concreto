# Fundo "Rumo ao Hexa" na tela de login

A imagem `assets/brand/login-bg-hexa.jpg` foi definida como plano de fundo da
página de login, cobrindo toda a tela (`background-size: cover`, centralizada),
mesmo que isso exija recorte/zoom em telas de proporção diferente. O card de
login fica por cima (`z-index: 1`) e permanece totalmente legível.

A textura diagonal decorativa anterior (`.login-page::before`) foi desativada
para a foto aparecer limpa.

## Arquivos alterados
- `assets/brand/login-bg-hexa.jpg` — imagem adicionada.
- `css/style.css` — bloco final "LOGIN — fundo Rumo ao Hexa": override de
  `.login-page` com a imagem em `cover`, `::before` oculto e card acima.
