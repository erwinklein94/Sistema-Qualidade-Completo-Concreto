# Área CONPREM

Até 19/08/2026 as telas de dormentes de concreto misturavam **Cavan SP** e
**Conprem MG** nas mesmas tabelas, separadas só pela coluna `fornecedor`. A
partir daqui são duas áreas:

- **DORMENTES DE CONCRETO · CAVAN** — o menu que já existia, agora exclusivo da
  Cavan SP.
- **DORMENTES DE CONCRETO · CONPREM** — área nova, com tabelas próprias no
  Supabase e sete telas.

## As telas da Conprem

| Tela | Arquivo | JS |
|---|---|---|
| Dashboard Conprem | `conprem-dashboard.html` | `js/dashboard.js` |
| Leitor de Recebidos | `conprem-leitor.html` | `js/conprem-leitor/` |
| Pedidos | `conprem-pedidos.html` | `js/pedidos.js` |
| Produção de Dormentes | `conprem-producao.html` | `js/producao.js` |
| Dormentes Reprovados | `conprem-reprovados.html` | `js/reprovados.js` |
| Inspeção de Concretagem | `conprem-inspecao-concretagem.html` | `js/inspecao-concretagem.js` |
| Inspeção de Pista | `conprem-inspecao-pista.html` | `js/inspecao-pista.js` |

Salvo o Leitor, **o JS é o mesmo das telas da Cavan**. Não há cópia de lógica:
o que muda é a tabela de origem e o fornecedor.

## Como uma página escolhe a área

Cada HTML da Conprem declara a área antes de carregar os scripts do sistema:

```html
<script>window.AREA_EMPRESA = 'conprem';</script>
<script src="js/area.js"></script>
```

Sem essa declaração, tudo continua Cavan — que é o comportamento de todas as
telas antigas. `js/area.js` concentra as consequências disso:

| Chamada | Cavan | Conprem |
|---|---|---|
| `Area.fornecedor()` | `Cavan SP` | `Conprem MG` |
| `Area.tabela('producao_lotes')` | `producao_lotes` | `conprem_producao_lotes` |
| `Area.chaveMenu('producao')` | `producao` | `conprem-producao` |
| `Area.pagina('producao.html')` | `producao.html` | `conprem-producao.html` |
| `Area.home()` | `index.html` | `conprem-dashboard.html` |

Os três pontos de consumo:

- `js/store-supabase.js` passa todo `.from(...)` por `tab()`, que resolve o nome
  pela área. Só as seis tabelas com par por empresa mudam de nome; usuários,
  auditoria, especificações e subcomponentes continuam únicos.
- `js/config.js` expõe `CFG.listas.fornecedores` como *getter*, então todo
  `<select>` de fornecedor já nasce com a empresa certa — e só ela.
- `js/comum.js` traduz a chave do menu e o link da marca no topo.

## Tabelas

Criadas em `supabase/2026-08-19-area-conprem.sql`, com as mesmas colunas,
gatilhos de auditoria e políticas de RLS das originais:

| Tabela | Registros migrados |
|---|---|
| `conprem_producao_lotes` | 31 |
| `conprem_reprovados` | 7 |
| `conprem_inspecoes_pista` | 14 |
| `conprem_inspecoes_concretagem` | 19 |
| `conprem_pedidos_dormentes` | 0 (nova) |
| `conprem_ensaios_liberacao` | 0 (nova) |

As linhas saíram de verdade das tabelas antigas: depois da migração, o lado
Cavan não tem nenhum registro de outro fornecedor.

Duas ressalvas registradas na migração:

- A inspeção de concretagem com `fornecedor = 'Sim'` (erro de importação do
  iAuditor) ficou com a Conprem, já corrigida para `Conprem MG`.
- Dois registros de inspeção marcados como Conprem apontavam para lotes da
  Cavan (lotes 3259 e 3060). O vínculo com o lote foi desfeito — o número do
  lote continua gravado no próprio registro.

## Leitor de Recebidos

