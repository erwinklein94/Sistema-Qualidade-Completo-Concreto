/* =====================================================================
   AMV-DASHBOARD.JS — Painel da área de AMV

   Lê a árvore inteira (inspeção → peças → defeitos) numa consulta só e
   monta os indicadores em cima do que estiver no filtro.
   ===================================================================== */
'use strict';

let AMV_INSPECOES = [];
let AMV_CARREGANDO = false;
let AMV_ERRO = '';
let AMV_TABELA_FALTANDO = false;
const AMV_GRAFICOS = {};

document.addEventListener('DOMContentLoaded', async () => {
  if (!await Auth.exigirLogin()) return;

  App.montarLayout('amv-visao', 'Dashboard AMV', 'Inspeção de peças de aparelho de mudança de via');
  App.acoesTopo(`<button class="btn btn-secundario btn-sm" type="button" onclick="carregarAmv()">${ICN.check}<span>Atualizar</span></button>`);

  ['fFornecedor', 'fProjeto', 'fResponsavel', 'fDataIni', 'fDataFim'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', render);
  });
  window.addEventListener('temaAlterado', render);

  await carregarAmv();
});

async function carregarAmv() {
  AMV_CARREGANDO = true;
  AMV_ERRO = '';
  AMV_TABELA_FALTANDO = false;
  render();

  try {
    AMV_INSPECOES = await StoreAmv.listarInspecoes({ limite: 10000 });
    preencherFiltros();
  } catch (err) {
    console.error('Erro ao carregar inspeções de AMV:', err);
    AMV_TABELA_FALTANDO = StoreAmv.tabelaFaltando(err);
    AMV_ERRO = StoreAmv.mensagemErro(err, 'Não foi possível carregar as inspeções de AMV.');
  } finally {
    AMV_CARREGANDO = false;
    render();
  }
}

function preencherFiltros() {
  Amv.preencherSelect('fFornecedor', Amv.valoresDe(AMV_INSPECOES, i => Amv.fornecedor(i)), 'Todos os fornecedores');
  Amv.preencherSelect('fProjeto', Amv.valoresDe(AMV_INSPECOES, i => Amv.projetos(i)), 'Todos os projetos');
  Amv.preencherSelect('fResponsavel', Amv.valoresDe(AMV_INSPECOES, i => i.responsavel), 'Todos os responsáveis');
}

function filtradas() {
  const f = {
    fornecedor: document.getElementById('fFornecedor')?.value || '',
    projeto: document.getElementById('fProjeto')?.value || '',
    responsavel: document.getElementById('fResponsavel')?.value || '',
    ini: document.getElementById('fDataIni')?.value || '',
    fim: document.getElementById('fDataFim')?.value || '',
  };

  return AMV_INSPECOES.filter(i => {
    if (f.fornecedor && Amv.fornecedor(i) !== f.fornecedor) return false;
    if (f.projeto && !Amv.projetos(i).includes(f.projeto)) return false;
    if (f.responsavel && String(i.responsavel || '') !== f.responsavel) return false;
    const d = String(i.data_inspecao || '');
    if (f.ini && (!d || d < f.ini)) return false;
    if (f.fim && (!d || d > f.fim)) return false;
    return true;
  });
}

function render() {
  const lista = filtradas();
  renderKpis(lista);
  renderDefeitos(lista);
  renderUltimas(lista);
  renderGraficos(lista);
}

function estadoVazio(mensagem) {
  if (AMV_CARREGANDO) return `<div class="vazio">${ICN.vazioBox}<h3>Carregando área de AMV</h3><p>Buscando inspeções no Supabase...</p></div>`;
  if (AMV_TABELA_FALTANDO) {
    return `<div class="vazio">${ICN.alerta}<h3>Tabelas da área de AMV ainda não criadas</h3>
      <p>Rode no SQL Editor do Supabase, nesta ordem, <strong>supabase/2026-09-08-area-amv.sql</strong> e <strong>supabase/2026-09-08-area-amv-carga-historico.sql</strong>.</p>
      <button class="btn btn-secundario" type="button" onclick="carregarAmv()">Tentar novamente</button></div>`;
  }
  if (AMV_ERRO) {
    return `<div class="vazio">${ICN.alerta}<h3>Erro ao carregar</h3><p>${U.esc(AMV_ERRO)}</p>
      <button class="btn btn-secundario" type="button" onclick="carregarAmv()">Tentar novamente</button></div>`;
  }
  return `<div class="vazio">${ICN.vazioBox}<h3>${mensagem}</h3><p>Ajuste os filtros ou cadastre uma inspeção na tela de Inspeções de AMV.</p></div>`;
}

