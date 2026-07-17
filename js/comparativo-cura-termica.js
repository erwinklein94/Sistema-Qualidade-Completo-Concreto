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
  personalizadoAberto: false,
  personalizadoCharts: {},
  personalizadoResumos: [],
  ultimoFocoPersonalizado: null,
};

document.addEventListener('DOMContentLoaded', async () => {
  if (!await Auth.exigirLogin()) return;
  App.montarLayout('comparativoCuraTermica', 'Histórico de Cura — Ferro Norte', 'Compressão axial e tração dos CPs · cura térmica e normal · 14 × 28 dias');
  App.acoesTopo(`
    <button class="btn btn-comparativo-personalizado" onclick="abrirComparativoPersonalizado(this)">Comparativo Personalizado</button>
    <button class="btn btn-primario" onclick="carregarComparativoCuraTermica()">${ICN.filtro}Atualizar</button>`);

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
  document.getElementById('fecharComparativoPersonalizado')?.addEventListener('click', fecharComparativoPersonalizado);
  document.getElementById('modalComparativoPersonalizado')?.addEventListener('click', eventoFecharComparativoPersonalizado);
  document.getElementById('comparativoPersonalizadoCampos')?.addEventListener('input', eventoCamposComparativoPersonalizado);
  document.getElementById('comparativoPersonalizadoCampos')?.addEventListener('change', eventoCamposComparativoPersonalizado);
  document.getElementById('comparativoIncluirHistorico')?.addEventListener('change', limparResultadoComparativoPersonalizado);
  document.getElementById('gerarComparativoPersonalizado')?.addEventListener('click', gerarComparativoPersonalizado);
  document.getElementById('exportarComparativoPersonalizadoPDF')?.addEventListener('click', exportarComparativoPersonalizadoPDF);
  document.addEventListener('keydown', eventoTecladoComparativoPersonalizado);
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
  const temaEscuro = document.body.dataset.tema === 'escuro';
  const corComp1 = temaEscuro ? '#54c7ff' : (C.azulClaro || '#32A6E6');
  const corComp2 = temaEscuro ? '#ffffff' : (C.azulEscuro || '#003567');
  const corTracao1 = C.amarelo || '#FFD401';
  const corTracao2 = temaEscuro ? '#ff7f7f' : (C.erro || '#c0392b');
  const corHistComp = C.verde || '#00A67E';
  const corHistTracao = temaEscuro ? '#d79cff' : '#8e44ad';
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

function destruirGraficosPersonalizados() {
  Object.values(CCT.personalizadoCharts).forEach(chart => chart?.destroy?.());
  CCT.personalizadoCharts = {};
}

function abrirComparativoPersonalizado(elementoOrigem) {
  if (CCT.carregando) {
    App.toast('Aguarde o carregamento do histórico para montar o comparativo.', 'aviso');
    return;
  }
  if (CCT.erro || !CCT.prod.length) {
    App.toast('Não há histórico disponível para montar o comparativo.', 'erro');
    return;
  }

  const modal = document.getElementById('modalComparativoPersonalizado');
  if (!modal) return;

  CCT.personalizadoAberto = true;
  CCT.ultimoFocoPersonalizado = elementoOrigem || document.activeElement;
  document.getElementById('comparativoIncluirHistorico').checked = true;
  renderCamposComparativoPersonalizado();
  limparResultadoComparativoPersonalizado();
  modal.classList.add('aberto');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  document.getElementById('fecharComparativoPersonalizado')?.focus();
}

function fecharComparativoPersonalizado() {
  const modal = document.getElementById('modalComparativoPersonalizado');
  if (!modal) return;
  modal.classList.remove('aberto');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  CCT.personalizadoAberto = false;
  destruirGraficosPersonalizados();
  CCT.ultimoFocoPersonalizado?.focus?.();
  CCT.ultimoFocoPersonalizado = null;
}

function eventoFecharComparativoPersonalizado(event) {
  if (event.target.id === 'modalComparativoPersonalizado') fecharComparativoPersonalizado();
}

function eventoTecladoComparativoPersonalizado(event) {
  if (event.key === 'Escape' && CCT.personalizadoAberto) fecharComparativoPersonalizado();
}

function limparResultadoComparativoPersonalizado() {
  destruirGraficosPersonalizados();
  CCT.personalizadoResumos = [];
  const vazio = document.getElementById('comparativoPersonalizadoVazio');
  const conteudo = document.getElementById('comparativoPersonalizadoConteudo');
  if (vazio) vazio.hidden = false;
  if (conteudo) conteudo.hidden = true;
  atualizarBotaoExportacaoComparativoPersonalizado();
}

function atualizarBotaoExportacaoComparativoPersonalizado(gerando = false) {
  const botao = document.getElementById('exportarComparativoPersonalizadoPDF');
  if (!botao) return;
  botao.disabled = gerando || !CCT.personalizadoResumos.length;
  botao.textContent = gerando ? 'Gerando PDF...' : '↓ Exportar PDF';
}

function lotesPersonalizadosDisponiveis() {
  return historicoCompletoComparativo()
    .sort((a, b) => (b.data || '').localeCompare(a.data || '')
      || String(b.lote).localeCompare(String(a.lote), 'pt-BR', { numeric: true }));
}

function semanaIso(dataIso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataIso || '')) return null;
  const data = new Date(`${dataIso}T12:00:00Z`);
  if (Number.isNaN(data.getTime())) return null;
  data.setUTCDate(data.getUTCDate() + 4 - (data.getUTCDay() || 7));
  const ano = data.getUTCFullYear();
  const inicioAno = new Date(Date.UTC(ano, 0, 1));
  const semana = Math.ceil((((data - inicioAno) / 86400000) + 1) / 7);
  return { ano, semana, chave: `${ano}-W${String(semana).padStart(2, '0')}` };
}

