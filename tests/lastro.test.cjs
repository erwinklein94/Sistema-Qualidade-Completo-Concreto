const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Lastro = require('../js/lastro-comum.js');
const carga = fs.readFileSync(require('node:path').join(__dirname,'../supabase/2026-09-09-area-lastro-carga-historico.sql'),'utf8');
const registros = [...carga.matchAll(/NULL::public\.lastro_inspecoes, '((?:[^']|'')*)'::jsonb/g)].map(m=>JSON.parse(m[1].replace(/''/g,"'")));
test('carga preserva 71 relatórios, 45 campos originais, notas, pontuações e respostas',()=>{
  assert.equal(registros.length,71); assert.equal(new Set(registros.map(i=>i.audit_id)).size,71);
  const r=Lastro.resumo(registros);
  assert.deepEqual([r.sim,r.nao,r.nd,r.vazios,r.concluidas],[626,121,163,13,70]);
  assert.equal(r.taxa,626/747*100);
  for(const i of registros){
    assert.equal(Object.keys(i.dados_originais).length,45);
    const original=Object.values(i.dados_originais);
    Lastro.CRITERIOS.forEach(([id],n)=>{
      assert.equal(i.respostas[id].resposta,original[14+n*2]);
      assert.equal(i.respostas[id].notas,original[15+n*2]);
    });
    assert.equal(Lastro.resumo([i]).sim,i.dados_originais.score);
  }
});
test('N/D, vazios e zero não viram aprovação ou denominador fictício',()=>{
  const respostas=Object.fromEntries(Lastro.CRITERIOS.map(([id])=>[id,{resposta:'N/D'}]));
  assert.equal(Lastro.resumo([{respostas}]).taxa,null);
  respostas.c01.resposta='Não'; assert.equal(Lastro.resumo([{respostas}]).taxa,0);
  assert.equal(Lastro.resumo([]).taxa,null);
});
test('filtros respeitam datas inclusivas, origem, situação e unidades distintas',()=>{
  const r=Lastro.filtrar(registros,{ini:'2026-04-06',fim:'2026-04-06',fornecedor:'petra'});
  assert.ok(r.length>0); assert.ok(r.every(i=>i.data_inspecao==='2026-04-06'));
  assert.equal(Lastro.filtrar(registros,{origem:'manual'}).length,0);
  assert.equal(Lastro.filtrar(registros,{status:'rascunho'}).length,1);
  assert.equal(Lastro.filtrar(registros,{fornecedor:'minermix'}).length,12);
  assert.equal(Lastro.filtrar(registros,{fornecedor:'minermix capivari'}).length,6);
});
test('conclusão exige respostas; rascunho mantém ausências e campos obrigatórios',()=>{
  const r={data_inspecao:'2026-09-09',fornecedor:'Pedreira',responsavel:'Fiscal',status:'rascunho',respostas:Object.fromEntries(Lastro.CRITERIOS.map(([id])=>[id,{resposta:null}]))};
  assert.equal(Lastro.validar(r),r);
  assert.throws(()=>Lastro.validar({...r,status:'concluida'}),/13 critérios/);
  assert.throws(()=>Lastro.validar({...r,fornecedor:' '}),/fornecedor/);
  for(const c of Object.values(r.respostas)) c.resposta='N/D';
  assert.doesNotThrow(()=>Lastro.validar({...r,status:'concluida'}));
});
test('store pagina além do limite do servidor e propaga falha de leitura',async()=>{
  let chamadas=0;
  const db={from(){return {select(){return this},order(){return this},async range(a,b){chamadas++; assert.equal(b-a,499);return {data:Array.from({length:a===0?500:2},(_,i)=>({id:a+i})),error:null}}}}};
  const ctx=vm.createContext({window:{Auth:{cliente:()=>db}},Lastro});
  vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../js/store-lastro-supabase.js'),'utf8'),ctx);
  const resultado=await ctx.window.StoreLastro.listar(); assert.equal(resultado.length,502); assert.equal(chamadas,2);
  db.from=()=>({select(){return this},order(){return this},async range(){return {error:new Error('offline')}}});
  await assert.rejects(ctx.window.StoreLastro.listar(),/offline/);
});
