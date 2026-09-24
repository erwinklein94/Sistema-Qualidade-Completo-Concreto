const test = require('node:test');
const assert = require('node:assert/strict');
const RelatorioLote = require('../js/relatorio-lote');

const lote = {
  id: 'producao-2838', lote: '2838', fornecedor: 'Cavan SP', projeto: 'FERRO NORTE',
  pista: '4', serie: 'Série 14-1 - FN', total: '275', reprovados: '0',
  dataFabricacao: '2026-05-11', cura14: '2026-05-25',
  periodoIni: '2026-05-07', periodoFim: '2026-05-13',
};
const contexto = { producao: [lote], ensaios: [], pedidos: [] };
const extras = overrides => ({
  reprovados: { ok: true, rows: [] }, pista: { ok: true, rows: [] },
  concretagem: { ok: true, rows: [] }, rnc: { ok: true, rows: [] },
  aviso: { ok: true, row: null }, logo: 'logo.png', ...overrides,
});

test('vincula refugo por ID e aceita o nome alternativo Cavan', () => {
  const d = RelatorioLote.prepararCavan(lote, contexto, extras({ reprovados: { ok: true, rows: [
    { lote: '2838', fornecedor: 'Cavan - Santa Lucia', total_refugos: 2 },
    { lote: '2838', fornecedor: 'Conprem MG', total_refugos: 7 },
    { lote: '2838', fornecedor: 'Cavan SP', producao_lote_id: 'outro', total_refugos: 9 },
  ] } }));
  assert.equal(d.refugos, 2);
  assert.equal(d.rep.length, 1);
});

test('não transforma falha de consulta em ausência de refugo', () => {
  const d = RelatorioLote.prepararCavan(lote, contexto, extras({ reprovados: { ok: false, rows: [] } }));
  assert.match(RelatorioLote.corpoCavan(d), /Consulta indisponível no momento/);
});

test('escapa texto do banco e mantém campos vazios explícitos', () => {
  const d = RelatorioLote.prepararCavan({ ...lote, motivo: '<img src=x onerror=alert(1)>', ombreira: '' }, contexto, extras());
  const html = RelatorioLote.corpoCavan(d);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<img src=x onerror/);
  assert.match(html, /não informado/);
});

test('o modelo Conprem exibe somente os campos próprios dessa área', () => {
  const html = RelatorioLote.corpoConprem({ lote: 'A-12', total: '330', cimentoSeqNf: 'NF 123' }, [
    { grupo: 'Cimento', itens: [['cimentoSeqNf', 'Seq./NF']] },
  ], 'logo.png');
  assert.match(html, /NF 123/);
  assert.match(html, /Mapa de rastreabilidade/);
  assert.doesNotMatch(html, /Desprotensão/);
});

test('a Cavan preserva as quatro partes A4 e a comparação visual', () => {
  const outro = { ...lote, id: 'producao-2835', lote: '2835', desproIni: '33', comp14Cp1: '66' };
  const d = RelatorioLote.prepararCavan({ ...lote, desproIni: '26,77', comp14Cp1: '58,99' },
    { ...contexto, producao: [{ ...lote, desproIni: '26,77', comp14Cp1: '58,99' }, outro] }, extras());
  const html = RelatorioLote.corpoCavan(d);
  assert.equal((html.match(/class="section page-break"/g) || []).length, 3);
  assert.match(html, /class="bar-row selected"/);
  assert.match(html, /Média dos lotes com valor/);
});
