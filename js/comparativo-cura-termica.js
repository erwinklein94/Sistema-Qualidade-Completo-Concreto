/* =====================================================================
   COMPARATIVO-CURA-TERMICA.JS — Ferro Norte · histórico de CPs 14 × 28 dias
   Compara compressão axial e tração dos corpos de prova de todos os lotes,
   com filtro entre cura térmica e cura normal.
   Mostra os valores REAIS de cada corpo de prova (CP1 e CP2), sem média.
   Fonte: producao_lotes (comp_14/tracao_14/comp_28/tracao_28 + CP2).
   ===================================================================== */
let CCT_CHARTS = {};
const CCT = {
  prod: [],
  carregando: true,
  erro: '',
  ordem: 'desc',
  modalChart: null,
  modalLoteId: '',
  ultimoFoco: null,
};

document.addEventListener('DOMContentLoaded', async () => {
  if (!await Auth.exigirLogin()) return;
  App.montarLayout('comparativoCuraTermica', 'Histórico de Cura — Ferro Norte', 'Compressão axial e tração dos CPs · cura térmica e normal · 14 × 28 dias');
  App.acoesTopo(`<button class="btn btn-primario" onclick="carregarComparativoCuraTermica()">${ICN.filtro}Atualizar</button>`);

  document.getElementById('fFornecedor').innerHTML = U.opcoes(CFG.listas.fornecedores, '', 'Todas');
  let buscaTimer = null;
  document.getElementById('busca')?.addEventListener('input', () => {
    clearTimeout(buscaTimer);
    buscaTimer = setTimeout(renderComparativo, 200);
  });
  ['fFornecedor', 'fTipoCura', 'fPeriodoIni', 'fPeriodoFim'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', renderComparativo);
  });
  document.getElementById('btnOrdenacao')?.addEventListener('click', alternarOrdemComparativo);
  document.getElementById('tabelaComparativo')?.addEventListener('click', eventoDetalheLote);
  document.getElementById('fecharModalDetalhe')?.addEventListener('click', fecharDetalheLote);
  document.getElementById('modalDetalheLote')?.addEventListener('click', eventoFecharOverlayDetalhe);
  document.addEventListener('keydown', eventoTecladoDetalhe);
  atualizarBotaoOrdenacao();

  App.aplicarPadraoGraficos();
  renderComparativo();
  await carregarComparativoCuraTermica();
});

async function listarHistoricoFerroNorte() {
  const cliente = window.Auth?.cliente?.();
  if (!cliente) throw new Error('Supabase não configurado.');

  const tamanhoPagina = 1000;
  const colunas = [
    'id',
    'lote',
    'data_fabricacao',
    'fornecedor',
    'projeto',
    'cura_termica',
    'comp_14',
    'comp_14_cp2',
    'tracao_14',
    'tracao_14_cp2',
    'comp_28',
    'comp_28_cp2',
    'tracao_28',
    'tracao_28_cp2',
  ].join(',');
  const historico = [];
  let ultimoId = '';

  for (;;) {
    let consulta = cliente
      .from('producao_lotes')
      .select(colunas)
      .ilike('projeto', 'ferro%')
      .order('id', { ascending: true })
      .limit(tamanhoPagina);

    if (ultimoId) consulta = consulta.gt('id', ultimoId);

    const { data, error } = await consulta;

    if (error) throw error;

    const pagina = data || [];
    historico.push(...pagina);
    if (pagina.length < tamanhoPagina) break;

    const proximoId = String(pagina[pagina.length - 1]?.id || '');
    if (!proximoId || proximoId === ultimoId) {
      throw new Error('Não foi possível avançar na paginação do histórico.');
    }
    ultimoId = proximoId;
  }

  return historico;
}

async function carregarComparativoCuraTermica() {
  CCT.carregando = true;
  CCT.erro = '';
  renderComparativo();
  try {
    const producao = await listarHistoricoFerroNorte();
    CCT.prod = (producao || []).filter(r =>
      FluxoLiberacao.projetoCanonico(r) === 'FERRO NORTE');
    CCT.carregando = false;
    renderComparativo();
  } catch (err) {
    console.error('Erro ao carregar histórico de cura da Ferro Norte', err);
    CCT.carregando = false;
    CCT.erro = err?.message || 'Não foi possível carregar os lotes do Supabase.';
    App.toast(CCT.erro, 'erro');
    renderComparativo();
  }
}