Porte do repositório [Leitor-Recebidos-Conprem](https://github.com/erwinklein94/Leitor-Recebidos-Conprem)
para dentro do sistema. Os parsers, o grid de coordenadas, o `schema.js` e o
gerador de `.xlsx` vieram **sem alteração**; o que mudou foi a moldura (login,
menu e tema do sistema) e uma função nova.

```
js/conprem-leitor/
  main.js        ligação da interface (adaptado)
  schema.js      ORDEM DAS COLUNAS — fonte da verdade do xlsx
  gravacao.js    NOVO — gravação opcional no Supabase
  core/          pdf.js -> fragmentos com coordenadas; grid.js -> linhas/colunas
  parsers/       um parser por modelo de PDF + detecção automática
  xlsx/          gerador de .xlsx (zip.js + writer.js)
  ui/            dropzone e prévia
vendor/pdfjs/    pdf.js 4.10.38 (Apache-2.0), versionado
```

A leitura continua **inteiramente no navegador** — nenhum PDF é enviado a
lugar nenhum. O dashboard de gráficos do repositório de origem não veio junto:
na área Conprem quem faz esse papel é o **Dashboard Conprem**, igual ao da
Cavan e alimentado pelo banco, não pelos PDFs da sessão.

### Gravar no banco (opcional)

Depois da prévia, a tela oferece gravar cada aba na área Conprem:

| Aba do PDF | Vai para | Como |
|---|---|---|
| Rastreabilidade | Produção de Dormentes | um lote por linha, com as 32 colunas do mapa |
| Ensaios | Ensaios de Liberação | um ensaio por lote, com o resultado geral |
| Resumo Semanal | Dormentes Reprovados | uma linha por tipo de refugo com quantidade |

### As colunas do Mapa de Rastreabilidade

A Produção ganhou uma seção **Rastreabilidade — Mapa CONPREM** com os 26 campos
que o mapa traz e que não tinham lugar antes: ordem de fabricação, cliente,
produto, série de concreto, os sequenciais e certificados (interno e externo)
de aço, cimento, areia, brita, aditivo e adição, os itens de fixação (grampo,
isoladores, palmilhas) e observações. Os outros seis do relatório — semana,
pedido, lote, data de fabricação, quantidade e lote da ombreira — já tinham
campo e continuam onde estavam.

Todos são texto, de propósito: o PDF traz NF e certificado com zero à esquerda
(`031/26`, `00281/2026`) e às vezes mais de um valor na mesma célula, unidos por
`; `. Guardar como texto preserva os dois casos.

Duas escolhas de mapeamento que valem registro:

- **Série concreto** vai para a coluna `serie_concreto`, não para `serie`. A
  `serie` é a série de liberação do fluxo da Cavan e significa outra coisa.
- **Produto** guarda a descrição comercial completa (`DORMENTE MONOBLOCO
  PROTENDIDO - BIT 1.600 ...`). O campo **Tipo** continua sendo a lista curta do
  sistema e não recebe esse texto, para não sujar o filtro da tela.

A seção só aparece na ficha do lote quando há dado nela — os lotes antigos, da
Cavan e da Conprem, não ganham 26 linhas vazias. **Nenhum registro anterior foi
alterado**: as colunas nasceram vazias no histórico existente.

Nada é gravado sem clique, e registro que já existe é **mantido**, não
sobrescrito — reimportar o mesmo PDF não duplica.

Três campos que as tabelas exigem e os PDFs não trazem:

- **Projeto** — os relatórios trazem o produto (`DORMENTE MONOBLOCO PROTENDIDO -
  BIT 1.600 ...`) e o destino da carga (`CHAPADÃO DO SUL MS`), não o nome do
  projeto. A tela pede que o usuário escolha, e sem essa escolha o botão de
  gravar fica travado. Quando o nome do projeto aparece escrito em algum
  relatório, o campo já vem sugerido.
- **Série liberada** (ensaios) — vem do `Série concreto` do Mapa de
  Rastreabilidade, cruzando pelo número do lote. Sem o mapa no lote de arquivos,
  o próprio lote responde pela série: a CONPREM ensaia um lote por vez, sem o
  agrupamento em séries que a Cavan usa.
- **Lote** (reprovados) — o Resumo Semanal conta refugo da semana inteira, não
  de um lote. Grava-se `Semana 2026-S33`, escrito assim justamente para não se
  confundir com número de lote de verdade.

A **bitola** é deduzida do produto, que aparece de duas formas nos relatórios:
por extenso no Resumo (`BIT LARGA`) e em milímetros na Rastreabilidade
(`BIT 1.600`). No PDF de ensaio a coluna vem vazia, então ali a bitola também
sai do Mapa de Rastreabilidade pelo número do lote.

## O que ficou de fora

- **Indicador Semanal, Fluxo de Liberação, Rastreabilidade, RNC, ensaios de
  bitola/USP/acompanhamento e Comparativo de Cura** seguem só na Cavan. Não há
  dado da Conprem neles.
- `migracao-inicial.html` é uma ferramenta antiga de carga da planilha, fora do
  menu, e ainda grava a aba "Produção - Conprem MG" pela área ativa. Se um dia
  for usada de novo, precisa rodar a partir de uma página da Conprem.
