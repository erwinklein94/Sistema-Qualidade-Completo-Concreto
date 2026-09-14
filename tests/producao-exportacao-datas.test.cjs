const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const fonte = fs.readFileSync(path.join(__dirname, '..', 'js', 'producao.js'), 'utf8');
const inicio = fonte.indexOf('function linhaPlanilhaAntigaProducao');
const contexto = vm.createContext({ Date });

vm.runInContext(`${fonte.slice(inicio)}\n;globalThis.__linha = linhaPlanilhaAntigaProducao;`, contexto);

test('exportação envia datas ISO para o Power Automate não inverter dia e mês', () => {
  const linha = contexto.__linha({
    dataFabricacao: '2026-09-11',
    cura14: '2026-09-25',
    cura28: '2026-10-09',
  });

  assert.equal(linha.dataFabricacao, '2026-09-11');
  assert.equal(linha.cura14, '2026-09-25');
  assert.equal(linha.cura28, '2026-10-09');
  assert.equal(linha.ruptura7Comp, '2026-09-18');
  assert.equal(linha.ruptura14Comp, '2026-09-25');
  assert.equal(linha.ruptura28Comp, '2026-10-09');
});
