# Validação — Glossário de Subcomponentes

Botão **"Glossário de subcomponentes"** disponível em **duas abas** da área de
Subcomponentes, mostrando **a mesma informação** (mesma tabela do Supabase):

1. **Medidas e Tolerâncias** — `especificacoes-subcomponentes.html`
2. **Materiais Subcomponentes** — `subcomponentes.html#materiais`

Ao clicar (em qualquer das duas), abre a **mesma página suspensa** (overlay),
fechada pelo **X** (ou tecla Esc).

## Sem duplicação — módulo único compartilhado
Toda a lógica **e** o markup do glossário ficam num só arquivo:
**`js/glossario-subcomponentes.js`**. Ele:
- injeta o overlay + formulário no `body` via JS (nenhuma página repete o HTML);
- expõe `window.abrirGlossarioSub()` e os handlers do formulário;
- lê/grava na mesma tabela `glossario_subcomponentes` via `StoreSupabase`.

As duas páginas apenas **carregam o módulo** e **adicionam um botão** que chama
`abrirGlossarioSub()`. Editar o conteúdo numa aba reflete na outra (mesma fonte).

## Permissões
- **Admin**: adiciona/edita/exclui (foto WEBP + título + descrição).
- **Consulta / Fiscalização**: apenas visualizam (sem botões de escrita; bloqueio
  reforçado no banco por RLS).

## Persistência no Supabase
Tabela **`public.glossario_subcomponentes`** (`titulo`, `descricao`, `imagem` WEBP
em base64, + auditoria). RLS: `SELECT` para usuário ativo; escrita só admin.

-> Rodar uma vez no Supabase: `supabase/2026-06-05-glossario-subcomponentes.sql`.

## Arquivos
- (+) `js/glossario-subcomponentes.js` — módulo único (lógica + markup injetado).
- (+) `supabase/2026-06-05-glossario-subcomponentes.sql` — tabela + RLS + gatilho.
- (~) `js/store-supabase.js` — funções listar/salvar/remover do glossário.
- (~) `especificacoes-subcomponentes.html` — carrega o módulo; markup inline removido.
- (~) `js/especificacoes-subcomponentes.js` — só o botão no topo (módulo extraído).
- (~) `subcomponentes.html` — carrega o módulo; cache-bust atualizado.
- (~) `js/subcomponentes.js` — botão na aba Materiais + binding ao módulo.

## Padrão Rumo (marca-rumo)
Sem CSS novo: reuso das classes já existentes (`glossario-overlay`, `defeito-card`,
`btn-verde`...), que já carregam os tokens da marca (azul #003865, verde-claro,
botão verde, cards com chanfro).

## Karpathy (guidelines)
- Sem duplicação: lógica e markup num único módulo; as abas só acrescentam um botão.
- Cirúrgico: nas páginas existentes só entraram o <script> e o botão.
- Sem colisão de escopo: módulo em IIFE, expondo apenas a API window.*GlosSub*.

## Verificações feitas
- node -c em glossario-subcomponentes.js, store-supabase.js,
  especificacoes-subcomponentes.js e subcomponentes.js — OK.
- Módulo carregado nas duas páginas; ambos os botões chamam abrirGlossarioSub().
- Handlers do markup injetado <-> API pública do módulo — todos presentes.
- Markup inline antigo removido de especificacoes-subcomponentes.html (0 ocorrências).