function semanasPersonalizadasDisponiveis() {
  const agrupadas = new Map();
  historicoCompletoComparativo().forEach(lote => {
    const semana = semanaIso(lote.data);
    if (!semana) return;
    if (!agrupadas.has(semana.chave)) {
      agrupadas.set(semana.chave, { ...semana, lotes: [], inicio: lote.data, fim: lote.data });
    }
    const grupo = agrupadas.get(semana.chave);
    grupo.lotes.push(lote);
    if (lote.data < grupo.inicio) grupo.inicio = lote.data;
    if (lote.data > grupo.fim) grupo.fim = lote.data;
  });
  return [...agrupadas.values()].sort((a, b) => b.chave.localeCompare(a.chave));
}

function deslocarDataIso(dataIso, dias) {
  const data = new Date(`${dataIso}T12:00:00Z`);
  if (Number.isNaN(data.getTime())) return '';
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

function limitesHistoricoPersonalizado() {
  const datas = [...new Set(historicoCompletoComparativo()
    .map(lote => lote.data)
    .filter(data => /^\d{4}-\d{2}-\d{2}$/.test(data)))]
    .sort();
  const min = datas[0] || '';
  const max = datas[datas.length - 1] || '';
  if (datas.length < 2) return { min, max, inicioA: min, fimA: max, inicioB: min, fimB: max };

  const limiteRecente = deslocarDataIso(max, -59);
  const janela = datas.filter(data => data >= limiteRecente);
  const base = janela.length >= 2 ? janela : datas;
  const corte = Math.max(1, Math.floor(base.length / 2));
  const antigas = base.slice(0, corte);
  const recentes = base.slice(corte);
  return {
    min,
    max,
    inicioA: recentes[0],
    fimA: recentes[recentes.length - 1],
    inicioB: antigas[0],
    fimB: antigas[antigas.length - 1],
  };
}

function opcaoComparativoPersonalizado({ nome, valor, titulo, detalhe }) {
  return `<label class="comparativo-personalizado-opcao" data-comparativo-texto="${U.esc(`${titulo} ${detalhe}`.toLowerCase())}">
    <input type="checkbox" name="${nome}" value="${U.esc(valor)}">
    <span><strong>${U.esc(titulo)}</strong><small>${U.esc(detalhe)}</small></span>
  </label>`;
}

function renderCamposLotesPersonalizados() {
  const lotes = lotesPersonalizadosDisponiveis();
  return `<section class="comparativo-selecao-card">
    <div class="comparativo-selecao-cab"><strong>Lotes</strong><span data-comparativo-contador="comparativoLote">0 selecionados</span></div>
    <input type="search" id="buscaLotePersonalizado" data-comparativo-busca placeholder="Localizar lote..." aria-label="Localizar lote">
    <div class="comparativo-personalizado-lista">
      ${lotes.map(lote => opcaoComparativoPersonalizado({
        nome: 'comparativoLote',
        valor: lote.id,
        titulo: `Lote ${lote.lote}`,
        detalhe: `${U.dataBR(lote.data)} · ${lote.curaTermica ? 'cura térmica' : 'cura normal'} · ${lote.fornecedor || 'fábrica não informada'}`,
      })).join('')}
    </div>
  </section>`;
}

function renderCamposSemanasPersonalizadas() {
  const semanas = semanasPersonalizadasDisponiveis();
  return `<section class="comparativo-selecao-card">
    <div class="comparativo-selecao-cab"><strong>Semanas</strong><span data-comparativo-contador="comparativoSemana">0 selecionadas</span></div>
    <input type="search" id="buscaSemanaPersonalizada" data-comparativo-busca placeholder="Localizar semana..." aria-label="Localizar semana">
    <div class="comparativo-personalizado-lista">
      ${semanas.map(semana => opcaoComparativoPersonalizado({
        nome: 'comparativoSemana',
        valor: semana.chave,
        titulo: `Semana ${semana.semana} de ${semana.ano}`,
        detalhe: `${semana.lotes.length} lote(s) · ${U.dataBR(semana.inicio)} a ${U.dataBR(semana.fim)} · ${semana.chave}`,
      })).join('')}
    </div>
  </section>`;
}

function campoDataPersonalizado(id, rotulo, valor, limites) {
  return `<label>${rotulo}<input type="date" id="${id}" value="${valor}" min="${limites.min}" max="${limites.max}"></label>`;
}

function renderCamposPeriodosPersonalizados() {
  const limites = limitesHistoricoPersonalizado();
  return `<section class="comparativo-selecao-card larga">
    <div class="comparativo-selecao-cab"><strong>Períodos de datas</strong><span>opcionais</span></div>
    <div class="comparativo-periodos-combinados">
      <div class="comparativo-periodo-combinado inativo" data-periodo-bloco="A">
        <label class="comparativo-periodo-ativar"><input type="checkbox" id="comparativoPeriodoAAtivo">Incluir período A</label>
        <div class="comparativo-periodo-grid">
        ${campoDataPersonalizado('comparativoPeriodoAIni', 'De', limites.inicioA, limites)}
        ${campoDataPersonalizado('comparativoPeriodoAFim', 'Até', limites.fimA, limites)}
        </div>
      </div>
      <div class="comparativo-periodo-combinado inativo" data-periodo-bloco="B">
        <label class="comparativo-periodo-ativar"><input type="checkbox" id="comparativoPeriodoBAtivo">Incluir período B</label>
        <div class="comparativo-periodo-grid">
        ${campoDataPersonalizado('comparativoPeriodoBIni', 'De', limites.inicioB, limites)}
        ${campoDataPersonalizado('comparativoPeriodoBFim', 'Até', limites.fimB, limites)}
        </div>
      </div>
    </div>
  </section>`;
}

function renderCamposCuraPersonalizados() {
  return `<section class="comparativo-selecao-card larga">
    <div class="comparativo-selecao-cab"><strong>Tipos de cura</strong><span>combinam com semanas e períodos</span></div>
    <div class="comparativo-curas-combinadas">
      <label class="comparativo-personalizado-opcao"><input type="checkbox" name="comparativoCura" value="termica"><span><strong>Cura térmica</strong><small>Separar resultados térmicos.</small></span></label>
      <label class="comparativo-personalizado-opcao"><input type="checkbox" name="comparativoCura" value="normal"><span><strong>Cura normal</strong><small>Separar resultados normais.</small></span></label>
    </div>
    <p class="comparativo-curas-ajuda">Se nenhuma cura for marcada, semanas e períodos reúnem os dois tipos. Se forem marcadas, cada semana/período será dividido pelas curas escolhidas.</p>
  </section>`;
}

function renderCamposComparativoPersonalizado() {
  const alvo = document.getElementById('comparativoPersonalizadoCampos');
  if (!alvo) return;
  alvo.innerHTML = `<div class="comparativo-selecoes-grid">
    ${renderCamposLotesPersonalizados()}
    ${renderCamposSemanasPersonalizadas()}
    ${renderCamposPeriodosPersonalizados()}
    ${renderCamposCuraPersonalizados()}
  </div>`;
  sincronizarPeriodosComparativoPersonalizado();
}

function eventoCamposComparativoPersonalizado(event) {
  const alvo = event.target;
  if (alvo.matches('[data-comparativo-busca]') && event.type === 'input') {
    const busca = alvo.value.toLowerCase().trim();
    alvo.closest('.comparativo-selecao-card')?.querySelectorAll('[data-comparativo-texto]').forEach(opcao => {
      opcao.hidden = !!busca && !opcao.dataset.comparativoTexto.includes(busca);
    });
    return;
  }
  if (event.type === 'change' && ['comparativoPeriodoAAtivo', 'comparativoPeriodoBAtivo'].includes(alvo.id)) {
    sincronizarPeriodosComparativoPersonalizado();
  }
  if (alvo.type === 'checkbox' && ['comparativoLote', 'comparativoSemana'].includes(alvo.name) && event.type === 'change') {
    const marcados = [...document.querySelectorAll(`input[name="${alvo.name}"]:checked`)];
    if (marcados.length > 12) {
      alvo.checked = false;
      App.toast('Você pode selecionar no máximo 12 lotes ou semanas por vez.', 'aviso');
    }
    atualizarContadorComparativoPersonalizado(alvo.name);
  }
  if (event.type === 'change') limparResultadoComparativoPersonalizado();
}

function atualizarContadorComparativoPersonalizado(nome) {
  const quantidade = document.querySelectorAll(`input[name="${nome}"]:checked`).length;
  const contador = document.querySelector(`[data-comparativo-contador="${nome}"]`);
  if (!contador) return;
  contador.textContent = `${quantidade} ${nome === 'comparativoLote'
    ? (quantidade === 1 ? 'selecionado' : 'selecionados')
    : (quantidade === 1 ? 'selecionada' : 'selecionadas')}`;
}

function sincronizarPeriodosComparativoPersonalizado() {
  ['A', 'B'].forEach(letra => {
    const ativo = document.getElementById(`comparativoPeriodo${letra}Ativo`)?.checked === true;
    const bloco = document.querySelector(`[data-periodo-bloco="${letra}"]`);
    bloco?.classList.toggle('inativo', !ativo);
    bloco?.querySelectorAll('input[type="date"]').forEach(input => { input.disabled = !ativo; });
  });
}

function valoresSelecionadosComparativo(nome) {
  return [...document.querySelectorAll(`input[name="${nome}"]:checked`)].map(input => input.value);
}

function valorCampoPersonalizado(id) {
  return document.getElementById(id)?.value || '';
}

function validarIntervaloPersonalizado(inicio, fim, rotulo, obrigatorio = true) {
  if (obrigatorio && (!inicio || !fim)) throw new Error(`Informe as duas datas do ${rotulo}.`);
  if ((inicio && !fim) || (!inicio && fim)) throw new Error(`Informe as duas datas do ${rotulo}.`);
  if (inicio && fim && inicio > fim) throw new Error(`A data inicial do ${rotulo} deve ser anterior à data final.`);
}

function gruposBaseComparativoPersonalizado(historico) {
  const grupos = [];
  const ids = valoresSelecionadosComparativo('comparativoLote');
  const semanas = valoresSelecionadosComparativo('comparativoSemana');
  const tipos = valoresSelecionadosComparativo('comparativoCura');
  const periodos = ['A', 'B'].filter(letra => document.getElementById(`comparativoPeriodo${letra}Ativo`)?.checked);
  const variantesCura = tipos.length ? tipos : ['todas'];

  ids.forEach(id => {
    const lote = historico.find(item => item.id === id);
    if (!lote) return;
    grupos.push({
      chave: `lote-${lote.id}`,
      rotulo: `Lote ${lote.lote}`,
      detalhe: `${U.dataBR(lote.data)} · ${lote.curaTermica ? 'cura térmica' : 'cura normal'}`,
      lotes: [lote],
    });
  });

  semanas.forEach(chave => {
    const semana = semanaIso(historico.find(lote => semanaIso(lote.data)?.chave === chave)?.data);
    variantesCura.forEach(tipo => {
      const lotes = historico.filter(lote => semanaIso(lote.data)?.chave === chave && lotePertenceCuraPersonalizada(lote, tipo));
      const sufixo = rotuloCuraPersonalizada(tipo);
      grupos.push({
        chave: `semana-${chave}-${tipo}`,
        rotulo: `${semana ? `Sem. ${semana.semana}/${semana.ano}` : chave}${sufixo ? ` · ${sufixo}` : ''}`,
        detalhe: `${lotes.length} lote(s) · ${chave}`,
        lotes,
      });
    });
  });

  periodos.forEach(letra => {
    const inicio = valorCampoPersonalizado(`comparativoPeriodo${letra}Ini`);
    const fim = valorCampoPersonalizado(`comparativoPeriodo${letra}Fim`);
    validarIntervaloPersonalizado(inicio, fim, `período ${letra}`);
    variantesCura.forEach(tipo => {
      const lotes = historico.filter(lote => lote.data >= inicio && lote.data <= fim && lotePertenceCuraPersonalizada(lote, tipo));
      const sufixo = rotuloCuraPersonalizada(tipo);
      grupos.push({
        chave: `periodo-${letra.toLowerCase()}-${tipo}`,
        rotulo: `Período ${letra}${sufixo ? ` · ${sufixo}` : ''}`,
        detalhe: `${lotes.length} lote(s) · ${U.dataBR(inicio)} a ${U.dataBR(fim)}`,
        lotes,
      });
    });
  });

  if (tipos.length && !semanas.length && !periodos.length) {
    tipos.forEach(tipo => {
      const lotes = historico.filter(lote => lotePertenceCuraPersonalizada(lote, tipo));
      grupos.push({
        chave: `cura-${tipo}`,
        rotulo: rotuloCuraPersonalizada(tipo, true),
        detalhe: `${lotes.length} lote(s) · histórico completo`,
        lotes,
      });
    });
  }

  return grupos;
}

function lotePertenceCuraPersonalizada(lote, tipo) {
  if (tipo === 'termica') return lote.curaTermica === true;
  if (tipo === 'normal') return lote.curaTermica === false;
  return true;
}

function rotuloCuraPersonalizada(tipo, completo = false) {
  if (tipo === 'termica') return completo ? 'Cura térmica' : 'Térmica';
  if (tipo === 'normal') return completo ? 'Cura normal' : 'Normal';
  return '';
}

function montarGruposComparativoPersonalizado() {
  const historico = historicoCompletoComparativo();
  const incluirHistorico = document.getElementById('comparativoIncluirHistorico')?.checked === true;
  const grupos = gruposBaseComparativoPersonalizado(historico);

  if (!grupos.length) throw new Error('Selecione pelo menos um item para comparar.');
  if (grupos.length > 12) {
    throw new Error(`A combinação gerou ${grupos.length} linhas. Reduza a seleção para no máximo 12 combinações por vez.`);
  }
  if (!grupos.some(grupo => grupo.lotes.length)) throw new Error('Os critérios selecionados não possuem lotes no histórico.');
  if (grupos.length + (incluirHistorico ? 1 : 0) < 2) {
    throw new Error('Escolha ao menos dois itens ou inclua a média histórica para fazer a comparação.');
  }

  if (incluirHistorico) {
    grupos.push({
      chave: 'historico-completo',
      rotulo: 'Média histórica completa',
      detalhe: `${historico.length} lote(s) · sem considerar os filtros da tela`,
      lotes: historico,
      historico: true,
    });
  }
  return grupos;
}

function resumoMetricaPersonalizado(lotes, metrica) {
  const cp1 = lotes.map(lote => lote[metrica].cp1).filter(valor => valor != null);
  const cp2 = lotes.map(lote => lote[metrica].cp2).filter(valor => valor != null);
  return {
    cp1: mediaLista(cp1),
    cp2: mediaLista(cp2),
    media: mediaLista([...cp1, ...cp2]),
    quantidade: cp1.length + cp2.length,
  };
}

function resumirGrupoPersonalizado(grupo) {
  return {
    ...grupo,
    quantidadeLotes: grupo.lotes.length,
    comp14: resumoMetricaPersonalizado(grupo.lotes, 'comp14'),
    comp28: resumoMetricaPersonalizado(grupo.lotes, 'comp28'),
    tracao14: resumoMetricaPersonalizado(grupo.lotes, 'tracao14'),
    tracao28: resumoMetricaPersonalizado(grupo.lotes, 'tracao28'),
  };
}

function celulaMetricaPersonalizada(metrica) {
  if (!metrica.quantidade) return '—';
  return `<span class="comparativo-personalizado-par">
    <span><i>CP1</i><b>${fmtCp(metrica.cp1)}</b></span>
    <span><i>CP2</i><b>${fmtCp(metrica.cp2)}</b></span>
    <span><i>MÉDIA</i><b>${fmtCp(metrica.media)}</b></span>
  </span>`;
}

function renderTabelaComparativoPersonalizado(resumos) {
  const alvo = document.getElementById('tabelaComparativoPersonalizado');
  if (!alvo) return;
  alvo.innerHTML = `<div class="tabela-wrap"><table class="tabela">
    <thead><tr>
      <th>Comparado</th><th>Lotes</th><th>Compressão 14d (MPa)</th><th>Compressão 28d (MPa)</th><th>Tração 14d (MPa)</th><th>Tração 28d (MPa)</th>
    </tr></thead>
    <tbody>${resumos.map(grupo => `<tr class="${grupo.historico ? 'historico' : ''}">
      <td class="comparativo-personalizado-nome"><strong>${U.esc(grupo.rotulo)}</strong><small>${U.esc(grupo.detalhe)}</small></td>
      <td>${grupo.quantidadeLotes}</td>
      <td>${celulaMetricaPersonalizada(grupo.comp14)}</td>
      <td>${celulaMetricaPersonalizada(grupo.comp28)}</td>
      <td>${celulaMetricaPersonalizada(grupo.tracao14)}</td>
      <td>${celulaMetricaPersonalizada(grupo.tracao28)}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

function opcoesGraficoPersonalizado() {
  const corTexto = App.cssVar('--cinza-texto', '#5a6b7b');
  const corGrid = App.cssVar('--cinza-borda', '#e2e8f0');
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'nearest', intersect: false },
    layout: { padding: { top: 5, right: 8, bottom: 3, left: 5 } },
    plugins: {
      legend: { position: 'top', maxHeight: 54, labels: { color: corTexto, usePointStyle: true, padding: 8, boxWidth: 8, font: { size: 9 } } },
      tooltip: {
        backgroundColor: App.cssVar('--azul-escuro', '#003567'),
        padding: 10,
        cornerRadius: 8,
        callbacks: { label: contexto => `${contexto.dataset.label}: ${fmtCp(contexto.parsed.y)} MPa` },
      },
    },
    scales: {
      x: { ticks: { color: corTexto, font: { weight: '700' } }, grid: { display: false } },
      y: { beginAtZero: false, title: { display: true, text: 'MPa', color: corTexto }, ticks: { color: corTexto }, grid: { color: corGrid } },
    },
  };
}

