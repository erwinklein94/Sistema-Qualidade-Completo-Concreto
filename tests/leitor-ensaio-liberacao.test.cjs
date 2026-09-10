const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const Parser=require('../js/iauditor-parser.js');

// Fixture: itens de texto que o pdf.js devolve para o PDF real do formulário 32905
// (MATERIAIS | DORMENTE CONCRETO - ENSAIO FERRONORTE, lote 3301 da Cavan).
const item=([x,top,w,str])=>({x,top,w,str});
const paginas=()=>JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/ensaio-ferronorte-32905.json'),'utf8'))
  .map(p=>({pageNum:p.pageNum,width:p.width,height:p.height,items:p.items.map(item)}));
const lido=Parser.parse(paginas());
const porEnsaio=Object.fromEntries(lido.sections.flatMap(s=>s.rows.map(r=>[r.ensaio,r])));

test('lê o cabeçalho e os campos de identificação do formulário',()=>{
  assert.equal(lido.meta['Tipo de relatório'],'MATERIAIS | DORMENTE CONCRETO - ENSAIO FERRONORTE');
  assert.equal(lido.meta['Formulário'],'32905');
  assert.deepEqual([lido.meta['Destino'],lido.meta['Fiscal responsável'],lido.meta['Fornecedor'],lido.meta['Tipo de dormente']],
    ['FERRONORTE','ERWIN KLEIN','Cavan - Santa Lucia','Bitola Larga - E-clip']);
  assert.deepEqual([lido.meta['Lote'],lido.meta['Molde'],lido.meta['Cavidade'],lido.meta['Pista']],['3301','8','2','2']);
  assert.deepEqual([lido.meta['Data do ensaio'],lido.meta['Data de produção']],['08/09/2026','25/08/2026']);
  assert.equal(lido.meta['Série de lotes'],'3295, 3296, 3297, 3298, 3299, 3300 e 3301.');
  assert.equal(lido.meta['Cura térmica'],'Sim');
});

test('separa os 24 ensaios em cargas e dimensionais e não lê as páginas de fotos',()=>{
  assert.deepEqual(lido.sections.map(s=>[s.title,s.rows.length]),[['Ensaios de cargas',13],['Ensaios dimensionais',11]]);
  assert.equal(Object.keys(porEnsaio).length,24);
  assert.ok(!Object.keys(porEnsaio).some(nome=>/foto/i.test(nome)));
});

test('tira o critério de dentro da própria pergunta',()=>{
  const conferir=(nome,valor,criterio)=>assert.deepEqual([porEnsaio[nome].valor,porEnsaio[nome].criterio],[valor,criterio],nome);
  conferir('Momento positivo no apoio dos trilhos','234,8 kN','Carga 234,8 kN');
  conferir('Momento positivo no centro do dormente','46,9 kN','Carga 46,84 kN');
  conferir('Ancoragem (carga 50% acima do mom. positivo)','352,2 kN','Carga 352,13 kN');
  conferir('Aderência — escorregamento do aço','0,0 mm','Máx. 0,025 mm');
  conferir('Comprimento do dormente','2800,0 mm','Entre 2794 e 2806 mm');       // 2.800mm (Tolerância +- 6mm)
  conferir('Altura entre ombreiras','250,0 mm','Entre 247 e 256 mm');           // 250mm (Tolerância +6mm/-3mm)
  conferir('Dist. interna entre ombreiras (mesmo apoio)','155,0 mm','Entre 154 e 156 mm'); // (154,50mm +1,5mm -0,5mm)
  conferir('Altura da ombreira','Aprovado','Passa / Não passa');
  conferir('↳ Apresentou fissuras? (apoio, positivo)','Não','Esperado: Não');
});

test('a faixa aceita muda com o fornecedor escrito no formulário',()=>{
  const cavan=[porEnsaio['Inclinação da base de apoio dos trilhos'],porEnsaio['Empeno transversal (torção) entre apoios']];
  assert.deepEqual(cavan.map(r=>[r.valor,r.criterio,r.situacao]),
    [['5,26','Entre 4,54 e 5,55 (Cavan)','ok'],['0,76 mm','Máx. 1 mm (Cavan)','ok']]);

  // mesmo ensaio lido como Conprem: 5,26 e 0,76 saem das faixas da outra fábrica
  const outro=paginas();
  outro[0].items.find(i=>i.str==='Cavan - Santa Lucia').str='Conprem - Pedro Leopoldo';
  const comConprem=Parser.parse(outro);
  const acha=nome=>comConprem.sections.flatMap(s=>s.rows).find(r=>r.ensaio===nome);
  assert.deepEqual([acha('Inclinação da base de apoio dos trilhos'),acha('Empeno transversal (torção) entre apoios')]
    .map(r=>[r.criterio,r.situacao]),[['Entre 0,3 e 1,8 (Conprem)','fail'],['Entre 4 e 6 mm (Conprem)','fail']]);
});

