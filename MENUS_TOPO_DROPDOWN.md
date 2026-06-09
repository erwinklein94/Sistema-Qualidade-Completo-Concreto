# Navegação por menus dropdown no topo

O antigo botão "Menu" (que abria a barra lateral) foi **removido**. A navegação
agora é feita por botões dropdown no canto superior direito do cabeçalho:

- **Menu Concreto** — todas as abas do grupo Concreto.
- **Menu Subcomponente** — todas as abas de Subcomponentes.
- **Ferramentas** — todas as abas de Ferramentas.
- **Administração** — páginas de administração (Conexão Supabase, Usuários e
  Perfis, Auditoria Geral, Dados do Sistema). **Só aparece para administradores**;
  usuários comuns veem apenas os três botões acima.

Comportamento: apenas um painel aberto por vez; fecha ao clicar fora ou apertar
Esc; o item da página atual fica destacado; itens restritos só aparecem com permissão.

A barra lateral e seu botão de abertura foram retirados do layout. As funções
internas de menu permanecem definidas (com encadeamento opcional) para não
quebrar chamadas existentes.

## Arquivos alterados
- `js/comum.js` — dropdowns (`gruposDropdown`, `menuDropdownsHtml`,
  `alternarDropdown`, `fecharDropdowns`); remoção do botão "Menu" e da sidebar
  do `montarLayout`; fechamento por Esc/clique fora.
- `css/style.css` — estilos `.menu-dropdowns`/`.menu-dd*` (tema claro e escuro,
  com acento de cor por grupo) e ajuste de `.topo` (`overflow: visible` + faixa
  de gradiente arredondada) para os painéis não serem cortados.
