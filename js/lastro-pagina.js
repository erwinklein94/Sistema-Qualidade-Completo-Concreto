'use strict';
let LASTRO_REGISTROS = [], LASTRO_EDITANDO = null, LASTRO_OCUPADO = false, LASTRO_CARREGANDO = false, LASTRO_ERRO = false;
const lEl = id => document.getElementById(id);
const lEsc = valor => U.esc(String(valor ?? ''));
const lTexto = valor => lEsc(valor || '—').replace(/\n/g, '<br>');
const lDashboard = () => document.body.dataset.pagina === 'lastro';

document.addEventListener('DOMContentLoaded', async () => {
  if (!await Auth.exigirLogin()) return;
  App.montarLayout(lDashboard() ? 'lastro-visao' : 'lastro-inspecoes', lDashboard() ? 'Dashboard Lastro' : 'Inspeções de Pedreira', 'Qualidade do lastro • Inspeções de pedreiras');
  App.acoesTopo(`<a class="btn btn-secundario btn-sm" href="${lDashboard() ? 'lastro-inspecoes.html' : 'lastro.html'}">${lDashboard() ? 'Histórico de inspeções' : 'Dashboard'}</a>
    ${Auth.pode('criar') ? '<button type="button" class="btn btn-primario btn-sm" id="novaInspecao">Nova inspeção</button>' : App.avisoModoConsulta()}
    <button type="button" class="btn btn-secundario btn-sm" id="atualizarLastro">Atualizar</button>`);
  lEl('novaInspecao')?.addEventListener('click', () => abrirLastro());
  lEl('atualizarLastro').addEventListener('click', carregarLastro);
  lEl('filtrosLastro').addEventListener('input', renderLastro);
  lEl('limparLastro').addEventListener('click', () => { lEl('filtrosLastro').reset(); renderLastro(); });
  lEl('formLastro').addEventListener('submit', salvarLastro);
  document.querySelectorAll('[data-fechar-lastro]').forEach(b => b.addEventListener('click', () => { if (!LASTRO_OCUPADO) b.closest('dialog').close(); }));
  lEl('editorLastro').addEventListener('cancel', e => { if (LASTRO_OCUPADO) e.preventDefault(); });
  lEl('listaLastro').addEventListener('click', e => {
    const b = e.target.closest('[data-ver], [data-editar]');
    if (b?.dataset.ver) verLastro(b.dataset.ver);
    if (b?.dataset.editar) abrirLastro(LASTRO_REGISTROS.find(i => i.id === b.dataset.editar));
  });
  await carregarLastro();
});

async function carregarLastro() {
  if (LASTRO_CARREGANDO) return;
  LASTRO_CARREGANDO = true; LASTRO_ERRO = false;
  lEl('estadoLastro').textContent = 'Carregando inspeções…';
  lEl('kpis').innerHTML = ''; lEl('listaLastro').innerHTML = ''; lEl('analiseLastro').innerHTML = '';
  lEl('filtrosLastro').querySelectorAll('input,select,button').forEach(el => el.disabled = true);
  lEl('atualizarLastro').disabled = true;
  try {
    LASTRO_REGISTROS = await StoreLastro.listar();
    for (const [id, campo] of [['fFornecedor','fornecedor'], ['fResponsavel','responsavel']]) {
      const anterior = lEl(id).value;
      const nomes = new Map();
      LASTRO_REGISTROS.forEach(i => { if (Lastro.nome(i[campo])) nomes.set(Lastro.chave(i[campo]),Lastro.nome(i[campo])); });
      lEl(id).innerHTML = '<option value="">Todos</option>' + [...nomes].sort((a,b) => a[1].localeCompare(b[1],'pt-BR')).map(([k,v]) => `<option value="${lEsc(k)}">${lEsc(v)}</option>`).join('');
      if (nomes.has(anterior)) lEl(id).value = anterior;
    }
    lEl('fornecedoresLastro').innerHTML = [...new Set(LASTRO_REGISTROS.map(i => Lastro.nome(i.fornecedor)).filter(Boolean))].map(v => `<option value="${lEsc(v)}"></option>`).join('');
    lEl('estadoLastro').textContent = '';
    LASTRO_CARREGANDO = false;
    renderLastro();
    const id = new URLSearchParams(location.search).get('id');
    if (id && LASTRO_REGISTROS.some(i => i.id === id)) { history.replaceState(null,'',location.pathname); await verLastro(id); }
  } catch (err) {
    LASTRO_ERRO = true;
    LASTRO_REGISTROS = [];
    lEl('estadoLastro').textContent = StoreLastro.erro(err) + ' Use Atualizar para tentar novamente.';
  } finally {
    LASTRO_CARREGANDO = false;
    lEl('filtrosLastro').querySelectorAll('input,select,button').forEach(el => el.disabled = false);
    lEl('atualizarLastro').disabled = false;
  }
}

