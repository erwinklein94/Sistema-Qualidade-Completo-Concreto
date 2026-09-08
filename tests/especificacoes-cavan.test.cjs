const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');

function carregar() {
  const elements = new Map();
  const document = {
    addEventListener() {},
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, { value: '', innerHTML: '', classList: { add() {}, remove() {} } });
      return elements.get(id);
    },
  };
  const ctx = vm.createContext({ document, window: {}, console });
  for (const file of ['js/especificacoes-cavan.js', 'js/especificacoes-dormentes.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx);
  }
  return { ctx, document, dados: vm.runInContext('ESPEC_PADROES_DORMENTES', ctx), campos: vm.runInContext('CAMPOS', ctx) };
}

test('cargas por projeto correspondem às células dos cinco anexos, em kN', () => {
  const { dados } = carregar();
  const esperados = {
    'MALHA PAULISTA BITOLA MISTA': ['256,54','191,08','53,50','76,43','384,81','53,88'],
    'MALHA PAULISTA BITOLA LARGA': ['193,94','144,43','44,76','63,87','290,91','53,88'],
    'FERRO NORTE': ['234,75','174,95','46,84','66,91','352,13','53,38'],
    FMT: ['193,47','143,95','44,76','63,87','290,21','53,38'],
    'MALHA CENTRAL': ['180,33','134,28','37,13','53,04','270,05','53,38'],
  };
  const campos = ['momento_positivo_apoio_trilho','momento_negativo_apoio_trilho','momento_positivo_centro','momento_negativo_centro','ancoragem','arrancamento_ombreira_a'];
  assert.equal(Object.keys(dados).length, 5);
  for (const [projeto, valores] of Object.entries(esperados)) {
    campos.forEach((campo,i) => assert.ok(dados[projeto][campo].startsWith(`${valores[i]} kN`), `${projeto}: ${campo}`));
  }
});

test('todos os campos novos podem ser exibidos, editados e persistidos', () => {
  const { dados, campos } = carregar();
  assert.equal(new Set(campos).size, campos.length);
  for (const r of Object.values(dados)) {
    for (const k of Object.keys(r)) assert.ok(campos.includes(k), `Campo sem formulário: ${k}`);
    assert.ok(r.fonte_documental.includes('.xlsx'));
    assert.ok(r.pendencias_confirmacao);
  }
});

test('nominais substituem leituras e grandezas/pendências ficam separadas', () => {
  const { dados } = carregar();
  const mp = dados['MALHA PAULISTA BITOLA LARGA'];
  const fn = dados['FERRO NORTE'];
  const mc = dados['MALHA CENTRAL'];
  assert.match(mp.comp_axial_28_dias, /65 MPa/);
  assert.match(mp.tracao_flexao_28_dias, /7,5 MPa/);
  assert.match(mp.momento_fletor_positivo_apoio, /30,6 kN·m/);
  assert.match(mp.documental_cimento, /CIMENTO/);
  assert.match(fn.inclinacao_base_apoio_trilhos, /Pendente.*1:20/);
  assert.match(dados.FMT.desenho_referencia, /D205/);
  assert.match(dados['MALHA PAULISTA BITOLA MISTA'].base_retangular, /Pendente.*265.*264/);
  for (const r of [fn, mc]) {
    assert.equal(r.base_retangular, undefined);
    assert.match(r.largura_base_apoio, /300 mm/);
    assert.match(r.largura_base_centro, /240 mm/);
    assert.equal(r.usp_carga_arrancamento, undefined);
  }
  assert.equal(dados.FMT.arrancamento_ombreira_c, undefined);
  for (const r of Object.values(dados)) {
    assert.match(r.empeno_transversal_entre_apoios, /≤1 mm/);
    assert.doesNotMatch(r.aderencia_escorregamento_aco, /0,000/);
    assert.equal(r.dist_interna_ombreiras_externas, undefined);
  }
});

test('trocar Mista por MC no formulário limpa USP e ombreira C', () => {
  const { ctx, document, campos } = carregar();
  campos.forEach(c => document.getElementById(c));
  document.getElementById('projeto').value = 'MALHA PAULISTA BITOLA MISTA';
  vm.runInContext('aplicarPadraoProjeto()', ctx);
  assert.match(document.getElementById('usp_carga_arrancamento').value, /58,90/);
  document.getElementById('projeto').value = 'MALHA CENTRAL';
  vm.runInContext('aplicarPadraoProjeto()', ctx);
  assert.equal(document.getElementById('usp_carga_arrancamento').value, '');
  assert.equal(document.getElementById('arrancamento_ombreira_c').value, '');
  assert.match(document.getElementById('momento_positivo_apoio_trilho').value, /180,33/);
  document.getElementById('id').value = 'registro-salvo';
  document.getElementById('momento_positivo_apoio_trilho').value = 'Edição manual';
  vm.runInContext('aplicarPadraoProjeto()', ctx);
  assert.equal(document.getElementById('momento_positivo_apoio_trilho').value, 'Edição manual');
});

test('um registro salvo continua tendo precedência e não duplica o modelo', () => {
  const { ctx, dados } = carregar();
  ctx.registro = { ...dados.FMT, id: 'fmt-salvo', momento_positivo_apoio_trilho: '193,48 kN — revisão posterior' };
  vm.runInContext('ESPEC_REGISTROS = [registro]', ctx);
  const lista = vm.runInContext('listaComPadroes()', ctx);
  assert.equal(lista.length, 5);
  const fmt = lista.find(r => r.projeto === 'FMT');
  assert.equal(fmt._padrao, false);
  assert.match(fmt.momento_positivo_apoio_trilho, /193,48/);
});
