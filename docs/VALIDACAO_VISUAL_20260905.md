# Renovação visual — 05/09/2026

A camada compartilhada `css/rumo-ui.css` é carregada depois dos estilos existentes nas 38 páginas. Mantém a paleta Rumo, renova cabeçalho, cartões, filtros, formulários, tabelas, menus e login. As regras são restritas a telas para preservar a impressão.

## Verificação

- Renderização local no Microsoft Edge via Playwright em 1440 × 1000 e 390 × 1000.
- Páginas representativas: login, dashboard Cavan, produção, dashboard Conprem e subcomponentes.
- Temas claro e escuro, com inspeção das capturas após as transições.
- Nenhum transbordamento horizontal nas 18 combinações verificadas.
- Menus compartilhados abrem por clique e fecham por Escape.
- Nenhum erro JavaScript no ambiente de prévia; `git diff --check` aprovado.

A prévia remove os scripts de dados e autenticação e carrega o layout compartilhado real. Os indicadores usam traços, sem números fictícios. Essa verificação cobre apresentação e navegação compartilhada; não valida login real, gráficos com dados nem operações no banco.
