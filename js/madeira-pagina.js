'use strict';
let MADEIRA_REGISTROS=[],MADEIRA_CARREGANDO=false,MADEIRA_ERRO=false;
const mEl=id=>document.getElementById(id),mEsc=v=>U.esc(String(v??'')),mTexto=v=>mEsc(v||'—').replace(/\n/g,'<br>');
const mDashboard=()=>document.body.dataset.pagina==='madeira';
document.addEventListener('DOMContentLoaded',async()=>{
  if(!await Auth.exigirLogin())return;
  App.montarLayout(mDashboard()?'madeira-visao':'madeira-inspecoes',mDashboard()?'Dashboard Dormentes de Madeira':'Histórico de Dormentes de Madeira','Inspeções de recebimento e qualidade dos dormentes');
  App.acoesTopo(`<a class="btn btn-secundario btn-sm" href="${mDashboard()?'madeira-inspecoes.html':'dormentes-madeira.html'}">${mDashboard()?'Histórico de inspeções':'Dashboard'}</a><button type="button" class="btn btn-secundario btn-sm" id="atualizarMadeira">Atualizar</button>`);
  mEl('atualizarMadeira').addEventListener('click',carregarMadeira);
  mEl('filtrosMadeira').addEventListener('input',renderMadeira);
  mEl('limparMadeira').addEventListener('click',()=>{mEl('filtrosMadeira').reset();renderMadeira()});
  mEl('listaMadeira').addEventListener('click',e=>{const b=e.target.closest('[data-ver]');if(b)verMadeira(b.dataset.ver)});
  document.querySelectorAll('[data-fechar-madeira]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
  await carregarMadeira();
});
async function carregarMadeira(){
  if(MADEIRA_CARREGANDO)return;MADEIRA_CARREGANDO=true;MADEIRA_ERRO=false;mEl('estadoMadeira').textContent='Carregando inspeções…';mEl('kpisMadeira').innerHTML='';mEl('analiseMadeira').innerHTML='';mEl('listaMadeira').innerHTML='';
  mEl('filtrosMadeira').querySelectorAll('input,select,button').forEach(x=>x.disabled=true);mEl('atualizarMadeira').disabled=true;
  try{MADEIRA_REGISTROS=await StoreMadeira.listar();preencherFiltrosMadeira();MADEIRA_CARREGANDO=false;mEl('estadoMadeira').textContent='';renderMadeira();const id=new URLSearchParams(location.search).get('id');if(id&&MADEIRA_REGISTROS.some(i=>i.id===id)){history.replaceState(null,'',location.pathname);await verMadeira(id)}}
  catch(err){MADEIRA_ERRO=true;MADEIRA_REGISTROS=[];mEl('estadoMadeira').textContent=StoreMadeira.erro(err)+' Use Atualizar para tentar novamente.'}
  finally{MADEIRA_CARREGANDO=false;mEl('filtrosMadeira').querySelectorAll('input,select,button').forEach(x=>x.disabled=false);mEl('atualizarMadeira').disabled=false}
}
function preencherFiltrosMadeira(){
  for(const [id,campo] of [['fFornecedor','fornecedor'],['fResponsavel','responsavel'],['fProjeto','projeto'],['fTipo','tipo_dormente']]){
    const atual=mEl(id).value,mapa=new Map();MADEIRA_REGISTROS.forEach(i=>{if(Madeira.nome(i[campo]))mapa.set(Madeira.chave(i[campo]),Madeira.nome(i[campo]))});
    mEl(id).innerHTML='<option value="">Todos</option>'+[...mapa].sort((a,b)=>a[1].localeCompare(b[1],'pt-BR')).map(([k,v])=>`<option value="${mEsc(k)}">${mEsc(v)}</option>`).join('');if(mapa.has(atual))mEl(id).value=atual;
  }
}
function filtrosMadeira(){return{busca:mEl('busca').value,fornecedor:mEl('fFornecedor').value,responsavel:mEl('fResponsavel').value,projeto:mEl('fProjeto').value,tipo:mEl('fTipo').value,versao:mEl('fVersao').value,status:mEl('fStatus').value,ini:mEl('fDataIni').value,fim:mEl('fDataFim').value}}
function renderMadeira(){
  if(MADEIRA_CARREGANDO||MADEIRA_ERRO)return;const f=filtrosMadeira();if(f.ini&&f.fim&&f.ini>f.fim){mEl('estadoMadeira').textContent='A data inicial deve ser anterior ou igual à data final.';mEl('kpisMadeira').innerHTML='';mEl('analiseMadeira').innerHTML='';mEl('listaMadeira').innerHTML='';return}mEl('estadoMadeira').textContent='';
  const lista=Madeira.ordenarMaisRecentes(Madeira.filtrar(MADEIRA_REGISTROS,f)),r=Madeira.resumo(lista),taxa=r.taxa===null?'—':r.taxa.toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
  mEl('kpisMadeira').innerHTML=[['Inspeções',r.inspecoes,`${r.concluidas} concluídas · ${r.inspecoes-r.concluidas} rascunhos`,'escuro'],['Quantidade declarada',mNum(r.entregues),`${r.comQuantidades} relatórios com quantidades`,''],['Dormentes reprovados',mNum(r.reprovadas),'Soma declarada nos relatórios','amarelo'],['Taxa consolidada',taxa,'Reprovados ÷ quantidade declarada','']].map(([l,v,e,c])=>`<div class="kpi ${c}"><div class="rotulo">${l}</div><div class="valor">${v}</div><div class="extra">${e}</div></div>`).join('');
  mEl('contadorMadeira').textContent=`${lista.length} de ${MADEIRA_REGISTROS.length} inspeções${mDashboard()&&lista.length>15?' · mostrando as 15 mais recentes':''}`;
  mEl('listaMadeira').innerHTML=lista.length?tabelaMadeira(mDashboard()?lista.slice(0,15):lista):'<div class="vazio"><h3>Nenhuma inspeção encontrada</h3><p>Ajuste os filtros para consultar o histórico.</p></div>';
  mEl('analiseMadeira').innerHTML=mDashboard()&&lista.length?analiseMadeira(lista):'';
}
const mNum=v=>Number(v||0).toLocaleString('pt-BR',{maximumFractionDigits:2});
function tabelaMadeira(lista){return `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Data</th><th>Fornecedor</th><th>Projeto</th><th>Tipo</th><th>Pedido / NF</th><th>Qtd.</th><th>Reprov.</th><th>Taxa</th><th>Versão</th><th>Ação</th></tr></thead><tbody>${lista.map(i=>`<tr><td>${U.dataBR(i.data_inspecao)}</td><td><strong>${mTexto(i.fornecedor)}</strong></td><td>${mTexto(i.projeto)}</td><td>${mTexto(i.tipo_dormente)}</td><td>${mTexto(i.numero_pedido)}<br><small>${mTexto(i.nota_fiscal)}</small></td><td>${i.qtd_entregue===null?'—':mNum(i.qtd_entregue)}</td><td>${i.qtd_reprovada===null?'—':mNum(i.qtd_reprovada)}</td><td>${i.taxa_reprovacao===null?'—':mNum(i.taxa_reprovacao)+'%'}</td><td>${mEsc(Madeira.VERSOES[i.tipo_relatorio]||i.tipo_relatorio)}</td><td><button class="btn btn-secundario btn-sm" data-ver="${mEsc(i.id)}">Ver</button></td></tr>`).join('')}</tbody></table></div>`}
function barrasMadeira(valores,classe=''){const max=Math.max(...valores.map(x=>x[1]),0);return valores.map(([l,n])=>`<div class="madeira-barra"><div><span>${mEsc(l)}</span><strong>${mNum(n)}</strong></div><div class="madeira-trilho"><span class="${classe}" style="width:${max?n/max*100:0}%"></span></div></div>`).join('')}
function agrupar(lista,chaveCampo,valorCampo=()=>1){const map=new Map();for(const i of lista){const nome=Madeira.nome(chaveCampo(i))||'Não informado',k=Madeira.chave(nome);if(!map.has(k))map.set(k,{nome,total:0});map.get(k).total+=valorCampo(i)}return[...map.values()].sort((a,b)=>b.total-a.total).map(x=>[x.nome,x.total])}
function analiseMadeira(lista){
  const fornecedores=agrupar(lista,i=>i.fornecedor),tipos=agrupar(lista,i=>i.tipo_dormente,i=>Number(i.qtd_entregue||0)),mapMes=new Map();
  lista.forEach(i=>{const mes=i.data_inspecao?.slice(0,7)||'Sem data';mapMes.set(mes,(mapMes.get(mes)||0)+Number(i.qtd_entregue||0))});
  const meses=[...mapMes].sort((a,b)=>a[0].localeCompare(b[0])).map(([m,n])=>[m==='Sem data'?m:`${m.slice(5)}/${m.slice(0,4)}`,n]),defeitos=Madeira.totaisDefeitos(lista).sort((a,b)=>b[1]-a[1]);
  return `<div class="grid-graficos"><section class="card"><h2 class="card-titulo">Inspeções por fornecedor</h2>${barrasMadeira(fornecedores)}</section><section class="card"><h2 class="card-titulo">Quantidade por mês</h2>${barrasMadeira(meses)}</section></div><div class="grid-graficos"><section class="card"><h2 class="card-titulo">Quantidade por tipo informado</h2>${barrasMadeira(tipos)}</section><section class="card"><h2 class="card-titulo">Defeitos declarados</h2><p class="txt-mini">Um dormente pode ter mais de um defeito; estas contagens não devem ser somadas como peças únicas.</p>${barrasMadeira(defeitos,'reprovado')}</section></div>`;
}
async function verMadeira(id){
  mEl('detalheCorpo').textContent='Carregando relatório…';if(!mEl('detalheMadeira').open)mEl('detalheMadeira').showModal();
  try{const i=await StoreMadeira.detalhe(id);mEl('detalheCorpo').innerHTML=`<h3>${mTexto(i.fornecedor)} · ${U.dataBR(i.data_inspecao)}</h3><p>${mEsc(Madeira.VERSOES[i.tipo_relatorio]||i.tipo_relatorio)} · ${i.status==='concluida'?'Concluída':'Rascunho'}</p><div class="madeira-resumo"><div><small>Quantidade declarada</small><strong>${i.qtd_entregue===null?'—':mNum(i.qtd_entregue)}</strong></div><div><small>Reprovada</small><strong>${i.qtd_reprovada===null?'—':mNum(i.qtd_reprovada)}</strong></div><div><small>Taxa informada</small><strong>${i.taxa_reprovacao===null?'—':mNum(i.taxa_reprovacao)+'%'}</strong></div></div><dl class="madeira-detalhes">${[['Responsável',i.responsavel],['Projeto',i.projeto],['Tipo de dormente',i.tipo_dormente],['Localização',i.localizacao],['Nota fiscal',i.nota_fiscal],['Número do pedido',i.numero_pedido],['Data da entrega',i.data_entrega?U.dataBR(i.data_entrega):null],['Umidade medida',i.teor_umidade_medido],['Umidade aprovada',i.teor_umidade_aprovado],['Marcação do lado',i.marcacao_lado],['Carimbo fiscalizadora',i.carimbo_fiscalizadora]].map(([k,v])=>`<div><dt>${mEsc(k)}</dt><dd>${mTexto(v)}</dd></div>`).join('')}</dl><h3>Defeitos encontrados</h3><div class="madeira-defeitos">${Madeira.DEFEITOS.map(n=>`<div class="madeira-defeito"><strong>${mEsc(n)}</strong><p>Quantidade: ${i.defeitos?.[n]?.quantidade??'—'}</p>${i.defeitos?.[n]?.notas?`<p>${mTexto(i.defeitos[n].notas)}</p>`:''}</div>`).join('')}</div>${i.informacoes_adicionais?`<h3>Informações adicionais</h3><p>${mTexto(i.informacoes_adicionais)}</p>`:''}<details><summary>Relatório original e rastreabilidade</summary><p>${mEsc(i.fonte_arquivo)} · ${mEsc(i.fonte_aba)} · linha ${i.fonte_linha}<br>${mEsc(i.audit_id)}</p><dl class="madeira-original">${Object.entries(i.dados_originais||{}).map(([k,v])=>`<dt>${mEsc(k)}</dt><dd>${mTexto(v)}</dd>`).join('')}</dl></details>`}
  catch(err){mEl('detalheCorpo').textContent=StoreMadeira.erro(err)}
}