function renderLastro() {
  if (LASTRO_CARREGANDO || LASTRO_ERRO) return;
  const f = { fornecedor:lEl('fFornecedor').value, responsavel:lEl('fResponsavel').value, origem:lEl('fOrigem').value,
    status:lEl('fStatus').value, ini:lEl('fDataIni').value, fim:lEl('fDataFim').value, busca:lEl('busca').value, negativas:lEl('fNegativas').checked };
  if (f.ini && f.fim && f.ini > f.fim) { lEl('estadoLastro').textContent = 'A data inicial deve ser anterior ou igual à data final.'; lEl('kpis').innerHTML=''; lEl('listaLastro').innerHTML=''; lEl('analiseLastro').innerHTML=''; return; }
  lEl('estadoLastro').textContent = '';
  const lista = Lastro.filtrar(LASTRO_REGISTROS, f), r = Lastro.resumo(lista);
  const taxa = r.taxa === null ? '—' : r.taxa.toLocaleString('pt-BR',{maximumFractionDigits:1}) + '%';
  lEl('kpis').innerHTML = [
    ['Inspeções',lista.length,`${r.concluidas} concluídas · ${lista.length-r.concluidas} rascunhos`,'escuro'],
    ['Respostas positivas',taxa,`${r.sim} Sim de ${r.sim+r.nao} respostas Sim/Não`,''],
    ['Com respostas negativas',r.comNegativas,`${r.nao} respostas Não nos critérios`,'amarelo'],
    ['N/D e não respondidos',r.nd+r.vazios,`${r.nd} N/D · ${r.vazios} não respondidos`,''],
  ].map(([label,value,extra,cls]) => `<div class="kpi ${cls}"><div class="rotulo">${label}</div><div class="valor">${value}</div><div class="extra">${extra}</div></div>`).join('');
  lEl('contadorLastro').textContent = `${lista.length} de ${LASTRO_REGISTROS.length} inspeções${lDashboard() && lista.length > 15 ? ' · mostrando as 15 mais recentes' : ''}`;
  lEl('listaLastro').innerHTML = !lista.length ? '<div class="vazio"><h3>Nenhuma inspeção encontrada</h3><p>Ajuste os filtros ou cadastre uma nova inspeção.</p></div>' : tabelaLastro(lDashboard() ? lista.slice(0,15) : lista);
  lEl('analiseLastro').innerHTML = lDashboard() && lista.length ? analiseLastro(lista) : '';
}

