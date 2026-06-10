# Comemoração da Copa — "Rumo ao Hexa!!!" (20260610-copa-hexa-v1)

## O que faz
Sempre que uma gravação é **confirmada no Supabase** (novo documento, lançamento ou edição),
o site solta por ~4,5 segundos:
- confetes nas cores do Brasil (verde, amarelo, azul e branco);
- bolas de futebol, troféus e bandeiras caindo;
- o letreiro **"Rumo ao Hexa!!!"** caindo de cima para o centro da tela.

Depois disso o site volta ao normal. Exclusões de registros **não** comemoram.

## Como funciona
- `js/festa-hexa.js` embrulha automaticamente todas as funções `salvar*` de
  `StoreSupabase` e `StoreSubcomponentesSupabase`. A festa só dispara quando a
  Promise da gravação resolve com sucesso (erro = sem festa).
- Telas que gravam direto no Supabase chamam `FestaHexa.celebrar()` manualmente:
  - `js/data-books.js` (salvar Data book);
  - `js/migracao-inicial.js` (conclusão da migração).
- O script é incluído logo após `js/comum.js` em todas as páginas logadas.
- CSS é injetado pelo próprio módulo (nada foi alterado em `css/style.css`).
- Respeita `prefers-reduced-motion` (usuários com redução de movimento não veem o efeito).

## Liga/desliga (Administração)
Na página **Administração do Sistema → Dados do Sistema** há o card
**"Comemoração da Copa — Rumo ao Hexa"** com:
- botão **Ativar/Desativar comemoração** (preferência salva no navegador,
  chave `sq_festa_hexa_ativa` no localStorage; padrão: ativada);
- botão **Testar comemoração**.

## API
```js
FestaHexa.celebrar(); // dispara manualmente (se ativada)
FestaHexa.ativa();    // true/false
FestaHexa.definir(v); // liga (true) ou desliga (false)
FestaHexa.alternar(); // inverte o estado
```

## Arquivos alterados
- novo: `js/festa-hexa.js`
- `dados.html` (card do botão) e `js/dados.js` (lógica do botão)
- `js/data-books.js` e `js/migracao-inicial.js` (1 linha cada)
- todas as páginas com `comum.js` ganharam a tag `<script src="js/festa-hexa.js?...">`