function desenharGraficosPersonalizados(resumos) {
  destruirGraficosPersonalizados();
  const escuro = document.body.dataset.tema === 'escuro';
  const cores = escuro
    ? ['#54c7ff', '#7fe06c', '#ffd84f', '#ff8a8a', '#d79cff', '#ffffff', '#ffad66', '#55e6d1', '#a6b8ff', '#f58bd3', '#c5ef73', '#8fd3ff']
    : ['#0879c9', '#15946f', '#d28b00', '#c74242', '#8146b8', '#28506f', '#e36d1d', '#008a87', '#5867c7', '#b63c87', '#668b19', '#0097c6'];
  const estilosPonto = ['circle', 'triangle', 'rect', 'rectRot', 'star', 'crossRot'];
  const datasets = metrica14 => resumos.map((grupo, indice) => {
    const metrica28 = metrica14 === 'comp14' ? 'comp28' : 'tracao28';
    const cor = grupo.historico ? (escuro ? '#7fe06c' : '#00886a') : cores[indice % cores.length];
    return {
      type: 'line',
      label: grupo.rotulo,
      data: [grupo[metrica14].media, grupo[metrica28].media],
      borderColor: cor,
      backgroundColor: cor,
      borderWidth: grupo.historico ? 3.2 : 2.5,
      borderDash: grupo.historico ? [10, 6] : [],
      tension: 0.15,
      spanGaps: true,
      pointRadius: grupo.historico ? 5 : 4.2,
      pointHoverRadius: 7,
      pointStyle: grupo.historico ? 'rectRot' : estilosPonto[indice % estilosPonto.length],
    };
  });

  CCT.personalizadoCharts.compressao = new Chart(document.getElementById('chartPersonalizadoCompressao'), {
    data: { labels: ['14 dias', '28 dias'], datasets: datasets('comp14') },
    options: opcoesGraficoPersonalizado(),
  });
  CCT.personalizadoCharts.tracao = new Chart(document.getElementById('chartPersonalizadoTracao'), {
    data: { labels: ['14 dias', '28 dias'], datasets: datasets('tracao14') },
    options: opcoesGraficoPersonalizado(),
  });
}