function numCp(v) {
  let s = String(v == null ? '' : v).replace(/[^\d.,-]/g, '').trim();
  if (!s) return null;
  // "52,3" (vírgula decimal) e "1.234,5" (ponto de milhar) → formato JS
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

// Par de corpos de prova: mantém os dois valores reais, sem média.
function par(cp1, cp2) {
  return { cp1: numCp(cp1), cp2: numCp(cp2) };
}

function temValor(p) {
  return p.cp1 != null || p.cp2 != null;
}

function temResultado(lote) {
  return temValor(lote.comp14) || temValor(lote.tracao14)
    || temValor(lote.comp28) || temValor(lote.tracao28);
}

function fmtCp(v, casas = 1) {
  return v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

function ganhoPct(v14, v28) {
  if (v14 == null || v28 == null || v14 === 0) return null;
  return ((v28 - v14) / v14) * 100;
}

function atualizarBotaoOrdenacao() {
  const botao = document.getElementById('btnOrdenacao');
  if (!botao) return;

  const recentesPrimeiro = CCT.ordem === 'desc';
  botao.textContent = recentesPrimeiro
    ? '↓ Mais recentes primeiro'
    : '↑ Mais antigos primeiro';
  botao.setAttribute(
    'aria-label',
    recentesPrimeiro
      ? 'Ordenação atual: lotes mais recentes primeiro. Clique para mostrar os mais antigos primeiro.'
      : 'Ordenação atual: lotes mais antigos primeiro. Clique para mostrar os mais recentes primeiro.',
  );
  botao.setAttribute('aria-pressed', recentesPrimeiro ? 'false' : 'true');
}

function alternarOrdemComparativo() {
  CCT.ordem = CCT.ordem === 'desc' ? 'asc' : 'desc';
  atualizarBotaoOrdenacao();
  renderComparativo();
}

function normalizarLote(r) {
  const lote = String(r.lote || '—');
  const data = String(r.data_fabricacao || '').slice(0, 10);
  return {
    id: String(r.id || `${lote}::${data}`),
    lote,
    data,
    fornecedor: r.fornecedor || '',
    curaTermica: !!r.cura_termica,
    comp14: par(r.comp_14, r.comp_14_cp2),
    tracao14: par(r.tracao_14, r.tracao_14_cp2),
    comp28: par(r.comp_28, r.comp_28_cp2),
    tracao28: par(r.tracao_28, r.tracao_28_cp2),
  };
}

function historicoCompletoComparativo() {
  return CCT.prod.map(normalizarLote);
}

function lotesComparativo() {
  const busca = document.getElementById('busca')?.value.toLowerCase().trim() || '';
  const fornecedor = document.getElementById('fFornecedor')?.value || '';
  const tipoCura = document.getElementById('fTipoCura')?.value || '';
  const ini = document.getElementById('fPeriodoIni')?.value || '';
  const fim = document.getElementById('fPeriodoFim')?.value || '';

  return CCT.prod
    .filter(r => {
      const data = String(r.data_fabricacao || '').slice(0, 10);
      if (fornecedor && r.fornecedor !== fornecedor) return false;
      if (tipoCura === 'termica' && !r.cura_termica) return false;
      if (tipoCura === 'normal' && !!r.cura_termica) return false;
      if (ini && (!data || data < ini)) return false;
      if (fim && (!data || data > fim)) return false;
      if (busca && !String(r.lote || '').toLowerCase().includes(busca)) return false;
      return true;
    })
    .map(normalizarLote)
    .sort((a, b) => {
      if (!a.data && !b.data) {
        return String(a.lote).localeCompare(String(b.lote), 'pt-BR', { numeric: true });
      }
      if (!a.data) return 1;
      if (!b.data) return -1;

      const direcao = CCT.ordem === 'asc' ? 1 : -1;
      return (a.data.localeCompare(b.data) * direcao)
        || (String(a.lote).localeCompare(String(b.lote), 'pt-BR', { numeric: true }) * direcao);
    });
}

function renderComparativo() {
  const kpis = document.getElementById('kpisComparativo');
  const tabela = document.getElementById('tabelaComparativo');
  if (!kpis || !tabela) return;

  if (CCT.carregando) {
    kpis.innerHTML = `<div class="kpi escuro"><div class="rotulo">Histórico Ferro Norte</div><div class="valor">...</div><div class="extra">Carregando todos os tipos de cura</div></div>`;
    tabela.innerHTML = `<div class="vazio">${ICN.vazioBox}<h3>Carregando</h3><p>Buscando produção no Supabase.</p></div>`;
    destruirGraficosComparativo();
    return;
  }
  if (CCT.erro) {
    kpis.innerHTML = `<div class="kpi vermelho"><div class="rotulo">Erro</div><div class="valor">!</div><div class="extra">${U.esc(CCT.erro)}</div></div>`;
    tabela.innerHTML = `<div class="vazio">${ICN.alerta}<h3>Erro ao carregar</h3><p>${U.esc(CCT.erro)}</p><button class="btn btn-secundario" onclick="carregarComparativoCuraTermica()">Tentar novamente</button></div>`;
    destruirGraficosComparativo();
    return;
  }

  const lotes = lotesComparativo();
  renderKpisComparativo(lotes);
  desenharGraficosComparativo(lotes);
  renderTabelaComparativo(lotes);
  registrarExportacaoComparativo(lotes);
}

function mediaLista(valores) {
  const v = valores.filter(x => x != null);
  if (!v.length) return null;
  return v.reduce((s, x) => s + x, 0) / v.length;
}

// Junta os dois CPs de uma métrica em uma lista achatada (para as médias dos KPIs).
function todosCps(lotes, metrica) {
  const out = [];
  lotes.forEach(l => {
    if (l[metrica].cp1 != null) out.push(l[metrica].cp1);
    if (l[metrica].cp2 != null) out.push(l[metrica].cp2);
  });
  return out;
}

function mediasHistoricasCompletas() {
  const lotes = historicoCompletoComparativo();
  return ['comp14', 'comp28', 'tracao14', 'tracao28'].reduce((acc, metrica) => {
    const valores = todosCps(lotes, metrica);
    acc[metrica] = { media: mediaLista(valores), quantidade: valores.length };
    return acc;
  }, {});
}

function renderKpisComparativo(lotes) {
  const mComp14 = mediaLista(todosCps(lotes, 'comp14'));
  const mComp28 = mediaLista(todosCps(lotes, 'comp28'));
  const mTracao14 = mediaLista(todosCps(lotes, 'tracao14'));
  const mTracao28 = mediaLista(todosCps(lotes, 'tracao28'));
  const completos = lotes.filter(l => temValor(l.comp14) && temValor(l.comp28)).length;
  const gComp = ganhoPct(mComp14, mComp28);
  const gTracao = ganhoPct(mTracao14, mTracao28);
  const termicos = lotes.filter(l => l.curaTermica).length;
  const normais = lotes.length - termicos;

  document.getElementById('kpisComparativo').innerHTML = `
    <div class="kpi escuro"><div class="rotulo">Lotes Ferro Norte</div><div class="valor">${lotes.length}</div><div class="extra">${termicos} térmicos · ${normais} normais<br>${completos} com compressão em 14 e 28 dias</div></div>
    <div class="kpi"><div class="rotulo">Compressão média 14d</div><div class="valor">${fmtCp(mComp14)}</div><div class="extra">MPa · média de todos os CPs</div></div>
    <div class="kpi verde"><div class="rotulo">Compressão média 28d</div><div class="valor">${fmtCp(mComp28)}</div><div class="extra">${gComp == null ? 'sem base de comparação' : `ganho de ${fmtCp(gComp)}% sobre 14d`}</div></div>
    <div class="kpi"><div class="rotulo">Tração média 14d</div><div class="valor">${fmtCp(mTracao14)}</div><div class="extra">MPa · média de todos os CPs</div></div>
    <div class="kpi verde"><div class="rotulo">Tração média 28d</div><div class="valor">${fmtCp(mTracao28)}</div><div class="extra">${gTracao == null ? 'sem base de comparação' : `ganho de ${fmtCp(gTracao)}% sobre 14d`}</div></div>
  `;
}

function destruirGraficosComparativo() {
  Object.values(CCT_CHARTS).forEach(c => c && c.destroy());
  CCT_CHARTS = {};
}

function opcoesEixoDuplo(tituloY, tituloY1) {
  const corTexto = App.cssVar('--cinza-texto', '#5a6b7b');
  const corGrid = App.cssVar('--cinza-borda', '#e2e8f0');
  return {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    layout: { padding: { top: 14, right: 12, bottom: 6, left: 12 } },
    plugins: {
      legend: { position: 'top', labels: { color: corTexto, usePointStyle: true, padding: 12, font: { size: 11.5 } } },
      tooltip: { backgroundColor: App.cssVar('--azul-escuro', '#003567'), padding: 10, cornerRadius: 8, titleFont: { weight: '700' } },
    },
    scales: {
      x: { ticks: { color: corTexto, maxRotation: 60, minRotation: 0, autoSkip: true }, grid: { display: false } },
      y: { position: 'left', title: { display: true, text: tituloY, color: corTexto }, ticks: { color: corTexto }, grid: { color: corGrid } },
      y1: { position: 'right', title: { display: true, text: tituloY1, color: corTexto }, ticks: { color: corTexto }, grid: { drawOnChartArea: false } },
    },
  };
}

// Uma linha por corpo de prova. Regra visual: CP1 = linha cheia (círculo),
// CP2 = linha tracejada (triângulo). A cor separa métrica/idade.
function dsCp({ label, data, cor, eixo, cp2 }) {
  return {
    type: 'line',
    label,
    data,
    borderColor: cor,
    backgroundColor: cor,
    borderWidth: 2.4,
    borderDash: cp2 ? [7, 5] : [],
    tension: 0.25,
    spanGaps: true,
    pointRadius: 3.4,
    pointStyle: cp2 ? 'triangle' : 'circle',
    pointBackgroundColor: cor,
    yAxisID: eixo,
  };
}

function desenharGraficosComparativo(lotes) {
  destruirGraficosComparativo();
  const lotesComResultado = lotes.filter(temResultado);
  const C = App.coresGrafico();
  const labels = lotesComResultado.map(l => l.lote);
  const corComp14 = C.azulClaro || '#32A6E6';
  const corComp28 = C.azulEscuro || '#003567';
  const corTracao14 = C.amarelo || '#FFD401';
  const corTracao28 = C.erro || '#c0392b';
  const val = (metrica, cp) => lotesComResultado.map(l => l[metrica][cp]);

  if (!lotesComResultado.length) return;

  CCT_CHARTS.c14 = new Chart(document.getElementById('chart14'), {
    data: {
      labels,
      datasets: [
        dsCp({ label: 'Compressão CP1 · 14d', data: val('comp14', 'cp1'), cor: corComp14, eixo: 'y' }),
        dsCp({ label: 'Compressão CP2 · 14d', data: val('comp14', 'cp2'), cor: corComp14, eixo: 'y', cp2: true }),
        dsCp({ label: 'Tração CP1 · 14d', data: val('tracao14', 'cp1'), cor: corTracao14, eixo: 'y1' }),
        dsCp({ label: 'Tração CP2 · 14d', data: val('tracao14', 'cp2'), cor: corTracao14, eixo: 'y1', cp2: true }),
      ],
    },
    options: opcoesEixoDuplo('Compressão (MPa)', 'Tração (MPa)'),
  });

  CCT_CHARTS.c28 = new Chart(document.getElementById('chart28'), {
    data: {
      labels,
      datasets: [
        dsCp({ label: 'Compressão CP1 · 28d', data: val('comp28', 'cp1'), cor: corComp28, eixo: 'y' }),
        dsCp({ label: 'Compressão CP2 · 28d', data: val('comp28', 'cp2'), cor: corComp28, eixo: 'y', cp2: true }),
        dsCp({ label: 'Tração CP1 · 28d', data: val('tracao28', 'cp1'), cor: corTracao28, eixo: 'y1' }),
        dsCp({ label: 'Tração CP2 · 28d', data: val('tracao28', 'cp2'), cor: corTracao28, eixo: 'y1', cp2: true }),
      ],
    },
    options: opcoesEixoDuplo('Compressão (MPa)', 'Tração (MPa)'),
  });

  CCT_CHARTS.comp = new Chart(document.getElementById('chartComparativo'), {
    data: {
      labels,
      datasets: [
        dsCp({ label: 'Comp. CP1 · 14d', data: val('comp14', 'cp1'), cor: corComp14, eixo: 'y' }),
        dsCp({ label: 'Comp. CP2 · 14d', data: val('comp14', 'cp2'), cor: corComp14, eixo: 'y', cp2: true }),
        dsCp({ label: 'Comp. CP1 · 28d', data: val('comp28', 'cp1'), cor: corComp28, eixo: 'y' }),
        dsCp({ label: 'Comp. CP2 · 28d', data: val('comp28', 'cp2'), cor: corComp28, eixo: 'y', cp2: true }),
        dsCp({ label: 'Tração CP1 · 14d', data: val('tracao14', 'cp1'), cor: corTracao14, eixo: 'y1' }),
        dsCp({ label: 'Tração CP2 · 14d', data: val('tracao14', 'cp2'), cor: corTracao14, eixo: 'y1', cp2: true }),
        dsCp({ label: 'Tração CP1 · 28d', data: val('tracao28', 'cp1'), cor: corTracao28, eixo: 'y1' }),
        dsCp({ label: 'Tração CP2 · 28d', data: val('tracao28', 'cp2'), cor: corTracao28, eixo: 'y1', cp2: true }),
      ],
    },
    options: opcoesEixoDuplo('Compressão (MPa)', 'Tração (MPa)'),
  });
}

// Célula com os dois CPs empilhados (mantém a coluna estreita).
function celulaPar(p) {
  if (!temValor(p)) return '—';
  return `<span class="cp-dupla">
    <span class="cp-v"><i>CP1</i>${fmtCp(p.cp1)}</span>
    <span class="cp-v"><i>CP2</i>${fmtCp(p.cp2)}</span>
  </span>`;
}

function badgeGanho(rot, v) {
  if (v == null) return `<span class="cp-v"><i>${rot}</i>—</span>`;
  const cls = v >= 0 ? 'badge-ok' : 'badge-reprovado';
  return `<span class="cp-v"><i>${rot}</i><span class="badge ${cls}">${v >= 0 ? '+' : ''}${fmtCp(v)}%</span></span>`;
}

function celulaGanho(p14, p28) {
  const g1 = ganhoPct(p14.cp1, p28.cp1);
  const g2 = ganhoPct(p14.cp2, p28.cp2);
  if (g1 == null && g2 == null) return '—';
  return `<span class="cp-dupla">${badgeGanho('CP1', g1)}${badgeGanho('CP2', g2)}</span>`;
}

function renderTabelaComparativo(lotes) {
  const alvo = document.getElementById('tabelaComparativo');
  if (!lotes.length) {
    alvo.innerHTML = `<div class="vazio">${ICN.vazioBox}<h3>Nenhum lote encontrado</h3><p>Não há lotes da Ferro Norte para os filtros atuais. Ajuste o tipo de cura, a fábrica, o período ou a busca pelo lote.</p></div>`;
    return;
  }
  const linha = l => `<tr>
      <td><button type="button" class="lote-detalhe-btn" data-detalhe-id="${U.esc(l.id)}" aria-label="Abrir resultados do lote ${U.esc(l.lote)}">${U.esc(l.lote)}</button></td>
      <td>${U.dataBR(l.data)}</td>
      <td>${U.esc(l.fornecedor || '—')}</td>
      <td>${l.curaTermica
        ? '<span class="tag-termica">Cura térmica</span>'
        : '<span class="badge badge-entregue">Cura normal</span>'}</td>
      <td class="right">${celulaPar(l.comp14)}</td>
      <td class="right">${celulaPar(l.comp28)}</td>
      <td class="right">${celulaGanho(l.comp14, l.comp28)}</td>
      <td class="right">${celulaPar(l.tracao14)}</td>
      <td class="right">${celulaPar(l.tracao28)}</td>
      <td class="right">${celulaGanho(l.tracao14, l.tracao28)}</td>
    </tr>`;
  alvo.innerHTML = `<div class="tabela-wrap"><table class="tabela tabela-cp">
    <thead><tr>
      <th>Lote</th><th>Fabricação</th><th>Fábrica</th><th>Tipo de cura</th>
      <th class="right">Comp. 14d</th><th class="right">Comp. 28d</th><th class="right">Ganho comp.</th>
      <th class="right">Tração 14d</th><th class="right">Tração 28d</th><th class="right">Ganho tração</th>
    </tr></thead>
    <tbody>${lotes.map(linha).join('')}</tbody>
  </table></div>`;
}

function mediaDoPar(p) {
  return mediaLista([p.cp1, p.cp2]);
}

function diferencaReferencia(mediaLote, mediaHistorica) {
  if (mediaLote == null || mediaHistorica == null) return 'Sem comparação';
  const diferenca = mediaLote - mediaHistorica;
  return `${diferenca >= 0 ? '+' : ''}${fmtCp(diferenca)} MPa vs. histórico`;
}

function valorMetrica(rotulo, valor, complemento = 'MPa') {
  return `<div class="modal-lote-valor">
    <small>${rotulo}</small>
    <b>${fmtCp(valor)}</b>
    <em>${valor == null ? 'sem resultado' : complemento}</em>
  </div>`;
}

function cartaoMetrica({ titulo, idade, tipo, parLote, referencia }) {
  const mediaLote = mediaDoPar(parLote);
  return `<article class="modal-lote-metrica ${tipo}">
    <div class="modal-lote-metrica-cab"><strong>${titulo}</strong><span>${idade}</span></div>
    <div class="modal-lote-valores">
      ${valorMetrica('CP1', parLote.cp1)}
      ${valorMetrica('CP2', parLote.cp2)}
      ${valorMetrica('Média do lote', mediaLote, diferencaReferencia(mediaLote, referencia.media))}
      ${valorMetrica('Média histórica', referencia.media, `${referencia.quantidade} CPs considerados`)}
    </div>
  </article>`;
}

function eventoDetalheLote(event) {
  const botao = event.target.closest('[data-detalhe-id]');
  if (!botao) return;
  abrirDetalheLote(botao.dataset.detalheId, botao);
}

function eventoFecharOverlayDetalhe(event) {
  if (event.target.id === 'modalDetalheLote') fecharDetalheLote();
}

function eventoTecladoDetalhe(event) {
  if (event.key === 'Escape' && CCT.modalLoteId) fecharDetalheLote();
}

function abrirDetalheLote(id, elementoOrigem) {
  const lote = historicoCompletoComparativo().find(item => item.id === String(id));
  const modal = document.getElementById('modalDetalheLote');
  if (!lote || !modal) return;

  const medias = mediasHistoricasCompletas();
  CCT.modalLoteId = lote.id;
  CCT.ultimoFoco = elementoOrigem || document.activeElement;
  document.getElementById('modalDetalheTitulo').textContent = `Lote ${lote.lote}`;
  document.getElementById('modalDetalheSubtitulo').textContent =
    'Compressão axial e tração dos CPs aos 14 e 28 dias';
  document.getElementById('modalDetalheMeta').innerHTML = `
    <span>Fabricação: ${U.dataBR(lote.data)}</span>
    <span>Fábrica: ${U.esc(lote.fornecedor || '—')}</span>
    <span>${lote.curaTermica ? 'Cura térmica' : 'Cura normal'}</span>`;
  document.getElementById('modalDetalheMetricas').innerHTML = [
    cartaoMetrica({ titulo: 'Compressão axial', idade: '14 dias', tipo: 'comp', parLote: lote.comp14, referencia: medias.comp14 }),
    cartaoMetrica({ titulo: 'Compressão axial', idade: '28 dias', tipo: 'comp', parLote: lote.comp28, referencia: medias.comp28 }),
    cartaoMetrica({ titulo: 'Tração', idade: '14 dias', tipo: 'tracao', parLote: lote.tracao14, referencia: medias.tracao14 }),
    cartaoMetrica({ titulo: 'Tração', idade: '28 dias', tipo: 'tracao', parLote: lote.tracao28, referencia: medias.tracao28 }),
  ].join('');

  modal.classList.add('aberto');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  document.getElementById('fecharModalDetalhe')?.focus();
  requestAnimationFrame(() => desenharGraficoDetalheLote(lote, medias));
}

function fecharDetalheLote() {
  const modal = document.getElementById('modalDetalheLote');
  if (!modal) return;
  modal.classList.remove('aberto');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  CCT.modalLoteId = '';
  if (CCT.modalChart) CCT.modalChart.destroy();
  CCT.modalChart = null;
  CCT.ultimoFoco?.focus?.();
  CCT.ultimoFoco = null;
}

function datasetDetalhe({ label, data, cor, eixo, cp2 = false, historico = false }) {
  return {
    type: 'line',
    label,
    data,
    borderColor: cor,
    backgroundColor: cor,
    borderWidth: historico ? 3 : 2.4,
    borderDash: historico ? [10, 6] : (cp2 ? [3, 4] : []),
    tension: 0.2,
    spanGaps: true,
    pointRadius: historico ? 4.5 : 5,
    pointHoverRadius: 7,
    pointStyle: historico ? 'rectRot' : (cp2 ? 'triangle' : 'circle'),
    pointBackgroundColor: cor,
    yAxisID: eixo,
  };
}

function desenharGraficoDetalheLote(lote, medias) {
  if (CCT.modalChart) CCT.modalChart.destroy();
  const canvas = document.getElementById('chartDetalheLote');
  if (!canvas || !document.getElementById('modalDetalheLote')?.classList.contains('aberto')) return;

  const C = App.coresGrafico();
  const corComp1 = C.azulClaro || '#32A6E6';
  const corComp2 = C.azulEscuro || '#003567';
  const corTracao1 = C.amarelo || '#FFD401';
  const corTracao2 = C.erro || '#c0392b';
  const corHistComp = C.verde || '#00A67E';
  const corHistTracao = '#8e44ad';
  const corTexto = App.cssVar('--cinza-texto', '#5a6b7b');
  const corGrid = App.cssVar('--cinza-borda', '#e2e8f0');

  CCT.modalChart = new Chart(canvas, {
    data: {
      labels: ['14 dias', '28 dias'],
      datasets: [
        datasetDetalhe({ label: 'Compressão CP1 · lote', data: [lote.comp14.cp1, lote.comp28.cp1], cor: corComp1, eixo: 'y' }),
        datasetDetalhe({ label: 'Compressão CP2 · lote', data: [lote.comp14.cp2, lote.comp28.cp2], cor: corComp2, eixo: 'y', cp2: true }),
        datasetDetalhe({ label: 'Média histórica · compressão', data: [medias.comp14.media, medias.comp28.media], cor: corHistComp, eixo: 'y', historico: true }),
        datasetDetalhe({ label: 'Tração CP1 · lote', data: [lote.tracao14.cp1, lote.tracao28.cp1], cor: corTracao1, eixo: 'y1' }),
        datasetDetalhe({ label: 'Tração CP2 · lote', data: [lote.tracao14.cp2, lote.tracao28.cp2], cor: corTracao2, eixo: 'y1', cp2: true }),
        datasetDetalhe({ label: 'Média histórica · tração', data: [medias.tracao14.media, medias.tracao28.media], cor: corHistTracao, eixo: 'y1', historico: true }),
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      layout: { padding: { top: 8, right: 8, bottom: 4, left: 8 } },
      plugins: {
        legend: {
          position: 'top',
          labels: { color: corTexto, usePointStyle: true, padding: 14, boxWidth: 10, font: { size: 11 } },
        },
        tooltip: {
          backgroundColor: App.cssVar('--azul-escuro', '#003567'),
          padding: 11,
          cornerRadius: 9,
          callbacks: { label: ctx => `${ctx.dataset.label}: ${fmtCp(ctx.parsed.y)} MPa` },
        },
      },
      scales: {
        x: { ticks: { color: corTexto, font: { weight: '700' } }, grid: { display: false } },
        y: {
          position: 'left',
          title: { display: true, text: 'Compressão axial (MPa)', color: corTexto },
          ticks: { color: corTexto },
          grid: { color: corGrid },
        },
        y1: {
          position: 'right',
          title: { display: true, text: 'Tração (MPa)', color: corTexto },
          ticks: { color: corTexto },
          grid: { drawOnChartArea: false },
        },
      },
    },
  });
}

// Texto "CP1 x · CP2 y" para as exportações.
function parTexto(p) {
  return `CP1 ${p.cp1 == null ? '—' : fmtCp(p.cp1)} · CP2 ${p.cp2 == null ? '—' : fmtCp(p.cp2)}`;
}

function ganhoTexto(p14, p28) {
  const g1 = ganhoPct(p14.cp1, p28.cp1);
  const g2 = ganhoPct(p14.cp2, p28.cp2);
  const t = (rot, v) => `${rot} ${v == null ? '—' : (v >= 0 ? '+' : '') + fmtCp(v) + '%'}`;
  return `${t('CP1', g1)} · ${t('CP2', g2)}`;
}

function registrarExportacaoComparativo(lotes) {
  if (!window.Exportacoes) return;
  Exportacoes.registrar({
    titulo: 'Histórico de Cura — Ferro Norte (14 × 28 dias)',
    nomeArquivo: 'historico-cura-ferro-norte',
    filtros: Exportacoes.filtrosDaTela(),
    secoes: [{
      titulo: 'Todos os lotes Ferro Norte — CPs 14 × 28 dias (valores reais)',
      columns: [
        { key: 'lote', label: 'Lote' },
        { key: 'dataExport', label: 'Fabricação' },
        { key: 'fornecedor', label: 'Fábrica' },
        { key: 'tipoCuraExport', label: 'Tipo de cura' },
        { key: 'comp14Export', label: 'Compressão 14d (MPa)' },
        { key: 'comp28Export', label: 'Compressão 28d (MPa)' },
        { key: 'ganhoCompExport', label: 'Ganho compressão' },
        { key: 'tracao14Export', label: 'Tração 14d (MPa)' },
        { key: 'tracao28Export', label: 'Tração 28d (MPa)' },
        { key: 'ganhoTracaoExport', label: 'Ganho tração' },
      ],
      rows: lotes.map(l => ({
        lote: l.lote,
        fornecedor: l.fornecedor,
        tipoCuraExport: l.curaTermica ? 'Cura térmica' : 'Cura normal',
        dataExport: U.dataBR(l.data),
        comp14Export: parTexto(l.comp14),
        comp28Export: parTexto(l.comp28),
        ganhoCompExport: ganhoTexto(l.comp14, l.comp28),
        tracao14Export: parTexto(l.tracao14),
        tracao28Export: parTexto(l.tracao28),
        ganhoTracaoExport: ganhoTexto(l.tracao14, l.tracao28),
      })),
    }],
    graficos: [
      { titulo: 'Acompanhamento 14 dias — Compressão × Tração (CP1 e CP2)', canvasId: 'chart14' },
      { titulo: 'Liberação 28 dias — Compressão × Tração (CP1 e CP2)', canvasId: 'chart28' },
      { titulo: 'Comparativo 14 × 28 dias (CP1 e CP2)', canvasId: 'chartComparativo' },
    ],
  });
}

window.render = renderComparativo;
window.carregarComparativoCuraTermica = carregarComparativoCuraTermica;
window.abrirDetalheLote = abrirDetalheLote;
window.fecharDetalheLote = fecharDetalheLote;
