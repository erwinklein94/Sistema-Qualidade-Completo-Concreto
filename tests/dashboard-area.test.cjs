const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('dashboard Cavan não oferece Conprem no filtro de fornecedor', () => {
  const elements = new Map();
  const document = {
    addEventListener() {},
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, { value: '', innerHTML: '' });
      return elements.get(id);
    },
  };
  const U = {
    norm: (valor) => String(valor).trim().toUpperCase(),
    bitolaDe: (registro) => registro.bitola || '',
    opcoes: (valores, atual, placeholder) => [placeholder, ...valores].join('|'),
  };
  const CFG = { listas: { fornecedores: ['Cavan SP'], projetos: [], bitolas: [] } };
  const ctx = vm.createContext({ document, window: {}, console, U, CFG });

  vm.runInContext(fs.readFileSync(path.join(root, 'js/dashboard.js'), 'utf8'), ctx);
  vm.runInContext(`
    Dashboard.prod = [{ fornecedor: 'Cavan SP' }, { fornecedor: 'Conprem MG' }];
    Dashboard.rep = [{ fornecedor: 'Conprem MG' }];
    Dashboard.ens = [];
    atualizarFiltrosComDados();
  `, ctx);

  assert.equal(document.getElementById('fFornecedor').innerHTML, 'Todos|Cavan SP');
  assert.doesNotMatch(document.getElementById('fFornecedor').innerHTML, /Conprem/i);
});