function gerarComparativoPersonalizado() {
  try {
    const resumos = montarGruposComparativoPersonalizado().map(resumirGrupoPersonalizado);
    const vazio = document.getElementById('comparativoPersonalizadoVazio');
    const conteudo = document.getElementById('comparativoPersonalizadoConteudo');
    const resumo = document.getElementById('comparativoPersonalizadoResumo');
    const comHistorico = resumos.some(grupo => grupo.historico);
    const qtdLotes = valoresSelecionadosComparativo('comparativoLote').length;
    const qtdSemanas = valoresSelecionadosComparativo('comparativoSemana').length;
    const qtdPeriodos = ['A', 'B'].filter(letra => document.getElementById(`comparativoPeriodo${letra}Ativo`)?.checked).length;
    const curas = valoresSelecionadosComparativo('comparativoCura').map(tipo => rotuloCuraPersonalizada(tipo, true));
    if (resumo) resumo.innerHTML = `
      <span>Critérios combinados</span>
      <span>${resumos.length - (comHistorico ? 1 : 0)} linha(s) comparadas</span>
      <span>${qtdLotes} lote(s) · ${qtdSemanas} semana(s) · ${qtdPeriodos} período(s)</span>
      <span>Curas: ${curas.length ? curas.join(' + ') : 'reunidas'}</span>
      <span>Média histórica: ${comHistorico ? 'incluída' : 'não incluída'}</span>
      <span>Gráficos: média de CP1 + CP2</span>`;
    renderTabelaComparativoPersonalizado(resumos);
    CCT.personalizadoResumos = resumos;
    atualizarBotaoExportacaoComparativoPersonalizado();
    if (vazio) vazio.hidden = true;
    if (conteudo) conteudo.hidden = false;
    requestAnimationFrame(() => desenharGraficosPersonalizados(resumos));
  } catch (erro) {
    App.toast(erro?.message || 'Não foi possível gerar o comparativo.', 'aviso');
  }
}

