# Navegação por menus dropdown no topo

O antigo botão "Menu" (que abria a barra lateral) foi removido. A navegação é
feita por botões dropdown no canto superior direito do cabeçalho:

- **Menu Concreto** — abas do grupo Concreto.
- **Menu Subcomponente** — abas de Subcomponentes.
- **Ferramentas** — Leitor de Iauditor, Data Books, Controle de Equipamentos e Guia do Inspetor Padrão.
- **Administração** — só para administradores (Conexão Supabase, Usuários e Perfis,
  Auditoria Geral, Dados do Sistema).

Apenas um painel aberto por vez; fecha ao clicar fora ou apertar Esc; item da
página atual destacado; itens restritos só aparecem com permissão.

## Data Books reativado no menu de Ferramentas
A ferramenta **Data Books** voltou a aparecer no menu **Ferramentas** para usuários com perfil **admin**.

Arquivos ativos:
- Página: `data-books.html`.
- Script leve: `js/data-books.js`, consultando a tabela `public.data_books_dormentes` no Supabase.
- SQL oficial: `supabase/2026-05-31-data-books-dormentes-admin.sql`.

A base de Data Books não fica carregada dentro do JavaScript do site. Os registros iniciais são enviados ao Supabase pelo SQL, e a tela busca apenas páginas resumidas sob demanda.

A ferramenta **Flash-Cards** continua fora do menu principal para evitar aumentar o peso do pacote de navegação.