function tabelaLastro(lista) {
  return `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Data</th><th>Pedreira / fornecedor</th><th>Responsável</th><th>Situação</th><th>Sim / Não / N/D / vazios</th><th>Origem</th><th>Ações</th></tr></thead><tbody>${lista.map(i => {
    const r = Lastro.resumo([i]);
    return `<tr><td>${U.dataBR(i.data_inspecao)}</td><td><strong>${lTexto(Lastro.nome(i.fornecedor))}</strong></td><td>${lTexto(i.responsavel)}</td><td>${i.status==='concluida'?'Concluída':'Rascunho'}</td>
      <td>${r.sim} / <span class="${r.nao?'lastro-negativa':''}">${r.nao}</span> / ${r.nd} / ${r.vazios}</td><td>${i.origem_dados==='historico'?'Histórico Excel':'Manual'}</td>
      <td><button class="btn btn-secundario btn-sm" data-ver="${lEsc(i.id)}">Ver</button> ${i.origem_dados==='manual' && Auth.pode('editar') ? `<button class="btn btn-secundario btn-sm" data-editar="${lEsc(i.id)}">Editar</button>`:''}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function analiseLastro(lista) {
  const fornecedores = new Map(), meses = new Map();
  lista.forEach(i => {
    const k = Lastro.chave(i.fornecedor) || 'Não informado';
    if (!fornecedores.has(k)) fornecedores.set(k,{nome:Lastro.nome(i.fornecedor)||'Não informado',total:0});
    fornecedores.get(k).total++;
    const mes = i.data_inspecao?.slice(0,7) || 'Sem data'; meses.set(mes,(meses.get(mes)||0)+1);
  });
  function barras(valores,max,negativa=false) {
    return valores.map(([nome,n]) => `<div class="lastro-barra"><div>${lEsc(nome)} <strong>${n}</strong></div><div class="lastro-trilho"><span class="${negativa?'negativa':''}" style="width:${max ? n/max*100:0}%"></span></div></div>`).join('');
  }
  const porFornecedor = [...fornecedores.values()].sort((a,b)=>b.total-a.total).map(i=>[i.nome,i.total]);
  const porMes = [...meses].sort((a,b)=>a[0].localeCompare(b[0])).map(([m,n])=>[m==='Sem data'?m:`${m.slice(5)}/${m.slice(0,4)}`,n]);
  const criterios = Lastro.CRITERIOS.map(([id,grupo,label]) => [label,lista.filter(i=>i.respostas?.[id]?.resposta==='Não').length,grupo]);
  return `<div class="grid-graficos"><section class="card"><h2 class="card-titulo">Inspeções por pedreira</h2>${barras(porFornecedor,Math.max(...porFornecedor.map(i=>i[1])))}</section>
    <section class="card"><h2 class="card-titulo">Inspeções por mês</h2>${barras(porMes,Math.max(...porMes.map(i=>i[1])))}</section></div>
    <section class="card"><h2 class="card-titulo">Respostas negativas por critério</h2><p class="txt-mini">Contagem de “Não” nos relatórios do filtro. Não representa uma lista de pendências atuais.</p>
    ${barras(criterios.sort((a,b)=>b[1]-a[1]),Math.max(...criterios.map(i=>i[1])),true)}</section>`;
}

function abrirLastro(registro = null) {
  if (!Auth.pode(registro ? 'editar':'criar') || (registro && registro.origem_dados !== 'manual')) return;
  LASTRO_EDITANDO = registro;
  lEl('formLastro').reset(); lEl('erroFormulario').textContent = '';
  lEl('tituloEditor').textContent = registro ? 'Editar inspeção de pedreira' : 'Nova inspeção de pedreira';
  for (const campo of ['fornecedor','data_inspecao','responsavel','localizacao','observacoes','status']) lEl('l_'+campo).value = registro?.[campo] || (campo==='status'?'rascunho':'');
  lEl('notasGeraisLastro').innerHTML = ['fornecedor','data_inspecao','responsavel','localizacao'].map((k,i) => `<div class="campo"><label for="nota_${k}">Observação: ${['fornecedor','data da inspeção','responsável','localização'][i]}</label><textarea id="nota_${k}">${lEsc(registro?.notas_gerais?.[k])}</textarea></div>`).join('');
  let grupo = '';
  lEl('checklistLastro').innerHTML = Lastro.CRITERIOS.map(([id,g,label]) => {
    const cab = grupo !== g ? `<h3 class="form-secao">${lEsc(g)}</h3>` : ''; grupo=g;
    return `${cab}<div class="lastro-criterio"><div class="campo"><label for="${id}">${lEsc(label)}</label><select id="${id}">${[['','Não respondido'],['Sim','Sim'],['Não','Não'],['N/D','N/D']].map(([v,t])=>`<option value="${v}" ${registro?.respostas?.[id]?.resposta===v?'selected':''}>${t}</option>`).join('')}</select></div><div class="campo"><label for="${id}_notas">Observações do item</label><textarea id="${id}_notas">${lEsc(registro?.respostas?.[id]?.notas)}</textarea></div></div>`;
  }).join('');
  lEl('editorLastro').showModal();
}

async function salvarLastro(e) {
  e.preventDefault(); if (LASTRO_OCUPADO) return;
  const registro = { id:LASTRO_EDITANDO?.id, atualizado_em:LASTRO_EDITANDO?.atualizado_em,
    ...Object.fromEntries(['fornecedor','data_inspecao','responsavel','localizacao','observacoes','status'].map(k=>[k,lEl('l_'+k).value.trim()])),
    notas_gerais:Object.fromEntries(['fornecedor','data_inspecao','responsavel','localizacao'].map(k=>[k,lEl('nota_'+k).value.trim()||null])),
    respostas:Object.fromEntries(Lastro.CRITERIOS.map(([id])=>[id,{resposta:lEl(id).value||null,notas:lEl(id+'_notas').value.trim()||null}])) };
  lEl('erroFormulario').textContent='';
  try {
    Lastro.validar(registro);
    LASTRO_OCUPADO=true; lEl('salvarLastro').disabled=true;
    await StoreLastro.salvar(registro);
    lEl('editorLastro').close(); App.toast('Inspeção salva.'); await carregarLastro();
  } catch(err) { lEl('erroFormulario').textContent=StoreLastro.erro(err); lEl('erroFormulario').scrollIntoView({block:'nearest'}); }
  finally { LASTRO_OCUPADO=false; lEl('salvarLastro').disabled=false; }
}

async function verLastro(id) {
  lEl('detalheCorpo').textContent='Carregando relatório…';
  if (!lEl('detalheLastro').open) lEl('detalheLastro').showModal();
  try {
    const i = await StoreLastro.detalhe(id);
    lEl('detalheCorpo').innerHTML = `<h3>${lTexto(i.fornecedor)} · ${U.dataBR(i.data_inspecao)}</h3><p><strong>Responsável:</strong> ${lTexto(i.responsavel)}<br><strong>Localização:</strong> ${lTexto(i.localizacao)}<br><strong>Situação:</strong> ${i.status==='concluida'?'Concluída':'Rascunho'} · ${i.origem_dados==='historico'?'Histórico Excel (somente consulta)':'Cadastro manual'}</p>
    ${Object.entries(i.notas_gerais||{}).filter(([,v])=>v).map(([k,v])=>`<p><strong>Observação (${lEsc(k)}):</strong> ${lTexto(v)}</p>`).join('')}
    ${Lastro.CRITERIOS.map(([id,g,label])=>`<div class="lastro-detalhe-item"><small>${lEsc(g)}</small><p><strong>${lEsc(label)}</strong></p><span class="badge ${i.respostas?.[id]?.resposta==='Não'?'badge-reprovado':'badge-neutro'}">${lEsc(i.respostas?.[id]?.resposta||'Não respondido')}</span>${i.respostas?.[id]?.notas?`<p>${lTexto(i.respostas[id].notas)}</p>`:''}</div>`).join('')}
    ${i.observacoes?`<h3>Observações gerais</h3><p>${lTexto(i.observacoes)}</p>`:''}
    ${i.origem_dados==='historico'?`<details><summary>Relatório original e rastreabilidade</summary><p>${lEsc(i.fonte_arquivo)} · linha ${i.fonte_linha}<br>${lEsc(i.audit_id)}</p><dl class="lastro-original">${Object.entries(i.dados_originais||{}).map(([k,v])=>`<dt>${lEsc(k)}</dt><dd>${lTexto(v)}</dd>`).join('')}</dl></details>`:''}`;
  } catch(err) { lEl('detalheCorpo').textContent=StoreLastro.erro(err); }
}