function textoMetricaComparativoPDF(metrica) {
  if (!metrica?.quantidade) return '-';
  return `CP1 ${fmtCp(metrica.cp1)} | CP2 ${fmtCp(metrica.cp2)} | Média ${fmtCp(metrica.media)}`;
}

function filtrosComparativoPersonalizadoPDF() {
  const historico = historicoCompletoComparativo();
  const lotes = valoresSelecionadosComparativo('comparativoLote')
    .map(id => historico.find(lote => lote.id === id)?.lote)
    .filter(Boolean);
  const semanas = valoresSelecionadosComparativo('comparativoSemana');
  const periodos = ['A', 'B'].filter(letra => document.getElementById(`comparativoPeriodo${letra}Ativo`)?.checked).map(letra => {
    const inicio = valorCampoPersonalizado(`comparativoPeriodo${letra}Ini`);
    const fim = valorCampoPersonalizado(`comparativoPeriodo${letra}Fim`);
    return `${letra}: ${U.dataBR(inicio)} a ${U.dataBR(fim)}`;
  });
  const curas = valoresSelecionadosComparativo('comparativoCura').map(tipo => rotuloCuraPersonalizada(tipo, true));
  const historica = document.getElementById('comparativoIncluirHistorico')?.checked ? 'Incluída' : 'Não incluída';
  return [
    { campo: 'Lotes escolhidos', valor: lotes.length ? lotes.join(', ') : 'Nenhum' },
    { campo: 'Semanas escolhidas', valor: semanas.length ? semanas.join(', ') : 'Nenhuma' },
    { campo: 'Períodos escolhidos', valor: periodos.length ? periodos.join(' | ') : 'Nenhum' },
    { campo: 'Tipos de cura', valor: curas.length ? curas.join(' + ') : 'Curas reunidas' },
    { campo: 'Média histórica', valor: historica },
  ];
}