function renderKpis(lista) {
  const alvo = document.getElementById('kpis');
  if (!alvo) return;

  const pecas = lista.flatMap(i => Amv.pecas(i));
  const comDefeito = pecas.filter(p => p.tem_defeito === true).length;
  const programadas = Amv.soma(lista, 'qtd_programadas');
  const disponiveis = Amv.soma(lista, 'qtd_disponiveis');
  const ajustes = Amv.soma(lista, 'qtd_ajustes');
  const reprovadas = Amv.soma(lista, 'qtd_reprovadas');
  const pctAjuste = disponiveis ? (ajustes / disponiveis) * 100 : 0;

  alvo.innerHTML = `
    <div class="kpi escuro"><div class="rotulo">Inspeções</div><div class="valor">${lista.length}</div><div class="extra">relatórios no filtro</div></div>
    <div class="kpi"><div class="rotulo">Peças detalhadas</div><div class="valor">${pecas.length}</div><div class="extra">itens descritos nos relatórios</div></div>
    <div class="kpi"><div class="rotulo">Peças disponíveis</div><div class="valor">${disponiveis}</div><div class="extra">de ${programadas} programadas</div></div>
    <div class="kpi amarelo"><div class="rotulo">Ajustes</div><div class="valor">${ajustes}</div><div class="extra">${pctAjuste.toFixed(1)}% das disponíveis</div></div>
    <div class="kpi"><div class="rotulo">Com defeito</div><div class="valor">${comDefeito}</div><div class="extra">peças com defeito descrito</div></div>
    <div class="kpi"><div class="rotulo">Reprovadas</div><div class="valor">${reprovadas}</div><div class="extra">declaradas no cabeçalho</div></div>`;
}

