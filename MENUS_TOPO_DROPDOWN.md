# Navegação por menus dropdown no topo

O antigo botão "Menu" (que abria a barra lateral) foi removido. A navegação é
feita por botões dropdown no canto superior direito do cabeçalho:

- **Menu Concreto** — abas do grupo Concreto.
- **Menu Subcomponente** — abas de Subcomponentes.
- **Ferramentas** — Leitor de Iauditor, Controle de Equipamentos e Guia do Inspetor Padrão.
- **Administração** — só para administradores (Conexão Supabase, Usuários e Perfis,
  Auditoria Geral, Dados do Sistema).

Apenas um painel aberto por vez; fecha ao clicar fora ou apertar Esc; item da
página atual destacado; itens restritos só aparecem com permissão.

## Remoção de Data Books e Flash-Cards (site mais leve)
As ferramentas **Data books** e **Flash-Cards** foram totalmente removidas do site:
- Páginas: `data-books.html`, `flash-cards.html`.
- Scripts: `js/data-books.js`, `js/flash-cards.js`, `js/flash-cards-dados.js` (este sozinho ~154 KB).
- Estilo: `css/flash-cards-integrado.css`.
- Entradas de menu em `js/comum.js`; blocos de config em `js/ferramentas.js`;
  bloco de CSS de Data Books em `css/style.css`; rótulo de auditoria em `js/auditoria.js`.

Total removido: ~234 KB de assets do front-end (sem contar a limpeza no `style.css`).
