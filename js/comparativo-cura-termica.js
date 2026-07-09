/* =====================================================================
   COMPARATIVO-CURA-TERMICA.JS — Ferro Norte · CPs 14 × 28 dias
   Compara compressão axial e tração dos corpos de prova dos lotes de
   cura térmica: acompanhamento (14 dias) × liberação (28 dias).
   Fonte: producao_lotes (comp_14/tracao_14/comp_28/tracao_28 + CP2).
   ===================================================================== */
let CCT_CHARTS = {};
const CCT = { prod: [], carregando: true, erro: '' };

document.addEventListener('DOMContentLoaded', async () => {
  if (!await Auth.exigirLogin()) return;
  App.montarLayout('comparativoCuraTermica', 'Comparativo Cura Térmica', 'Ferro Norte · compressão axial e tração dos CPs — 14 × 28 dias');
  App.acoesTopo(`<button class="btn btn-primario" onclick="carregarComparativoCuraTermica()">${ICN.filtro}Atualizar</button>`);

  document.getElementById('fFornecedor').innerHTML = U.opcoes(CFG.listas.fornecedores, '', 'Todas');
  let buscaTimer = null;
  document.getElementById('busca')?.addEventListener('input', () => {
    clearTimeout(buscaTimer);
    buscaTimer = setTimeout(renderComparativo, 200);
  });
  ['fFornecedor', 'fPeriodoIni', 'fPeriodoFim'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', renderComparativo);
  });

  App.aplicarPadraoGraficos();
  renderComparativo();
  await carregarComparativoCuraTermica();
});