function aguardarGraficosComparativoPersonalizado() {
  return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

function imagemCanvasComFundoBranco(canvas) {
  if (!canvas) return '';
  const copia = document.createElement('canvas');
  copia.width = canvas.width;
  copia.height = canvas.height;
  const contexto = copia.getContext('2d');
  contexto.fillStyle = '#ffffff';
  contexto.fillRect(0, 0, copia.width, copia.height);
  contexto.drawImage(canvas, 0, 0);
  return copia.toDataURL('image/png');
}

async function graficosComparativoPersonalizadoPDF(resumos) {
  const temaOriginal = document.body.dataset.tema || 'claro';
  const precisaRestaurar = temaOriginal === 'escuro';
  if (precisaRestaurar) document.body.dataset.tema = 'claro';
  try {
    desenharGraficosPersonalizados(resumos);
    Object.values(CCT.personalizadoCharts).forEach(grafico => {
      grafico?.stop?.();
      grafico?.update?.('none');
    });
    await aguardarGraficosComparativoPersonalizado();
    const canvasComp = document.getElementById('chartPersonalizadoCompressao');
    const canvasTracao = document.getElementById('chartPersonalizadoTracao');
    return [
      {
        titulo: 'Compressão axial - evolução média entre 14 e 28 dias',
        imagem: imagemCanvasComFundoBranco(canvasComp),
        largura: canvasComp?.width,
        altura: canvasComp?.height,
      },
      {
        titulo: 'Tração - evolução média entre 14 e 28 dias',
        imagem: imagemCanvasComFundoBranco(canvasTracao),
        largura: canvasTracao?.width,
        altura: canvasTracao?.height,
      },
    ];
  } finally {
    if (precisaRestaurar) {
      document.body.dataset.tema = temaOriginal;
      desenharGraficosPersonalizados(resumos);
      await aguardarGraficosComparativoPersonalizado();
    }
  }
}

async function exportarComparativoPersonalizadoPDF() {
  if (!CCT.personalizadoResumos.length) {
    App.toast('Gere o comparativo antes de exportar o PDF.', 'aviso');
    return;
  }
  if (!window.Exportacoes?.exportarRelatorioPDF) {
    App.toast('O recurso de exportação para PDF não está disponível.', 'erro');
    return;
  }

  atualizarBotaoExportacaoComparativoPersonalizado(true);
  try {
    const resumos = CCT.personalizadoResumos;
    const graficos = await graficosComparativoPersonalizadoPDF(resumos);
    await Exportacoes.exportarRelatorioPDF({
      titulo: 'Comparativo Personalizado - Cura Ferro Norte',
      nomeArquivo: 'comparativo-personalizado-cura-ferro-norte',
      filtros: filtrosComparativoPersonalizadoPDF(),
      tituloGraficos: 'Gráficos da comparação personalizada',
      layoutGraficosPDF: 'grade-antes-tabela',
      secoes: [{
        titulo: 'Valores comparados de compressão axial e tração',
        columns: [
          { key: 'comparado', label: 'Comparado' },
          { key: 'lotes', label: 'Lotes' },
          { key: 'comp14', label: 'Compressão 14d (MPa)' },
          { key: 'comp28', label: 'Compressão 28d (MPa)' },
          { key: 'tracao14', label: 'Tração 14d (MPa)' },
          { key: 'tracao28', label: 'Tração 28d (MPa)' },
        ],
        rows: resumos.map(grupo => ({
          comparado: `${grupo.rotulo} - ${grupo.detalhe}`,
          lotes: grupo.quantidadeLotes,
          comp14: textoMetricaComparativoPDF(grupo.comp14),
          comp28: textoMetricaComparativoPDF(grupo.comp28),
          tracao14: textoMetricaComparativoPDF(grupo.tracao14),
          tracao28: textoMetricaComparativoPDF(grupo.tracao28),
        })),
      }],
      graficos,
      observacao: 'Fonte: Supabase. PDF gerado com os critérios combinados escolhidos no Comparativo Personalizado. Os gráficos usam a média dos valores disponíveis de CP1 e CP2.',
    });
  } catch (erro) {
    console.error('Erro ao exportar comparativo personalizado', erro);
    App.toast(erro?.message || 'Não foi possível gerar o PDF do comparativo.', 'erro');
  } finally {
    atualizarBotaoExportacaoComparativoPersonalizado(false);
  }
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
window.abrirComparativoPersonalizado = abrirComparativoPersonalizado;
window.fecharComparativoPersonalizado = fecharComparativoPersonalizado;
