const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const fonte=fs.readFileSync(path.join(__dirname,'..','js','comum.js'),'utf8');

function menuPara(admin){
  const contexto={
    window:{Auth:{pode:acao=>admin&&(acao==='gerenciarSistema'||acao==='gerenciarUsuarios')}},
    ICN:new Proxy({}, {get:()=>'<svg></svg>'}),
    console
  };
  vm.createContext(contexto);
  vm.runInContext(`${fonte}\n;globalThis.__App=App;`,contexto);
  return contexto.__App.menuPermitido();
}

test('Painel de Sites aparece somente para Admin',()=>{
  const chave='ferramenta-painel-sites';
  assert.equal(menuPara(false).some(item=>item.k===chave),false);
  const item=menuPara(true).find(item=>item.k===chave);
  assert.ok(item);
  assert.equal(item.t,'Painel de Sites');
  assert.equal(item.href,'https://erwinklein94.github.io/Painel-Sites-Rumo/');
  assert.equal(item.group,'ferramentas');
  assert.equal(item.external,true);
  assert.equal(item.adminOnly,true);
});