async function carregarComparativoCuraTermica() {
  CCT.carregando = true;
  CCT.erro = '';
  renderComparativo();
  try {
    const producao = await StoreSupabase.listarProducao({ limite: 10000 });
    CCT.prod = (producao || []).filter(r =>
      !!(r.cura_termica) && FluxoLiberacao.projetoCanonico(r) === 'FERRO NORTE');
    CCT.carregando = false;
    renderComparativo();
  } catch (err) {
    console.error('Erro ao carregar comparativo de cura térmica', err);
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

function mediaCp(cp1, cp2) {
  const vals = [numCp(cp1), numCp(cp2)].filter(v => v != null);
  if (!vals.length) return null;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

function fmtCp(v, casas = 1) {
  return v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

function detalheCp(cp1, cp2) {
  const a = String(cp1 == null ? '' : cp1).trim();
  const b = String(cp2 == null ? '' : cp2).trim();
  if (!a && !b) return '';
  return b ? `CP1 ${a || '—'} · CP2 ${b}` : `CP1 ${a}`;
}

function lotesComparativo() {
  const busca = document.getElementById('busca')?.value.toLowerCase().trim() || '';
  const fornecedor = document.getElementById('fFornecedor')?.value || '';
  const ini = document.getElementById('fPeriodoIni')?.value || '';
  const fim = document.getElementById('fPeriodoFim')?.value || '';

  return CCT.prod
    .filter(r => {
      const data = String(r.data_fabricacao || '').slice(0, 10);
      if (fornecedor && r.fornecedor !== fornecedor) return false;
      if (ini && (!data || data < ini)) return false;
      if (fim && (!data || data > fim)) return false;
      if (busca && !String(r.lote || '').toLowerCase().includes(busca)) return false;
      return true;
    })
    .map(r => ({
      lote: String(r.lote || '—'),
      data: String(r.data_fabricacao || '').slice(0, 10),
      fornecedor: r.fornecedor || '',
      comp14: mediaCp(r.comp_14, r.comp_14_cp2),
      tracao14: mediaCp(r.tracao_14, r.tracao_14_cp2),
      comp28: mediaCp(r.comp_28, r.comp_28_cp2),
      tracao28: mediaCp(r.tracao_28, r.tracao_28_cp2),
      detComp14: detalheCp(r.comp_14, r.comp_14_cp2),
      detTracao14: detalheCp(r.tracao_14, r.tracao_14_cp2),
      detComp28: detalheCp(r.comp_28, r.comp_28_cp2),
      detTracao28: detalheCp(r.tracao_28, r.tracao_28_cp2),
    }))
    .filter(l => l.comp14 != null || l.tracao14 != null || l.comp28 != null || l.tracao28 != null)
    .sort((a, b) => a.data.localeCompare(b.data)
      || String(a.lote).localeCompare(String(b.lote), 'pt-BR', { numeric: true }));
}

function renderComparativo() {
  const kpis = document.getElementById('kpisComparativo');
  const tabela = document.getElementById('tabelaComparativo');
  if (!kpis || !tabela) return;

  if (CCT.carregando) {
    kpis.innerHTML = `<div class="kpi escuro"><div class="rotulo">Comparativo</div><div class="valor">...</div><div class="extra">Carregando lotes de cura térmica</div></div>`;
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

function ganhoPct(v14, v28) {
  if (v14 == null || v28 == null || v14 === 0) return null;
  return ((v28 - v14) / v14) * 100;
}

function renderKpisComparativo(lotes) {
  const mComp14 = mediaLista(lotes.map(l => l.comp14));
  const mComp28 = mediaLista(lotes.map(l => l.comp28));
  const mTracao14 = mediaLista(lotes.map(l => l.tracao14));
  const mTracao28 = mediaLista(lotes.map(l => l.tracao28));
  const completos = lotes.filter(l => l.comp14 != null && l.comp28 != null).length;
  const gComp = ganhoPct(mComp14, mComp28);
  const gTracao = ganhoPct(mTracao14, mTracao28);

  document.getElementById('kpisComparativo').innerHTML = `
    <div class="kpi escuro"><div class="rotulo">Lotes cura térmica FN</div><div class="valor">${lotes.length}</div><div class="extra">${completos} com CPs de 14 e 28 dias</div></div>
    <div class="kpi"><div class="rotulo">Compressão média 14d</div><div class="valor">${fmtCp(mComp14)}</div><div class="extra">MPa · média dos CPs</div></div>
    <div class="kpi verde"><div class="rotulo">Compressão média 28d</div><div class="valor">${fmtCp(mComp28)}</div><div class="extra">${gComp == null ? 'sem base de comparação' : `ganho de ${fmtCp(gComp)}% sobre 14d`}</div></div>
    <div class="kpi"><div class="rotulo">Tração média 14d</div><div class="valor">${fmtCp(mTracao14)}</div><div class="extra">MPa · média dos CPs</div></div>
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
      legend: { position: 'top', labels: { color: corTexto, usePointStyle: true, padding: 14, font: { size: 12 } } },
      tooltip: {
        backgroundColor: App.cssVar('--azul-escuro', '#003567'), padding: 10, cornerRadius: 8, titleFont: { weight: '700' },
        callbacks: {
          afterLabel: ctx => {
            const det = ctx.dataset.detalhes?.[ctx.dataIndex];
            return det ? `(${det})` : '';
          }
        }
      },
    },
    scales: {
      x: { ticks: { color: corTexto, maxRotation: 60, minRotation: 0, autoSkip: true }, grid: { display: false } },
      y: { position: 'left', title: { display: true, text: tituloY, color: corTexto }, ticks: { color: corTexto }, grid: { color: corGrid } },
      y1: { position: 'right', title: { display: true, text: tituloY1, color: corTexto }, ticks: { color: corTexto }, grid: { drawOnChartArea: false } },
    },
  };
}

function dsLinha({ label, data, detalhes, cor, eixo, tracejada }) {
  return {
    type: 'line',
    label,
    data,
    detalhes,
    borderColor: cor,
    backgroundColor: cor,
    borderWidth: 2.5,
    borderDash: tracejada ? [7, 5] : [],
    tension: 0.25,
    spanGaps: true,
    pointRadius: 3.5,
    pointBackgroundColor: cor,
    yAxisID: eixo,
  };
}

function desenharGraficosComparativo(lotes) {
  destruirGraficosComparativo();
  const C = App.coresGrafico();
  const labels = lotes.map(l => l.lote);
  const corComp14 = C.azulClaro || '#32A6E6';
  const corComp28 = C.azulEscuro || '#003567';
  const corTracao14 = C.amarelo || '#FFD401';
  const corTracao28 = C.erro || '#c0392b';

  if (!lotes.length) return;

  CCT_CHARTS.c14 = new Chart(document.getElementById('chart14'), {
    data: {
      labels,
      datasets: [
        dsLinha({ label: 'Compressão axial 14d', data: lotes.map(l => l.comp14), detalhes: lotes.map(l => l.detComp14), cor: corComp14, eixo: 'y' }),
        dsLinha({ label: 'Tração 14d', data: lotes.map(l => l.tracao14), detalhes: lotes.map(l => l.detTracao14), cor: corTracao14, eixo: 'y1' }),
      ],
    },
    options: opcoesEixoDuplo('Compressão (MPa)', 'Tração (MPa)'),
  });

  CCT_CHARTS.c28 = new Chart(document.getElementById('chart28'), {
    data: {
      labels,
      datasets: [
        dsLinha({ label: 'Compressão axial 28d', data: lotes.map(l => l.comp28), detalhes: lotes.map(l => l.detComp28), cor: corComp28, eixo: 'y' }),
        dsLinha({ label: 'Tração 28d', data: lotes.map(l => l.tracao28), detalhes: lotes.map(l => l.detTracao28), cor: corTracao28, eixo: 'y1' }),
      ],
    },
    options: opcoesEixoDuplo('Compressão (MPa)', 'Tração (MPa)'),
  });

  CCT_CHARTS.comp = new Chart(document.getElementById('chartComparativo'), {
    data: {
      labels,
      datasets: [
        dsLinha({ label: 'Compressão 14d', data: lotes.map(l => l.comp14), detalhes: lotes.map(l => l.detComp14), cor: corComp14, eixo: 'y', tracejada: true }),
        dsLinha({ label: 'Compressão 28d', data: lotes.map(l => l.comp28), detalhes: lotes.map(l => l.detComp28), cor: corComp28, eixo: 'y' }),
        dsLinha({ label: 'Tração 14d', data: lotes.map(l => l.tracao14), detalhes: lotes.map(l => l.detTracao14), cor: corTracao14, eixo: 'y1', tracejada: true }),
        dsLinha({ label: 'Tração 28d', data: lotes.map(l => l.tracao28), detalhes: lotes.map(l => l.detTracao28), cor: corTracao28, eixo: 'y1' }),
      ],
    },
    options: opcoesEixoDuplo('Compressão (MPa)', 'Tração (MPa)'),
  });
}

function renderTabelaComparativo(lotes) {
  const alvo = document.getElementById('tabelaComparativo');
  if (!lotes.length) {
    alvo.innerHTML = `<div class="vazio">${ICN.vazioBox}<h3>Nenhum lote encontrado</h3><p>Não há lotes de cura térmica do Ferro Norte com CPs lançados para os filtros atuais. Confira a marcação "Cura Térmica" e as resistências na Produção.</p></div>`;
    return;
  }
  const linha = l => {
    const gc = ganhoPct(l.comp14, l.comp28);
    const gt = ganhoPct(l.tracao14, l.tracao28);
    const badge = v => v == null ? '—' : `<span class="badge ${v >= 0 ? 'badge-ok' : 'badge-reprovado'}">${v >= 0 ? '+' : ''}${fmtCp(v)}%</span>`;
    return `<tr>
      <td><strong>${U.esc(l.lote)}</strong></td>
      <td>${U.dataBR(l.data)}</td>
      <td>${U.esc(l.fornecedor || '—')}</td>
      <td class="right" title="${U.esc(l.detComp14)}">${fmtCp(l.comp14)}</td>
      <td class="right" title="${U.esc(l.detComp28)}">${fmtCp(l.comp28)}</td>
      <td class="right">${badge(gc)}</td>
      <td class="right" title="${U.esc(l.detTracao14)}">${fmtCp(l.tracao14)}</td>
      <td class="right" title="${U.esc(l.detTracao28)}">${fmtCp(l.tracao28)}</td>
      <td class="right">${badge(gt)}</td>
    </tr>`;
  };
  alvo.innerHTML = `<div class="tabela-wrap"><table class="tabela">
    <thead><tr>
      <th>Lote</th><th>Fabricação</th><th>Fábrica</th>
      <th class="right">Comp. 14d</th><th class="right">Comp. 28d</th><th class="right">Ganho comp.</th>
      <th class="right">Tração 14d</th><th class="right">Tração 28d</th><th class="right">Ganho tração</th>
    </tr></thead>
    <tbody>${lotes.map(linha).join('')}</tbody>
  </table></div>`;
}

function registrarExportacaoComparativo(lotes) {
  if (!window.Exportacoes) return;
  Exportacoes.registrar({
    titulo: 'Comparativo Cura Térmica — Ferro Norte (14 × 28 dias)',
    nomeArquivo: 'comparativo-cura-termica-fn',
    filtros: Exportacoes.filtrosDaTela(),
    secoes: [{
      titulo: 'Lotes de cura térmica FN — CPs 14 × 28 dias',
      columns: [
        { key: 'lote', label: 'Lote' },
        { key: 'dataExport', label: 'Fabricação' },
        { key: 'fornecedor', label: 'Fábrica' },
        { key: 'comp14Export', label: 'Compressão 14d (MPa)' },
        { key: 'comp28Export', label: 'Compressão 28d (MPa)' },
        { key: 'ganhoCompExport', label: 'Ganho compressão (%)' },
        { key: 'tracao14Export', label: 'Tração 14d (MPa)' },
        { key: 'tracao28Export', label: 'Tração 28d (MPa)' },
        { key: 'ganhoTracaoExport', label: 'Ganho tração (%)' },
        { key: 'detComp14', label: 'CPs comp. 14d' },
        { key: 'detComp28', label: 'CPs comp. 28d' },
        { key: 'detTracao14', label: 'CPs tração 14d' },
        { key: 'detTracao28', label: 'CPs tração 28d' },
      ],
      rows: lotes.map(l => ({
        ...l,
        dataExport: U.dataBR(l.data),
        comp14Export: fmtCp(l.comp14),
        comp28Export: fmtCp(l.comp28),
        ganhoCompExport: fmtCp(ganhoPct(l.comp14, l.comp28)),
        tracao14Export: fmtCp(l.tracao14),
        tracao28Export: fmtCp(l.tracao28),
        ganhoTracaoExport: fmtCp(ganhoPct(l.tracao14, l.tracao28)),
      })),
    }],
    graficos: [
      { titulo: 'Acompanhamento 14 dias — Compressão × Tração', canvasId: 'chart14' },
      { titulo: 'Liberação 28 dias — Compressão × Tração', canvasId: 'chart28' },
      { titulo: 'Comparativo 14 × 28 dias', canvasId: 'chartComparativo' },
    ],
  });
}

window.render = renderComparativo;
window.carregarComparativoCuraTermica = carregarComparativoCuraTermica;
