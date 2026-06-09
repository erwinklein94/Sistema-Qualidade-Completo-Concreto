# Menus dropdown no topo (Concreto / Subcomponente / Ferramentas)

Foram adicionados três botões de menu no canto superior direito do cabeçalho,
lado a lado e próximos entre si:

- **Menu Concreto** — todas as abas do grupo Concreto (Dashboard, Indicador Semanal,
  Fluxo de Liberação, Painel de Séries, Produção de Dormentes, Pedidos, Ensaios de
  Liberação, Dormentes Reprovados, Especificações e Limites).
- **Menu Subcomponente** — todas as abas de Subcomponentes.
- **Ferramentas** — todas as abas de Ferramentas.

Cada botão abre um painel suspenso com os respectivos links. Comportamento:
apenas um painel aberto por vez; fecha ao clicar fora ou apertar Esc; o item da
página atual fica destacado; itens restritos (admin) só aparecem com permissão.

O menu lateral original (botão "Menu" à esquerda) continua funcionando e mantém
o acesso à seção "Administração do Sistema".

## Arquivos alterados
- `js/comum.js` — métodos `gruposDropdown`, `menuDropdownsHtml`, `alternarDropdown`,
  `fecharDropdowns`; inserção no topo e fechamento por Esc/clique fora.
- `css/style.css` — estilos `.menu-dropdowns`/`.menu-dd*` (claro e escuro) e ajuste
  de `.topo` (`overflow: visible` + faixa de gradiente arredondada) para os painéis
  não serem cortados.
