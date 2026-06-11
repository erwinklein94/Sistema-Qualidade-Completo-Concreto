# Comemoração da Copa — "Rumo ao Hexa!!!" (20260610-copa-hexa-v2)

## O que faz
Sempre que uma gravação é **confirmada no Supabase** (novo documento, lançamento ou edição),
o site solta por ~4,5 segundos:
- confetes nas cores do Brasil (verde, amarelo, azul e branco);
- bolas de futebol, troféus e bandeiras caindo;
- o letreiro **"Rumo ao Hexa!!!"** caindo de cima para o centro da tela.

Depois disso o site volta ao normal. Exclusões de registros **não** comemoram.

## Liga/desliga GLOBAL (Administração)
Na página **Administração do Sistema → Dados do Sistema**, o card
**"Comemoração da Copa — Rumo ao Hexa"** tem o botão Ativar/Desativar e o
botão Testar comemoração.

A decisão do admin é **global**: fica salva no Supabase
(`configuracoes_sistema`, chave `festa_hexa_ativa`, `'1'` ativada / `'0'` desativada)
e vale para **todos os perfis** — admin, fiscalização e consulta — em qualquer
navegador. Cada página lê a configuração ao carregar; abas já abertas captam a
mudança no próximo lançamento ou ao serem recarregadas. O `localStorage`
(`sq_festa_hexa_ativa`) funciona só como cache da última leitura.

Permissões reaproveitam o RLS já existente da tabela: qualquer usuário ativo lê,
somente admin grava. O SQL `supabase/2026-06-10-festa-hexa-config.sql` semeia a
chave com descrição (opcional — sem a chave, o padrão é ativada e o botão a cria).

## Como funciona
- `js/festa-hexa.js` embrulha automaticamente todas as funções `salvar*` de
  `StoreSupabase` e `StoreSubcomponentesSupabase`. A festa só dispara quando a
  Promise da gravação resolve com sucesso (erro = sem festa).
- Telas que gravam direto no Supabase chamam `FestaHexa.celebrar()` manualmente:
  `js/data-books.js` (salvar Data book) e `js/migracao-inicial.js` (conclusão).
- O script é incluído logo após `js/comum.js` em todas as páginas logadas.
- CSS é injetado pelo próprio módulo (nada foi alterado em `css/style.css`).
- Respeita `prefers-reduced-motion`.

## API
```js
FestaHexa.celebrar();    // dispara manualmente (se ativada)
FestaHexa.ativa();       // true/false (cache local da configuração global)
FestaHexa.sincronizar(); // relê a configuração global no Supabase
FestaHexa.definir(v);    // ADMIN: grava no Supabase para todo o site
FestaHexa.alternar();    // ADMIN: inverte o estado global
```

## Arquivos alterados
- novo: `js/festa-hexa.js` e `supabase/2026-06-10-festa-hexa-config.sql`
- `dados.html` (card do botão) e `js/dados.js` (lógica do botão global)
- `js/data-books.js` e `js/migracao-inicial.js` (1 linha cada)
- todas as páginas com `comum.js` ganharam a tag `<script src="js/festa-hexa.js?...">`
