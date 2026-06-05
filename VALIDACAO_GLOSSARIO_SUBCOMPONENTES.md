# Validação — Glossário de Subcomponentes

Aba **Medidas e Tolerâncias** (área de Subcomponentes) · `especificacoes-subcomponentes.html`

## O que foi entregue
Botão **"Glossário de subcomponentes"** na barra de ações do topo da página. Ao
clicar, abre uma **página suspensa** (overlay) por cima de Medidas e Tolerâncias,
fechada apenas pelo **X** (ou tecla Esc). Dentro dela:

- **Admin**: adiciona quantos subcomponentes quiser, cada um com **foto WEBP**,
  **título** e **descrição**; pode **editar** e **excluir**.
- **Consulta / Fiscalização**: apenas **visualizam**; sem botões de adicionar,
  editar ou excluir (e bloqueio reforçado no banco via RLS).

Espelha a funcionalidade já existente do **"Glossário de defeitos"** (aba Reprovados).

## Persistência no Supabase
Tabela nova **`public.glossario_subcomponentes`** (mesma estrutura de
`glossario_defeitos`):

| coluna | uso |
|---|---|
| `titulo` | nome do subcomponente (obrigatório) |
| `descricao` | texto explicativo |
| `imagem` | foto WEBP como data URL base64 (gravada no próprio banco) |
| `criado_em` / `atualizado_em` / `criado_por` / `atualizado_por` | auditoria automática |

**RLS**: `SELECT` para qualquer usuário ativo; `INSERT/UPDATE/DELETE` somente admin
(`public.eh_admin()`).

➡️ **Rodar no Supabase antes de usar:** `supabase/2026-06-05-glossario-subcomponentes.sql`
(pré-requisito já existente: `supabase/2026-05-26-perfis-e-rls.sql`).

## Arquivos alterados / criados
- **+** `supabase/2026-06-05-glossario-subcomponentes.sql` — tabela + RLS + gatilho.
- **~** `js/store-supabase.js` — `listarGlossarioSubcomponentes`,
  `salvarGlossarioSubcomponente`, `removerGlossarioSubcomponente`.
- **~** `especificacoes-subcomponentes.html` — overlay do glossário + modal de
  formulário (admin); cache-bust do JS para `?v=20260605-glossario-subcomponentes`.
- **~** `js/especificacoes-subcomponentes.js` — botão no topo + módulo do glossário.

## Padrão Rumo (marca-rumo)
Nenhum CSS novo: o módulo reutiliza as classes já existentes em `css/style.css`
(`glossario-overlay`, `glossario-painel`, `glossario-cab`, `defeitos-grid`,
`defeito-card`, `defeito-preview`, `btn-verde`...), que já usam os tokens da marca
— cabeçalho em azul `#003865`, kicker em verde-claro, botão de ação em verde,
cards brancos com chanfro. Logo, herda a identidade Rumo sem reescrever estilo.

## Karpathy (guidelines)
- **Simplicidade / cirúrgico**: clonado o padrão validado do glossário de defeitos;
  zero refatoração de código adjacente; sem CSS novo (reuso de classes).
- **Sem colisões**: variáveis/funções com prefixo `glosSub` / `GLOS_SUB_`; reuso de
  `ehAdmin()` já existente na página.

## Verificações feitas
- `node -c` em `store-supabase.js` e `especificacoes-subcomponentes.js` — OK.
- Handlers `onclick`/`onchange` do HTML ↔ funções globais do JS — todos presentes.
- Todos os `getElementById('glosSub*')` do JS ↔ IDs no HTML — todos presentes.