function renderDefeitos(lista) {
  const alvo = document.getElementById('listaDefeitos');
  const contador = document.getElementById('contadorDefeitos');
  if (!alvo) return;

  const itens = [];
  lista.forEach(i => {
    Amv.pecas(i).filter(p => p.tem_defeito === true).forEach(p => itens.push({ inspecao: i, peca: p }));
  });
  itens.sort((a, b) => String(b.inspecao.data_inspecao || '').localeCompare(String(a.inspecao.data_inspecao || '')));

  if (contador) contador.textContent = AMV_CARREGANDO ? 'Carregando...' : `${itens.length} peça(s)`;

  if (AMV_CARREGANDO || AMV_ERRO || !itens.length) {
    alvo.innerHTML = estadoVazio('Nenhuma peça com defeito no filtro');
    return;
  }

  alvo.innerHTML = `<div class="tabela-wrap"><table class="tabela">
    <thead><tr><th>Data</th><th>Fornecedor</th><th>Peça</th><th>Pedido</th><th>Defeito descrito</th></tr></thead>
    <tbody>${itens.map(({ inspecao, peca }) => `<tr>
      <td>${U.dataBR(inspecao.data_inspecao)}</td>
      <td>${U.esc(Amv.fornecedor(inspecao))}</td>
      <td><strong>${U.esc(peca.tipo_peca || '—')}</strong><br><span class="txt-mini txt-cinza">${U.esc([peca.familia, peca.trilho, peca.inclinacao].filter(Boolean).join(' · ') || '—')}</span></td>
      <td>${U.esc(peca.numero_pedido || inspecao.numero_pedido || '—')}</td>
      <td>${Amv.defeitos(peca).map(d => Amv.texto(d.descricao)).join('<br>') || '<span class="txt-cinza">Marcada com defeito, sem descrição</span>'}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

function renderUltimas(lista) {
  const alvo = document.getElementById('listaUltimas');
  if (!alvo) return;

  if (AMV_CARREGANDO || AMV_ERRO || AMV_TABELA_FALTANDO || !lista.length) {
    alvo.innerHTML = estadoVazio('Nenhuma inspeção no filtro');
    return;
  }

  // Ordena aqui em vez de confiar na ordem que veio do banco: os filtros
  // preservam a ordem de origem, e "últimas" precisa ser por data.
  const ultimas = [...lista]
    .sort((a, b) => String(b.data_inspecao || '').localeCompare(String(a.data_inspecao || '')))
    .slice(0, 15);

  alvo.innerHTML = `<div class="tabela-wrap"><table class="tabela">
    <thead><tr><th>Data</th><th>Fornecedor</th><th>Projeto</th><th>Pedido</th><th>Disponíveis</th><th>Ajustes</th><th>Responsável</th><th>Origem</th></tr></thead>
    <tbody>${ultimas.map(i => `<tr>
      <td>${U.dataBR(i.data_inspecao)}</td>
      <td><strong>${U.esc(Amv.fornecedor(i))}</strong></td>
      <td>${Amv.badgesProjeto(i)}</td>
      <td>${U.esc(i.numero_pedido || '—')}</td>
      <td>${Amv.inteiro(i.qtd_disponiveis)} de ${Amv.inteiro(i.qtd_programadas)}${Amv.totalPecasComDefeito(i) ? ` <span class="badge badge-reprovado">${Amv.totalPecasComDefeito(i)} com defeito</span>` : ''}</td>
      <td>${Amv.inteiro(i.qtd_ajustes)}</td>
      <td>${U.esc(i.responsavel || '—')}</td>
      <td>${Amv.badgeOrigem(i)}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

function renderGraficos(lista) {
  if (!window.Chart) return;
  App.aplicarPadraoGraficos();
  const cores = App.coresGrafico();

  const porFornecedor = agrupar(lista, i => Amv.fornecedor(i));
  desenhar('chartFornecedor', {
    type: 'bar',
    data: {
      labels: porFornecedor.map(x => x.chave),
      datasets: [{ label: 'Inspeções', data: porFornecedor.map(x => x.total), backgroundColor: cores.azulClaro, borderRadius: 4 }],
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } },
  });

  const pecas = lista.flatMap(i => Amv.pecas(i));
  const porFamilia = agrupar(pecas, p => p.familia || 'Sem classificação');
  desenhar('chartFamilia', {
    type: 'doughnut',
    data: {
      labels: porFamilia.map(x => x.chave),
      datasets: [{ data: porFamilia.map(x => x.total), backgroundColor: cores.paleta }],
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } },
  });

  const meses = Array.from(new Set(lista.map(i => Amv.mesDe(i.data_inspecao)).filter(Boolean))).sort();
  const somaMes = (mes, campo) => Amv.soma(lista.filter(i => Amv.mesDe(i.data_inspecao) === mes), campo);
  desenhar('chartMes', {
    type: 'bar',
    data: {
      labels: meses.map(Amv.rotuloMes),
      datasets: [
        { label: 'Programadas', data: meses.map(m => somaMes(m, 'qtd_programadas')), backgroundColor: cores.cinza, borderRadius: 4 },
        { label: 'Disponíveis', data: meses.map(m => somaMes(m, 'qtd_disponiveis')), backgroundColor: cores.verde, borderRadius: 4 },
        { label: 'Ajustes', data: meses.map(m => somaMes(m, 'qtd_ajustes')), backgroundColor: cores.amarelo, borderRadius: 4 },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } },
  });
}

function agrupar(lista, chaveDe) {
  const mapa = new Map();
  (lista || []).forEach(item => {
    const k = String(chaveDe(item) || '—');
    mapa.set(k, (mapa.get(k) || 0) + 1);
  });
  return Array.from(mapa, ([chave, total]) => ({ chave, total })).sort((a, b) => b.total - a.total);
}

function desenhar(canvasId, config) {
  const el = document.getElementById(canvasId);
  if (!el) return;
  if (AMV_GRAFICOS[canvasId]) AMV_GRAFICOS[canvasId].destroy();
  AMV_GRAFICOS[canvasId] = new Chart(el, config);
}

window.carregarAmv = carregarAmv;
window.render = render;
