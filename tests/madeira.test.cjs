const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Madeira=require('../js/madeira-comum.js');
const carga=fs.readFileSync(path.join(__dirname,'../supabase/2026-09-09-area-madeira-carga-historico.sql'),'utf8');
const registros=[...carga.matchAll(/null::public\.madeira_inspecoes, '((?:[^']|'')*)'::jsonb/g)].map(m=>JSON.parse(m[1].replace(/''/g,"'")));
test('quatro arquivos geram 358 auditIDs únicos e cinco versões identificáveis',()=>{
  assert.equal(registros.length,358);assert.equal(new Set(registros.map(r=>r.audit_id)).size,358);
  const por=Object.fromEntries(Object.keys(Madeira.VERSOES).map(k=>[k,registros.filter(r=>r.tipo_relatorio===k).length]));
  assert.deepEqual(por,{recebimento_v1:58,recebimento_v2:100,recebimento_v3:100,recebimento_v4:99,dormente_lei_fornecedor:1});
  assert.equal(registros.filter(r=>r.status==='concluida').length,343);
});
test('cada versão preserva todas as colunas do Excel',()=>{
  const cols={recebimento_v1:53,recebimento_v2:55,recebimento_v3:59,recebimento_v4:57,dormente_lei_fornecedor:157};
  registros.forEach(r=>assert.equal(Object.keys(r.dados_originais).length,cols[r.tipo_relatorio],r.audit_id));
  assert.equal(new Set(registros.map(r=>r.fonte_sha256)).size,4);
});
test('dashboard reconcilia quantidades, taxa e defeitos declarados',()=>{
  const r=Madeira.resumo(registros);assert.deepEqual([r.inspecoes,r.concluidas,r.entregues,r.reprovadas,r.comQuantidades],[358,343,98512,11088,346]);
  assert.ok(Math.abs(r.taxa-11.2554815657)<1e-8);
  assert.deepEqual(Object.fromEntries(Madeira.totaisDefeitos(registros)),{'Podre':27,'Esmoado':251,'Casca':217,'Empeno':249,'Resina':149,'Rachadura e Fendilhamento':10200});
  registros.filter(x=>x.qtd_entregue&&x.qtd_reprovada!==null&&x.taxa_reprovacao!==null).forEach(x=>assert.ok(Math.abs(x.taxa_reprovacao-x.qtd_reprovada/x.qtd_entregue*100)<0.021,x.audit_id));
});
test('filtros mantêm limites inclusivos e distinguem campos ausentes',()=>{
  assert.equal(Madeira.filtrar(registros,{versao:'recebimento_v1'}).length,58);
  assert.equal(Madeira.filtrar(registros,{status:'rascunho'}).length,15);
  const dia=Madeira.filtrar(registros,{ini:'2026-09-08',fim:'2026-09-08'});assert.ok(dia.length>0&&dia.every(r=>r.data_inspecao==='2026-09-08'));
  assert.equal(Madeira.filtrar(registros,{tipo:'eucalipto'}).length,144);
  assert.equal(Madeira.filtrar(registros,{tipo:''}).length,358);
});
test('histórico mostra primeiro as inspeções mais recentes',()=>{
  const lista=Madeira.ordenarMaisRecentes([{id:1,data_inspecao:'2025-08-19'},{id:2,data_inspecao:'2026-09-08'},{id:3,data_inspecao:null}]);
  assert.deepEqual(lista.map(x=>x.id),[2,1,3]);
});
test('store pagina resultados e propaga erro de leitura',async()=>{
  let chamadas=0;const db={from(){return{select(){return this},order(){return this},async range(a,b){chamadas++;return{data:Array.from({length:a?2:500},(_,i)=>({id:a+i})),error:null}}}}};
  const ctx=vm.createContext({window:{Auth:{cliente:()=>db}}});vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/store-madeira-supabase.js'),'utf8'),ctx);
  assert.equal((await ctx.window.StoreMadeira.listar()).length,502);assert.equal(chamadas,2);
  db.from=()=>({select(){return this},order(){return this},async range(){return{error:new Error('offline')}}});await assert.rejects(ctx.window.StoreMadeira.listar(),/offline/);
});