test('o lote sai aprovado e nenhuma leitura fica fora do limite',()=>{
  assert.deepEqual([lido.conclusao.ensaio,lido.conclusao.valor,lido.conclusao.situacao],['Lote aprovado?','Sim','ok']);
  assert.deepEqual(Object.values(porEnsaio).filter(r=>r.situacao==='fail'),[]);
  assert.equal(Object.values(porEnsaio).filter(r=>r.situacao==='ok').length,24);
});

test('a inspeção de pista continua no leitor dela, mesmo sendo o mesmo formulário',()=>{
  const it=(x,top,str)=>({x,top,w:str.length*5,str});
  const pista=Parser.parse([{pageNum:1,width:595,height:842,items:[
    it(184.14,32,'MATERIAIS | DORMENTE CONCRETO -'),it(184.14,58.4,'INSPEÇÃO DE PISTA'),it(184.14,80.8,'Formulário 31156'),
    it(20,137,'Preparado por'),it(35,164.4,'ERWIN KLEIN'),
    it(20,203.6,'Fornecedor'),it(35,231,'Cavan - Santa Lucia'),
    it(20,270.2,'Lote'),it(35,297.6,'3304'),
    it(20,336.8,'Quantidade Produzida'),it(35,364.2,'275'),
    it(15,823.5,'Documento criado em: 28/08/2026 13:56:02'),it(515,823.5,'Página 1 de 6')]}]);
  assert.equal(pista.meta['Tipo de relatório'],'Inspeção de pista');
  assert.equal(pista.meta['Formulário'],undefined);
  assert.deepEqual([pista.meta['Responsável'],pista.meta['Lote'],pista.meta['Quantidade produzida']],['ERWIN KLEIN','3304','275']);
});


// js/ensaios-liberacao.js é script de página, não módulo: roda num contexto com document,
// window e um U de mentira (só o que o mapeamento encosta) e devolve as duas funções.
const vm=require('node:vm');
const contexto=vm.createContext({
  console,
  document:{addEventListener(){}},
  window:{},
  U:{
    semanaOperacionalInfo:()=>({semana:37,ano:2026,ini:'2026-09-03',fim:'2026-09-09'}),
    norm:v=>String(v==null?'':v).trim().toUpperCase(),
    bitolaDe:reg=>reg.bitola||'',
  },
});
vm.runInContext(
  fs.readFileSync(path.join(__dirname,'../js/ensaios-liberacao.js'),'utf8')
    +'\nwindow.__tela={leiturasEmColunas,mapEnsaioParaBanco};',
  contexto);
const tela=contexto.window.__tela;

test('cada leitura do formulário cai na coluna certa de ensaios_liberacao',()=>{
  const colunas=tela.leiturasEmColunas(lido.meta,lido.sections.flatMap(s=>s.rows));
  assert.deepEqual(colunas,{
    formulario_numero:'32905', destino:'FERRONORTE', tipo_dormente:'Bitola Larga - E-clip',
    molde:'8', cavidade:'2', pista:'2', data_producao:'2026-08-25', cura_termica:'Sim',
    momento_pos_apoio:234.8, momento_pos_apoio_fissura:'Não',
    momento_neg_apoio:175, momento_neg_apoio_fissura:'Não',
    momento_pos_centro:46.9, momento_pos_centro_fissura:'Não',
    momento_neg_centro:67, momento_neg_centro_fissura:'Não',
    ancoragem_carga:352.2, ancoragem_fissura:'Não',
    aderencia_escorregamento:0, arrancamento_ombreira_a:53.4, arrancamento_ombreira_b:53.4,
    inclinacao_base:5.26, empeno_transversal:0.76,
    torcao_ombreira_a:'Aprovado', torcao_ombreira_b:'Aprovado',
    comprimento:2800, base_testeira:300, altura_entre_ombreiras:250, altura_centro:220,
    dist_interna_ombreiras_apoio:155, dist_interna_ombreiras_externas:'Aprovado', altura_ombreira:'Aprovado',
  });
  // o que o formulário não perguntou não vira coluna nula
  assert.ok(!('arrancamento_ombreira_c' in colunas) && !('altura_plataforma' in colunas));
});

test('editar um ensaio já gravado não manda as colunas do ensaio, para não apagá-las',()=>{
  const base={id:'abc',dataEnsaio:'2026-09-08',fornecedor:'Cavan SP',projeto:'FERRO NORTE',
    bitola:'Bitola Larga',lote:'3301',resultado:'Aprovado',serieLiberada:'Série 01 - FN'};
  const semLeitura=tela.mapEnsaioParaBanco(base);
  assert.deepEqual(Object.keys(semLeitura).filter(k=>/^(momento_|inclinacao_base|cura_termica|comprimento)/.test(k)),[]);
  const comLeitura=tela.mapEnsaioParaBanco({...base,leituras:{inclinacao_base:5.26,cura_termica:'Sim'}});
  assert.deepEqual([comLeitura.inclinacao_base,comLeitura.cura_termica],[5.26,'Sim']);
});
