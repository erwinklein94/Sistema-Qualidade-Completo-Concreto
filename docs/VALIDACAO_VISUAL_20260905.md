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

## Padronização a partir da referência visual

A segunda revisão substitui o cabeçalho antigo por um componente de duas faixas em `App.montarLayout`: marca, módulos e tema na primeira; título, usuário e ações na segunda. Os títulos e as ações continuam definidos pelas páginas. As regras específicas antigas deixam de reorganizar essas áreas. O fundo usa uma ilustração vetorial de trilhos, com as cores da Rumo.

- Estilos atualizados nas 38 páginas; componente compartilhado nas 36 páginas internas.
- Verificação local das 36 páginas internas em 1440, 1024 e 390 pixels, em claro e escuro: 216 combinações.
- Incluídas as classes de página adicionadas pelos scripts, para verificar conflitos com os estilos específicos de produção, ensaios, subcomponentes e demais áreas.
- Conferidos carregamento do logo, layout único, ausência de transbordamento horizontal, abertura dos menus dentro da tela e fechamento por Escape.
- Conta e ações na prévia são elementos de validação. Não foi usada sessão real nem foram executadas operações no banco.
