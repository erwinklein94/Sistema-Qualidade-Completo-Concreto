/* =====================================================================
   FLUXO-LIBERACAO.JS — Painel de séries por projeto/fábrica/série
   ===================================================================== */
let FLUXO_PRODUCAO = [];
let FLUXO_ENSAIOS = [];
let FLUXO_DADOS = { series: [] };
let FLUXO_CARREGANDO = false;
let FLUXO_ERRO = '';
let FICHA_LOTE_ATUAL = null;
let EDICAO_SERIE = null; // { chave, removidos:Set, adicionados:Set, salvando }
const FICHA_VINCULOS_CACHE = new Map();
const ICONE_EDITAR_LOTES = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';

const STATUS_FILTRO_FLUXO = [
  { valor: '', texto: 'Todos' },
  { valor: 'formando', texto: 'Série em formação' },
  { valor: 'cura14', texto: 'Em cura 14 dias' },
  { valor: 'aguardando14', texto: 'Aguardando ensaio 14 dias' },
  { valor: 'cura28', texto: 'Em cura 28 dias' },
  { valor: 'aguardando28', texto: 'Aguardando ensaio 28 dias' },
  { valor: 'reteste28', texto: 'Aguardando contraensaios 28 dias' },
  { valor: 'pendente', texto: 'Pendente de resultado' },
  { valor: 'travado', texto: 'Travado' },
  { valor: 'liberado', texto: 'Liberado para transporte' },
];

document.addEventListener('DOMContentLoaded', async () => {
  if (!await Auth.exigirLogin()) return;
  App.montarLayout('fluxoLiberacao', 'Painel de séries', 'Rastreabilidade automática por fábrica, projeto, série, lote e ensaio');
  App.acoesTopo(`
    <button class="btn btn-secundario" onclick="location.href='producao.html'">${ICN.producao}Produção</button>
    <button class="btn btn-secundario" onclick="location.href='ensaios-liberacao.html'">${ICN.check}Ensaios</button>
    <button class="btn btn-primario" onclick="carregarFluxoLiberacao()">${ICN.filtro}Atualizar painel</button>
  `);

  preencherFiltrosFluxo();
  let buscaTimer = null;
  document.getElementById('busca')?.addEventListener('input', () => {
    clearTimeout(buscaTimer);
    buscaTimer = setTimeout(renderFluxo, 200);
  });
  ['fFornecedor', 'fProjeto', 'fBitola', 'fStatusFluxo', 'fSomenteAlertas'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', renderFluxo);
  });

  renderFluxo();

  document.getElementById('modalFichaLote')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) fecharFichaLote();
  });
  document.getElementById('modalEditarLotes')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) cancelarEdicaoLotesSerie();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { fecharFichaLote(); cancelarEdicaoLotesSerie(); }
    if ((e.key === 'Enter' || e.key === ' ') && e.target?.classList?.contains('clicavel')) {
      e.preventDefault();
      e.target.click();
    }
  });

  await carregarFluxoLiberacao();
});

function preencherFiltrosFluxo() {
  document.getElementById('fFornecedor').innerHTML = U.opcoes(CFG.listas.fornecedores, '', 'Todas');
  document.getElementById('fProjeto').innerHTML = U.opcoes(CFG.listas.projetos, '', 'Todos');
  document.getElementById('fBitola').innerHTML = U.opcoes(CFG.listas.bitolas, '', 'Todas');
  document.getElementById('fStatusFluxo').innerHTML = STATUS_FILTRO_FLUXO.map(s => `<option value="${U.esc(s.valor)}">${U.esc(s.texto)}</option>`).join('');
}

async function carregarFluxoLiberacao() {
  FLUXO_CARREGANDO = true;
  FLUXO_ERRO = '';
  renderFluxo();
  try {
    await Auth.exigirLogin();
    const [producao, ensaios] = await Promise.all([
      StoreSupabase.listarProducao({ limite: 10000 }),
      StoreSupabase.listarEnsaiosLiberacao({ limite: 10000 }),
    ]);
    FLUXO_PRODUCAO = producao || [];
    FLUXO_ENSAIOS = ensaios || [];
    FLUXO_DADOS = FluxoLiberacao.calcular(FLUXO_PRODUCAO, FLUXO_ENSAIOS);
    FICHA_VINCULOS_CACHE.clear();
    FLUXO_CARREGANDO = false;
    renderFluxo();
  } catch (err) {
    console.error('Erro ao carregar Painel de séries', err);
    FLUXO_CARREGANDO = false;
    FLUXO_ERRO = mensagemErroBanco(err, 'Não foi possível carregar o Painel de séries do Supabase.');
    App.toast(FLUXO_ERRO, 'erro');
    renderFluxo();
  }
}

function filtrosFluxo() {
  return {
    busca: document.getElementById('busca')?.value.toLowerCase().trim() || '',
    fornecedor: document.getElementById('fFornecedor')?.value || '',
    projeto: document.getElementById('fProjeto')?.value || '',
    bitola: document.getElementById('fBitola')?.value || '',
    status: document.getElementById('fStatusFluxo')?.value || '',
    somenteAlertas: document.getElementById('fSomenteAlertas')?.checked || false,
  };
}

function seriesFiltradas() {
  const f = filtrosFluxo();
  return (FLUXO_DADOS.series || []).filter(s => {
    if (f.fornecedor && s.fornecedor !== f.fornecedor) return false;
    if (f.projeto && s.projeto !== f.projeto) return false;
    if (f.bitola && s.bitola !== f.bitola) return false;
    if (f.status && s.statusChave !== f.status) return false;
    if (f.somenteAlertas && !['aguardando14', 'aguardando28', 'reteste28', 'travado', 'pendente'].includes(s.statusChave)) return false;
    if (f.busca) {
      const blob = `${s.fornecedor} ${s.projeto} ${s.bitola} ${s.serie} ${s.status} ${s.proximaAcao} ${s.lotesTexto} ${s.ensaios.map(e => `${e.lote} ${e.resultado}`).join(' ')}`.toLowerCase();
      if (!blob.includes(f.busca)) return false;
    }
    return true;
  });
}

function renderFluxo() {
  if (FLUXO_CARREGANDO) {
    setHtml('kpisFluxo', `<div class="kpi escuro"><div class="rotulo">Fluxo</div><div class="valor">...</div><div class="extra">Carregando produção e ensaios</div></div>`);
    setHtml('cardsFluxo', `<div class="vazio">${ICN.vazioBox}<h3>Carregando fluxo</h3><p>Buscando dados no Supabase.</p></div>`);
    setHtml('mapaProjetosSeries', `<div class="vazio">${ICN.vazioBox}<h3>Carregando mapa por projeto</h3><p>Organizando séries e lotes já registrados.</p></div>`);
    setHtml('tabelaFluxo', '');
    setText('contadorFluxo', 'Carregando...');
    return;
  }

  if (FLUXO_ERRO) {
    setHtml('kpisFluxo', `<div class="kpi vermelho"><div class="rotulo">Erro</div><div class="valor">!</div><div class="extra">${U.esc(FLUXO_ERRO)}</div></div>`);
    setHtml('cardsFluxo', `<div class="vazio">${ICN.alerta}<h3>Erro ao carregar</h3><p>${U.esc(FLUXO_ERRO)}</p><button class="btn btn-secundario" onclick="carregarFluxoLiberacao()">Tentar novamente</button></div>`);
    setHtml('mapaProjetosSeries', '');
    return;
  }

  const series = seriesFiltradas();
  const projetos = montarMapaProjetos(series, FLUXO_DADOS.series || []);
  registrarExportacaoFluxo(series, projetos);
  renderKpisFluxo(series);
  renderResumoRegra(series);
  renderMapaProjetos(projetos);
  renderCardsFluxo(series);
  renderTabelaFluxo(series);
  setText('contadorFluxo', `${series.length} de ${(FLUXO_DADOS.series || []).length} série(s)`);
}

function renderKpisFluxo(series) {
  const cont = contarStatus(series);
  const pecas = series.reduce((s, x) => s + x.total, 0);
  const lotes = series.reduce((s, x) => s + x.loteQtd, 0);
  setHtml('kpisFluxo', `
    <div class="kpi escuro"><div class="rotulo">Séries no recorte</div><div class="valor">${series.length}</div><div class="extra">${pecas.toLocaleString('pt-BR')} dormentes · ${lotes} lotes</div></div>
    <div class="kpi amarelo"><div class="rotulo">Aguardando 14d</div><div class="valor">${cont.aguardando14 || 0}</div><div class="extra">prontas para ensaio inicial</div></div>
    <div class="kpi amarelo"><div class="rotulo">Aguardando 28d / contraensaios</div><div class="valor">${(cont.aguardando28 || 0) + (cont.reteste28 || 0)}</div><div class="extra">vieram de reprova</div></div>
    <div class="kpi vermelho"><div class="rotulo">Travadas</div><div class="valor">${cont.travado || 0}</div><div class="extra">coordenação/especialistas</div></div>
    <div class="kpi verde"><div class="rotulo">Liberadas</div><div class="valor">${cont.liberado || 0}</div><div class="extra">aptas para transporte</div></div>
    <div class="kpi"><div class="rotulo">Em formação/cura</div><div class="valor">${(cont.formando || 0) + (cont.cura14 || 0) + (cont.cura28 || 0)}</div><div class="extra">sem ação imediata de ensaio</div></div>
  `);
}

function renderResumoRegra(series) {
  const alertas = series.filter(s => ['aguardando14', 'aguardando28', 'reteste28', 'travado', 'pendente'].includes(s.statusChave));
  const proximas = series.filter(s => s.statusChave === 'formando' && (s.total >= FluxoLiberacao.ALERTA_PECAS || s.loteQtd >= FluxoLiberacao.ALERTA_LOTES));
  setHtml('resumoFluxo', `
    <div class="fluxo-regra-card">
      <strong>Regra ativa</strong>
      <span>Série padrão por fábrica + projeto + bitola. Fecha ao atingir 2.000 dormentes ou 10 lotes. Exceções sob demanda continuam possíveis quando a série for informada manualmente no lote ou no ensaio.</span>
    </div>
    <div class="fluxo-regra-card alerta">
      <strong>Atenção operacional</strong>
      <span>${alertas.length} série(s) exigem ação agora e ${proximas.length} estão próximas do gatilho padrão.</span>
    </div>
  `);
}

function renderCardsFluxo(series) {
  const alvo = document.getElementById('cardsFluxo');
  if (!alvo) return;
  if (!series.length) {
    alvo.innerHTML = `<div class="vazio">${ICN.vazioBox}<h3>Nenhuma série encontrada</h3><p>Ajuste os filtros ou cadastre produção/ensaios.</p></div>`;
    return;
  }
  alvo.innerHTML = `<div class="fluxo-grid">${series.map(cardFluxo).join('')}</div>`;
}

function renderMapaProjetos(projetos) {
  const alvo = document.getElementById('mapaProjetosSeries');
  if (!alvo) return;
  if (!projetos.length) {
    alvo.innerHTML = `<div class="vazio">${ICN.vazioBox}<h3>Nenhum projeto encontrado</h3><p>Ajuste os filtros ou cadastre lotes de produção para visualizar a sequência das séries.</p></div>`;
    return;
  }
  alvo.innerHTML = `<div class="mapa-projetos-grid">${projetos.map(cardMapaProjeto).join('')}</div>`;
}

function montarMapaProjetos(series, todasSeries) {
  const numerosGlobais = new Map();
  (todasSeries || series || []).forEach(s => {
    const projeto = FluxoLiberacao.projetoCanonico ? FluxoLiberacao.projetoCanonico(s) : (s.projeto || 'Sem projeto');
    const codigo = FluxoLiberacao.codigoProjeto ? FluxoLiberacao.codigoProjeto(s) : codigoProjetoMapaLocal(projeto, s.bitola);
    const chaveProjeto = chaveTextoLocal(`${codigo}|||${projeto}`);
    const numero = numeroSerieLocal(s.serie);
    if (numero) numerosGlobais.set(chaveProjeto, Math.max(numerosGlobais.get(chaveProjeto) || 0, numero));
  });

  const mapa = new Map();
  (series || []).forEach(s => {
    const projeto = FluxoLiberacao.projetoCanonico ? FluxoLiberacao.projetoCanonico(s) : (s.projeto || 'Sem projeto');
    const codigo = FluxoLiberacao.codigoProjeto ? FluxoLiberacao.codigoProjeto(s) : codigoProjetoMapaLocal(projeto, s.bitola);
    const chaveProjeto = chaveTextoLocal(`${codigo}|||${projeto}`);
    if (!mapa.has(chaveProjeto)) {
      mapa.set(chaveProjeto, {
        projeto,
        codigo,
        chaveProjeto,
        series: new Map(),
        fornecedores: new Set(),
        bitolas: new Set(),
        numeros: [],
        total: 0,
        lotesTotal: 0,
      });
    }

    const projetoInfo = mapa.get(chaveProjeto);
    projetoInfo.fornecedores.add(s.fornecedor || 'Sem fábrica');
    projetoInfo.bitolas.add(s.bitola || 'Sem bitola');
    projetoInfo.total += Number(s.total || 0);
    projetoInfo.lotesTotal += Number(s.loteQtd || 0);

    const numero = numeroSerieLocal(s.serie);
    if (numero) projetoInfo.numeros.push(numero);

    const chaveSerie = chaveTextoLocal(s.serie || `serie-${projetoInfo.series.size + 1}`);
    if (!projetoInfo.series.has(chaveSerie)) {
      projetoInfo.series.set(chaveSerie, {
        serie: s.serie || 'Série sem nome',
        numero,
        subseries: [],
        lotes: [],
        total: 0,
        fornecedores: new Set(),
        bitolas: new Set(),
        origens: new Set(),
        statusChave: s.statusChave || 'formando',
        status: s.status || 'Série em formação',
      });
    }

    const serieInfo = projetoInfo.series.get(chaveSerie);
    serieInfo.subseries.push(s);
    serieInfo.total += Number(s.total || 0);
    serieInfo.fornecedores.add(s.fornecedor || 'Sem fábrica');
    serieInfo.bitolas.add(s.bitola || 'Sem bitola');
    serieInfo.origens.add(s.auto ? 'automática' : 'manual');
    const statusPrioritario = FluxoLiberacao.prioridadeStatus(s.statusChave) < FluxoLiberacao.prioridadeStatus(serieInfo.statusChave);
    if (statusPrioritario) {
      serieInfo.statusChave = s.statusChave || serieInfo.statusChave;
      serieInfo.status = s.status || serieInfo.status;
    }
    (s.lotes || []).forEach(lote => serieInfo.lotes.push({ ...lote, _serie: s }));
  });

  return Array.from(mapa.values()).map(p => {
    const numerosValidos = p.numeros.filter(n => Number.isFinite(n) && n > 0);
    const maiorVisivel = numerosValidos.length ? Math.max(...numerosValidos) : 0;
    p.ultimoNumero = Math.max(maiorVisivel, numerosGlobais.get(p.chaveProjeto) || 0);
    p.proximoNumero = p.ultimoNumero + 1 || 1;
    p.proximaSerie = nomeSerieSugeridaLocal(p.codigo, p.proximoNumero);
    p.seriesLista = Array.from(p.series.values()).map(serie => {
      serie.lotes.sort((a, b) => String(a.dataFabricacao || '').localeCompare(String(b.dataFabricacao || '')) || String(a.lote || '').localeCompare(String(b.lote || ''), 'pt-BR', { numeric: true }));
      serie.loteQtd = serie.lotes.length;
      return serie;
    }).sort((a, b) => (a.numero || 999999) - (b.numero || 999999) || String(a.serie).localeCompare(String(b.serie), 'pt-BR', { numeric: true }));
    return p;
  }).sort((a, b) => String(a.codigo).localeCompare(String(b.codigo), 'pt-BR', { numeric: true }) || String(a.projeto).localeCompare(String(b.projeto), 'pt-BR', { numeric: true }));
}

function cardMapaProjeto(p) {
  const ultimaSerie = p.ultimoNumero ? nomeSerieSugeridaLocal(p.codigo, p.ultimoNumero) : 'Nenhuma série numerada';
  const fornecedores = resumoListaLocal([...p.fornecedores]);
  const bitolas = resumoListaLocal([...p.bitolas]);
  return `<article class="mapa-projeto-card">
    <div class="mapa-projeto-topo">
      <div>
        <span class="mapa-projeto-codigo">${U.esc(p.codigo)}</span>
        <h3>${U.esc(p.projeto)}</h3>
        <p>${U.esc(fornecedores)} · ${U.esc(bitolas)}</p>
      </div>
      <div class="mapa-proxima-serie" title="Maior número de série encontrado neste projeto + 1">
        <span>Próxima série a abrir</span>
        <strong>${U.esc(p.proximaSerie)}</strong>
        <small>nº ${p.proximoNumero}</small>
      </div>
    </div>
    <div class="mapa-projeto-metricas">
      <div><span>Séries existentes</span><strong>${p.seriesLista.length}</strong></div>
      <div><span>Lotes no projeto</span><strong>${p.lotesTotal}</strong></div>
      <div><span>Dormentes</span><strong>${p.total.toLocaleString('pt-BR')}</strong></div>
      <div><span>Última encontrada</span><strong>${U.esc(ultimaSerie)}</strong></div>
    </div>
    <div class="mapa-series-lista">
      ${p.seriesLista.map(serie => itemMapaSerie(serie, p)).join('')}
    </div>
  </article>`;
}

function itemMapaSerie(serie, projetoInfo) {
  const isUltima = serie.numero && serie.numero === projetoInfo.ultimoNumero;
  const origem = resumoListaLocal([...serie.origens]);
  const bitolas = resumoListaLocal([...serie.bitolas]);
  const fornecedores = resumoListaLocal([...serie.fornecedores]);
  const aberta = isUltima ? ' open' : '';
  return `<details class="mapa-serie-item ${isUltima ? 'ultima' : ''}"${aberta}>
    <summary>
      <span class="mapa-serie-nome"><strong>${U.esc(serie.serie)}</strong><em>${serie.numero ? `nº ${serie.numero}` : 'sem número identificado'}</em></span>
      <span class="mapa-serie-meta">${serie.loteQtd} lote(s) · ${serie.total.toLocaleString('pt-BR')} peças</span>
      <span class="status-fluxo ${serie.statusChave}">${U.esc(serie.status)}</span>
    </summary>
    <div class="mapa-serie-detalhes">
      <div class="mapa-serie-contexto">
        <span>${U.esc(origem)}</span><span>${U.esc(fornecedores)}</span><span>${U.esc(bitolas)}</span>
      </div>
      <div class="mapa-lotes-lista">
        ${serie.lotes.length ? serie.lotes.map(loteMapaProjeto).join('') : '<span class="txt-mini txt-cinza">Nenhum lote vinculado a esta série.</span>'}
      </div>
    </div>
  </details>`;
}

function loteMapaProjeto(l) {
  const serie = l._serie || {};
  return `<span class="mapa-lote-chip clicavel" onclick="abrirFichaLote('${U.esc(String(l.id))}')" title="Abrir ficha completa do lote" role="button" tabindex="0">
    <strong>${U.esc(l.lote || 'Lote sem número')}</strong>
    <em>${U.dataBR(l.dataFabricacao)} · ${intLocal(l.total).toLocaleString('pt-BR')} peças</em>
    <small>${U.esc(serie.fornecedor || l.fornecedor || 'Sem fábrica')} · ${U.esc(serie.bitola || l.bitola || 'Sem bitola')}</small>
  </span>`;
}

function nomeSerieSugeridaLocal(codigo, numero) {
  return `Série ${String(numero || 1).padStart(2, '0')} - ${codigo || 'PRJ'}`;
}

function codigoProjetoMapaLocal(projeto, bitola = '') {
  const k = chaveTextoLocal(`${projeto || ''} ${bitola || ''}`);
  if (k.includes('MALHA PAULISTA') && k.includes('BITOLA MISTA')) return 'MPBM';
  if (k.includes('MALHA PAULISTA') && k.includes('BITOLA LARGA')) return 'MPBL';
  if (k.includes('FERRO')) return 'FN';
  if (k.includes('FMT')) return 'FMT';
  return k.split(' ').map(p => p[0]).join('').slice(0, 4) || 'PRJ';
}

function numeroSerieLocal(serie) {
  const texto = String(serie || '').trim();
  const m = texto.match(/S[eé]rie\s*0*(\d+)/i) || texto.match(/(?:^|[^0-9])0*(\d{1,4})(?=$|[^0-9])/);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : 0;
}

function chaveTextoLocal(v) {
  return String(v == null ? '' : v).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
}

function resumoListaLocal(valores, limite = 2) {
  const lista = [...new Set((valores || []).map(v => String(v || '').trim()).filter(Boolean))];
  if (!lista.length) return '—';
  if (lista.length <= limite) return lista.join(' · ');
  return `${lista.slice(0, limite).join(' · ')} +${lista.length - limite}`;
}

function cardFluxo(s) {
  const ultimo = s.ultimoLote;
  const ensaios = s.ensaios.length ? s.ensaios.map(ensaioChip).join('') : '<span class="txt-mini txt-cinza">Nenhum ensaio registrado para esta série.</span>';
  return `<article class="fluxo-card ${s.statusChave}">
    <div class="fluxo-card-topo">
      <div>
        <h3>${U.esc(s.serie)}${s.curaTermica ? ` <span class="tag-termica" title="${s.acompanhamento14 ? 'Cura térmica na janela Ferro Norte 3231–3257 — o ensaio de 14 dias é só acompanhamento; libera no ensaio de 28 dias' : 'Cura térmica — informativo; a série libera no ensaio de liberação de 14 dias'}">cura térmica</span>` : ''}</h3>
        <p>${U.esc(s.fornecedor)} · ${U.esc(s.grupo)}</p>
      </div>
      <span class="status-fluxo ${s.statusChave}">${U.esc(s.status)}</span>
    </div>
    <div class="fluxo-metricas">
      <div><span>Produção</span><strong>${s.total.toLocaleString('pt-BR')}</strong><small>${s.saldoPecas.toLocaleString('pt-BR')} até 2.000</small></div>
      <div><span>Lotes</span><strong>${s.loteQtd}</strong><small>${s.saldoLotes} até 10</small></div>
      <div><span>Último lote</span><strong>${U.esc(ultimo?.lote || '—')}</strong><small>${U.dataBR(ultimo?.dataFabricacao)}</small></div>
      <div><span>Cura do último lote</span><strong>${U.dataBR(s.cura14)}</strong><small>28d: ${U.dataBR(s.cura28)}</small></div>
    </div>
    <div class="fluxo-progressos">
      ${barraFluxo('Dormentes', s.total, FluxoLiberacao.LIMITE_PECAS, s.pctPecas, s.statusChave)}
      ${barraFluxo('Lotes', s.loteQtd, FluxoLiberacao.LIMITE_LOTES, s.pctLotes, s.statusChave)}
    </div>
    <div class="fluxo-lotes">
      ${blocoLotesSerie(s)}
    </div>
    <div class="fluxo-ensaios"><strong>Ensaios registrados</strong><div>${ensaios}</div></div>
    <div class="fluxo-decisao"><strong>Próxima ação</strong><span>${U.esc(s.proximaAcao)}</span><small>${U.esc(s.detalheFluxo || '')}${contagemCuraTexto(s)}</small>${decisaoEnsaioTexto(s)}</div>
  </article>`;
}

/* =====================================================================
   EDIÇÃO DE LOTES DA SÉRIE — direto no card do painel
   Grava o campo "serie" nos lotes de produção (producao_lotes), então a
   mudança vale para o site inteiro (painel, produção, ensaios, mapa).
   ===================================================================== */
function encParam(v) {
  return encodeURIComponent(String(v == null ? '' : v)).replace(/'/g, '%27');
}

function blocoLotesSerie(s) {
  const podeEditar = window.Auth?.pode?.('editar');
  const topo = `<div class="fluxo-lotes-topo">
    <strong>Lotes da série</strong>
    ${podeEditar ? `<button type="button" class="btn-editar-lotes" onclick="iniciarEdicaoLotesSerie('${encParam(s.chave)}')" title="Editar quais lotes pertencem a esta série">${ICONE_EDITAR_LOTES}Editar lotes</button>` : ''}
  </div>`;

  const ultimo = s.ultimoLote;
  return `${topo}<div>${s.lotes.map(l => `<span class="lote-serie-chip clicavel ${ultimo && l.id === ultimo.id ? 'ultimo' : ''}" onclick="abrirFichaLote('${U.esc(String(l.id))}')" title="Abrir ficha completa do lote" role="button" tabindex="0"><strong>${U.esc(l.lote || '—')}</strong><em>${U.dataBR(l.dataFabricacao)} · ${intLocal(l.total).toLocaleString('pt-BR')} peças</em></span>`).join('')}</div>`;
}

function editorLotesSerieHtml(s) {
  const ed = EDICAO_SERIE;
  const chipsAtuais = s.lotes.map(l => {
    const id = String(l.id);
    const removido = ed.removidos.has(id);
    return `<span class="lote-serie-chip edicao ${removido ? 'removido' : ''}">
      <strong>${U.esc(l.lote || '—')}</strong>
      <em>${U.dataBR(l.dataFabricacao)} · ${intLocal(l.total).toLocaleString('pt-BR')} peças</em>
      <button type="button" class="chip-acao-lote ${removido ? 'desfazer' : ''}" onclick="alternarLoteEdicaoSerie('${encParam(id)}')" ${ed.salvando ? 'disabled' : ''}>${removido ? 'Desfazer' : 'Remover'}</button>
    </span>`;
  }).join('');

  const chipsAdicionados = [...ed.adicionados].map(id => {
    const c = loteCandidatoPorId(id);
    if (!c) return '';
    return `<span class="lote-serie-chip edicao adicionado">
      <strong>${U.esc(c.lote.lote || '—')}</strong>
      <em>${U.dataBR(c.lote.dataFabricacao)} · veio de ${U.esc(c.serieOrigem)}</em>
      <button type="button" class="chip-acao-lote desfazer" onclick="alternarLoteEdicaoSerie('${encParam(id)}')" ${ed.salvando ? 'disabled' : ''}>Desfazer</button>
    </span>`;
  }).join('');

  const candidatos = lotesCandidatosSerie(s).filter(c => !ed.adicionados.has(String(c.lote.id)));
  const opcoes = candidatos.map(c => `<option value="${encParam(String(c.lote.id))}">Lote ${U.esc(c.lote.lote || '—')} · ${U.dataBR(c.lote.dataFabricacao)} · ${U.esc(c.serieOrigem)}</option>`).join('');

  // Prévia da composição depois de salvar, para o usuário conferir antes de gravar.
  const qtdFinal = s.lotes.filter(l => !ed.removidos.has(String(l.id))).length + ed.adicionados.size;
  const pendencias = [];
  if (ed.removidos.size) pendencias.push(`${ed.removidos.size} para sair`);
  if (ed.adicionados.size) pendencias.push(`${ed.adicionados.size} para entrar`);

  return `<div class="editor-lotes-serie editor-lotes-em-modal">
    <div class="editor-lotes-resumo">
      ${editorResumoItem('Série', s.serie)}
      ${editorResumoItem('Projeto', s.projeto)}
      ${editorResumoItem('Fábrica', s.fornecedor)}
      ${editorResumoItem('Bitola', s.bitola)}
    </div>

    <div class="editor-lotes-secao">
      <span class="editor-lotes-titulo">Lotes desta série</span>
      <span class="editor-lotes-contador">${qtdFinal} lote(s) após salvar${pendencias.length ? ` · ${pendencias.join(', ')}` : ''}</span>
    </div>
    <div class="editor-lotes-chips">${chipsAtuais}${chipsAdicionados}</div>

    <div class="editor-lotes-secao">
      <span class="editor-lotes-titulo">Trazer lote de outra série</span>
    </div>
    <div class="editor-lotes-adicionar">
      <select id="selAdicionarLoteSerie" ${candidatos.length && !ed.salvando ? '' : 'disabled'}>
        <option value="">${candidatos.length ? 'Selecione um lote...' : 'Nenhum lote disponível neste projeto/fábrica'}</option>
        ${opcoes}
      </select>
      <button type="button" class="btn btn-secundario btn-mini" onclick="adicionarLoteSelecionadoSerie()" ${candidatos.length && !ed.salvando ? '' : 'disabled'}>${ICN.add || '+'}Adicionar</button>
    </div>

    <p class="editor-lotes-aviso">Lotes mantidos/adicionados ficam fixados nesta série; lotes removidos voltam ao cálculo automático. A alteração vale para o site inteiro (produção, ensaios e painéis).</p>
    <div class="editor-lotes-acoes">
      <button type="button" class="btn btn-primario btn-mini" onclick="salvarEdicaoLotesSerie()" ${ed.salvando ? 'disabled' : ''}>${ed.salvando ? 'Salvando...' : `${ICN.check}Salvar alterações`}</button>
      <button type="button" class="btn btn-secundario btn-mini" onclick="cancelarEdicaoLotesSerie()" ${ed.salvando ? 'disabled' : ''}>Cancelar</button>
    </div>
  </div>`;
}

function editorResumoItem(rotulo, valor) {
  return `<div class="editor-resumo-item"><span>${U.esc(rotulo)}</span><strong>${U.esc(valor || '—')}</strong></div>`;
}

function serieDaChave(chave) {
  return (FLUXO_DADOS.series || []).find(x => x.chave === chave) || null;
}

function lotesCandidatosSerie(s) {
  const out = [];
  (FLUXO_DADOS.series || []).forEach(x => {
    if (x.key !== s.key || x.chave === s.chave) return;
    x.lotes.forEach(l => out.push({ lote: l, serieOrigem: x.serie }));
  });
  return out.sort((a, b) => String(a.lote.dataFabricacao || '').localeCompare(String(b.lote.dataFabricacao || ''))
    || String(a.lote.lote || '').localeCompare(String(b.lote.lote || ''), 'pt-BR', { numeric: true }));
}

function loteCandidatoPorId(id) {
  const alvo = String(id);
  for (const x of (FLUXO_DADOS.series || [])) {
    const l = x.lotes.find(l => String(l.id) === alvo);
    if (l) return { lote: l, serieOrigem: x.serie };
  }
  return null;
}

function iniciarEdicaoLotesSerie(chaveEnc) {
  if (!window.Auth?.pode?.('editar')) {
    App.toast(Auth.mensagemSemPermissao('editar os lotes da série'), 'aviso');
    return;
  }
  const chave = decodeURIComponent(chaveEnc);
  const s = serieDaChave(chave);
  if (!s) {
    App.toast('Série não encontrada no painel atual. Atualize e tente de novo.', 'aviso');
    return;
  }
  EDICAO_SERIE = { chave, removidos: new Set(), adicionados: new Set(), salvando: false };
  renderEdicaoLotesSerie();
  document.getElementById('modalEditarLotes')?.classList.add('aberto');
}

// Redesenha só o corpo do modal: a edição acontece nele, e refazer o painel
// inteiro a cada clique perderia a rolagem e o foco do usuário.
function renderEdicaoLotesSerie() {
  const ed = EDICAO_SERIE;
  if (!ed) return;
  const s = serieDaChave(ed.chave);
  if (!s) { fecharModalEditarLotes(); return; }
  const titulo = document.getElementById('editarLotesTitulo');
  if (titulo) titulo.textContent = `Editar lotes — ${s.serie}`;
  setHtml('editarLotesCorpo', editorLotesSerieHtml(s));
}

function fecharModalEditarLotes() {
  EDICAO_SERIE = null;
  document.getElementById('modalEditarLotes')?.classList.remove('aberto');
}

function cancelarEdicaoLotesSerie() {
  if (EDICAO_SERIE?.salvando) return;
  fecharModalEditarLotes();
}

function alternarLoteEdicaoSerie(idEnc) {
  const ed = EDICAO_SERIE;
  if (!ed || ed.salvando) return;
  const id = decodeURIComponent(idEnc);
  if (ed.adicionados.has(id)) ed.adicionados.delete(id);
  else if (ed.removidos.has(id)) ed.removidos.delete(id);
  else ed.removidos.add(id);
  renderEdicaoLotesSerie();
}

function adicionarLoteSelecionadoSerie() {
  const ed = EDICAO_SERIE;
  if (!ed || ed.salvando) return;
  const sel = document.getElementById('selAdicionarLoteSerie');
  const id = decodeURIComponent(sel?.value || '');
  if (!id) return;
  ed.adicionados.add(id);
  renderEdicaoLotesSerie();
}

async function salvarEdicaoLotesSerie() {
  const ed = EDICAO_SERIE;
  if (!ed || ed.salvando) return;
  const s = serieDaChave(ed.chave);
  if (!s) {
    App.toast('Série não encontrada no painel atual. Atualize e tente de novo.', 'aviso');
    fecharModalEditarLotes();
    renderFluxo();
    return;
  }
  if (!ed.removidos.size && !ed.adicionados.size) {
    App.toast('Nenhuma alteração nos lotes desta série.', 'aviso');
    fecharModalEditarLotes();
    return;
  }

  // Monta a lista de gravações no banco:
  //  - removidos: serie = '' (volta ao cálculo automático)
  //  - mantidos + adicionados: serie = nome da série (fixa a composição)
  const alteracoes = [];
  const resumo = [];
  const semBanco = [];
  const idBancoDe = l => l.origem?.id || null;
  s.lotes.forEach(l => {
    const id = String(l.id);
    const idBanco = idBancoDe(l);
    if (ed.removidos.has(id)) {
      if (!idBanco) { semBanco.push(l.lote || id); return; }
      alteracoes.push({ id: idBanco, serie: null });
      resumo.push(`Lote ${l.lote || '—'} sai da série (volta ao automático)`);
    } else if (FluxoLiberacao.normalizarSerie(l.serie, l.projeto, { permitirVazio: true }) !== s.serie) {
      if (!idBanco) { semBanco.push(l.lote || id); return; }
      alteracoes.push({ id: idBanco, serie: s.serie });
    }
  });
  ed.adicionados.forEach(id => {
    const c = loteCandidatoPorId(id);
    if (!c) return;
    const idBanco = idBancoDe(c.lote);
    if (!idBanco) { semBanco.push(c.lote.lote || id); return; }
    alteracoes.push({ id: idBanco, serie: s.serie });
    resumo.push(`Lote ${c.lote.lote || '—'} entra na série (vinha de ${c.serieOrigem})`);
  });
  if (semBanco.length) {
    App.toast(`Lote(s) ${semBanco.join(', ')} sem id no banco não podem ser alterados por aqui.`, 'aviso');
  }
  if (!alteracoes.length) return;

  const msg = `Confirmar alterações em "${s.serie}"?\n\n${resumo.join('\n')}\n\nOs lotes mantidos serão fixados nesta série e a mudança vale para o site inteiro (produção, ensaios e painéis).`;
  if (!confirm(msg)) return;

  ed.salvando = true;
  renderEdicaoLotesSerie();
  try {
    for (const alt of alteracoes) {
      await StoreSupabase.salvarProducao({ id: alt.id, serie: alt.serie });
    }
    const nomeSerie = s.serie;
    const gravados = alteracoes.length;
    fecharModalEditarLotes();
    App.toast(`Lotes da ${nomeSerie} atualizados (${gravados} registro(s) gravado(s)).`, 'sucesso');
    await carregarFluxoLiberacao();
  } catch (err) {
    console.error('Erro ao salvar lotes da série', err);
    ed.salvando = false;
    App.toast(mensagemErroBanco(err, 'Não foi possível salvar os lotes da série.'), 'erro');
    renderEdicaoLotesSerie();
  }
}

function contagemCuraTexto(s) {
  if (s.statusChave === 'cura14' && s.diasPara14 > 0) return ` Faltam ${s.diasPara14} dia(s) para completar 14 dias.`;
  if (s.statusChave === 'cura28' && s.diasPara28 > 0) return ` Faltam ${s.diasPara28} dia(s) para completar 28 dias.`;
  if (s.statusChave === 'aguardando14' && s.diasPara14 != null && s.diasPara14 < 0) return ` Os 14 dias venceram há ${Math.abs(s.diasPara14)} dia(s).`;
  if (s.statusChave === 'aguardando28' && s.diasPara28 != null && s.diasPara28 < 0) return ` Os 28 dias venceram há ${Math.abs(s.diasPara28)} dia(s).`;
  return '';
}

function decisaoEnsaioTexto(s) {
  const e = s.liberadoPor || s.travadoPor;
  if (!e) return '';
  const rotulo = s.liberadoPor ? 'Liberada pelo ensaio de' : 'Travada pelo ensaio de';
  const link = linkRelatorioHref(e.linkRelatorio);
  return `<small class="fluxo-decisao-ensaio">${rotulo} ${U.dataBR(e.dataEnsaio)} (lote ${U.esc(e.lote || '—')})${link ? ` · <a href="${U.esc(link)}" target="_blank" rel="noopener">relatório</a>` : ''}</small>`;
}

function linkRelatorioHref(valor) {
  const link = String(valor || '').trim();
  if (!link) return '';
  return /^https?:\/\//i.test(link) ? link : `https://${link}`;
}

function ensaioChip(e) {
  const cls = e.resultado === 'Aprovado' ? 'ok' : e.resultado === 'Reprovado' ? 'erro' : 'aviso';
  const idade = e.idadeDias == null ? '' : ` · ${e.idadeDias}d`;
  const fase = e.fase ? `${e.fase}d` : 'fase indef.';
  const href = linkRelatorioHref(e.linkRelatorio);
  return `<span class="ensaio-fluxo-chip ${cls}"><strong>${fase} · ${U.esc(e.resultado || '—')}</strong><em>${U.dataBR(e.dataEnsaio)} · lote ${U.esc(e.lote || '—')}${idade}</em>${href ? `<a href="${U.esc(href)}" target="_blank" rel="noopener">relatório</a>` : ''}</span>`;
}

function barraFluxo(rotulo, atual, limite, pct, status) {
  return `<div><div class="progress-label"><span>${rotulo}</span><span>${atual.toLocaleString('pt-BR')} / ${limite.toLocaleString('pt-BR')}</span></div><div class="barra-progresso"><span class="${status}" style="width:${Math.min(100, pct)}%"></span></div></div>`;
}

function renderTabelaFluxo(series) {
  const alvo = document.getElementById('tabelaFluxo');
  if (!alvo) return;
  if (!series.length) {
    alvo.innerHTML = `<div class="vazio">${ICN.vazioBox}<h3>Sem dados para tabela</h3><p>Nenhuma série atende aos filtros atuais.</p></div>`;
    return;
  }
  alvo.innerHTML = `<div class="tabela-wrap"><table class="tabela">
    <thead><tr>
      <th>Fábrica</th><th>Projeto / Bitola</th><th>Série</th><th>Status do fluxo</th>
      <th class="right">Produção</th><th class="right">Lotes</th><th>Último lote</th><th>Cura 14d</th><th>Cura 28d</th><th>Ensaios</th><th>Próxima ação</th>
    </tr></thead>
    <tbody>${series.map(s => `<tr>
      <td>${U.esc(s.fornecedor)}</td>
      <td>${U.badgeProjeto(s.grupo)}</td>
      <td><strong>${U.esc(s.serie)}</strong><div class="txt-mini txt-cinza">${s.auto ? 'Série automática' : 'Série manual'}</div></td>
      <td><span class="status-fluxo ${s.statusChave}">${U.esc(s.status)}</span></td>
      <td class="right">${s.total.toLocaleString('pt-BR')}</td>
      <td class="right">${s.loteQtd}</td>
      <td><strong>${U.esc(s.ultimoLote?.lote || '—')}</strong><div class="txt-mini txt-cinza">${U.dataBR(s.ultimoLote?.dataFabricacao)}</div></td>
      <td>${U.dataBR(s.cura14)}</td>
      <td>${U.dataBR(s.cura28)}</td>
      <td>${resumoEnsaiosTabela(s)}</td>
      <td>${U.esc(s.proximaAcao)}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

function resumoEnsaiosTabela(s) {
  if (!s.ensaios.length) return '—';
  return s.ensaios.map(e => {
    const cls = e.resultado === 'Aprovado' ? 'badge-ok' : e.resultado === 'Reprovado' ? 'badge-reprovado' : 'badge-amarelo';
    return `<span class="badge ${cls}">${e.fase || '?'}d ${U.esc(e.resultado || '—')}</span>`;
  }).join(' ');
}

function contarStatus(series) {
  return series.reduce((acc, s) => {
    acc[s.statusChave] = (acc[s.statusChave] || 0) + 1;
    return acc;
  }, {});
}

function registrarExportacaoFluxo(series, projetos) {
  if (!window.Exportacoes) return;
  Exportacoes.registrar({
    titulo: 'Painel de Séries',
    nomeArquivo: 'painel-series',
    filtros: Exportacoes.filtrosDaTela(),
    secoes: [{
      titulo: 'Séries no fluxo',
      columns: [
        { key: 'fornecedor', label: 'Fábrica' },
        { key: 'grupo', label: 'Projeto / Bitola' },
        { key: 'serie', label: 'Série' },
        { key: 'status', label: 'Status do fluxo' },
        { key: 'total', label: 'Produção' },
        { key: 'loteQtd', label: 'Lotes' },
        { key: 'ultimoLoteExport', label: 'Último lote ensaiável' },
        { key: 'cura14Export', label: 'Cura 14 dias' },
        { key: 'cura28Export', label: 'Cura 28 dias' },
        { key: 'ensaiosExport', label: 'Ensaios' },
        { key: 'proximaAcao', label: 'Próxima ação' },
        { key: 'lotesTexto', label: 'Lotes da série' },
      ],
      rows: series.map(s => ({
        ...s,
        ultimoLoteExport: s.ultimoLote ? `${s.ultimoLote.lote || ''} (${U.dataBR(s.ultimoLote.dataFabricacao)})` : '',
        cura14Export: U.dataBR(s.cura14),
        cura28Export: U.dataBR(s.cura28),
        ensaiosExport: s.ensaios.map(e => `${e.fase || '?'}d ${e.resultado || ''} lote ${e.lote || ''} ${U.dataBR(e.dataEnsaio)}`).join(' | '),
      }))
    }, {
      titulo: 'Mapa por projeto',
      columns: [
        { key: 'codigo', label: 'Código do projeto' },
        { key: 'projeto', label: 'Projeto' },
        { key: 'seriesQtd', label: 'Séries existentes' },
        { key: 'ultimaSerie', label: 'Última série encontrada' },
        { key: 'proximaSerie', label: 'Próxima série a abrir' },
        { key: 'lotesTotal', label: 'Lotes' },
        { key: 'total', label: 'Dormentes' },
        { key: 'fornecedoresExport', label: 'Fábricas' },
        { key: 'bitolasExport', label: 'Bitolas' },
        { key: 'seriesExport', label: 'Séries e lotes' },
      ],
      rows: projetos.map(p => ({
        codigo: p.codigo,
        projeto: p.projeto,
        seriesQtd: p.seriesLista.length,
        ultimaSerie: p.ultimoNumero ? nomeSerieSugeridaLocal(p.codigo, p.ultimoNumero) : '',
        proximaSerie: p.proximaSerie,
        lotesTotal: p.lotesTotal,
        total: p.total,
        fornecedoresExport: [...p.fornecedores].join(' | '),
        bitolasExport: [...p.bitolas].join(' | '),
        seriesExport: p.seriesLista.map(serie => `${serie.serie}: ${serie.lotes.map(l => l.lote || 'sem lote').join(', ')}`).join(' | '),
      }))
    }]
  });
}

function setHtml(id, html) { const el = document.getElementById(id); if (el) el.innerHTML = html; }
function setText(id, texto) { const el = document.getElementById(id); if (el) el.textContent = texto; }
function intLocal(v) { const n = parseInt(String(v == null ? '' : v).replace(/[^0-9-]/g, ''), 10); return isNaN(n) ? 0 : n; }

function mensagemErroBanco(err, padrao) {
  const msg = err?.message || err?.details || '';
  if (!msg) return padrao;
  if (/row-level security|violates row-level security/i.test(msg)) return 'Acesso bloqueado pelas regras de segurança do Supabase. Confira seu perfil em usuarios_app.';
  if (/JWT|token|auth/i.test(msg)) return 'Sessão expirada ou inválida. Saia e faça login novamente.';
  return msg;
}

/* =====================================================================
   FICHA DO LOTE — modal com todas as informações do lote no site
   ===================================================================== */
function abrirFichaLote(id) {
  const alvoId = String(id || '');
  const serie = (FLUXO_DADOS.series || []).find(s => s.lotes.some(l => String(l.id) === alvoId)) || null;
  const lote = serie
    ? serie.lotes.find(l => String(l.id) === alvoId)
    : (FLUXO_DADOS.lotes || []).find(l => String(l.id) === alvoId);
  if (!lote) {
    App.toast('Lote não encontrado no painel atual. Atualize o painel e tente de novo.', 'aviso');
    return;
  }
  FICHA_LOTE_ATUAL = lote;
  const titulo = document.getElementById('fichaLoteTitulo');
  if (titulo) titulo.textContent = `Lote ${lote.lote || '—'} — ${serie ? serie.serie : 'sem série calculada'}`;
  setHtml('fichaLoteCorpo', fichaLoteHtml(lote, serie));
  document.getElementById('modalFichaLote')?.classList.add('aberto');
  carregarVinculosLote(lote);
}

function fecharFichaLote() {
  FICHA_LOTE_ATUAL = null;
  document.getElementById('modalFichaLote')?.classList.remove('aberto');
}

function fichaLoteHtml(lote, serie) {
  const r = lote.origem || {};
  const hoje = FLUXO_DADOS.hoje || '';
  const idade = FluxoLiberacao.diffDias(lote.dataFabricacao, hoje);
  const cura14 = String(r.cura_14 || '').slice(0, 10) || FluxoLiberacao.addDias(lote.dataFabricacao, 14);
  const cura28 = String(r.cura_28 || '').slice(0, 10) || FluxoLiberacao.addDias(lote.dataFabricacao, 28);
  const ehUltimo = !!(serie && serie.ultimoLote && String(serie.ultimoLote.id) === String(lote.id));
  const ensaiosDoLote = serie ? serie.ensaios.filter(e => ensaioEhDoLote(e, lote)) : [];

  return `
    <div class="detalhe-secao">Identificação</div>
    <div class="detalhe-grid">
      ${fichaItem('Fornecedor', r.fornecedor)}${fichaItem('Pista', r.pista)}${fichaItem('N° Pedido', r.pedido)}
      ${fichaItem('Lote', r.lote)}${fichaItem('Projeto', r.projeto)}${fichaItem('Bitola', U.bitolaDe(r))}
      ${fichaItem('Tipo', r.tipo_dormente)}${fichaItem('Total Produção', r.total_produzido)}
    </div>

    <div class="detalhe-secao">Série e fluxo de liberação</div>
    <div class="detalhe-grid">
      ${fichaItem('Série', serie ? serie.serie : '')}
      ${fichaItem('Origem da série', serie ? (serie.auto ? 'Automática' : 'Manual') : '')}
      ${fichaItem('Status do fluxo', serie ? serie.status : '')}
      ${fichaItem('Posição na série', serie ? (ehUltimo ? 'Último lote (ensaiável)' : `Lote ${serie.lotes.findIndex(l => String(l.id) === String(lote.id)) + 1} de ${serie.loteQtd}`) : '')}
      ${fichaItem('Idade atual', idade == null ? '' : `${idade} dia(s)`)}
    </div>

    <div class="detalhe-secao">Datas e cura</div>
    <div class="detalhe-grid">
      ${fichaItem('Fabricação', U.dataBR(lote.dataFabricacao))}${fichaItem('Cura 14d', U.dataBR(cura14))}
      ${fichaItem('Cura 28d', U.dataBR(cura28))}${fichaItem('Tempo de Cura (h)', r.tempo_cura)}
      ${fichaItem('Período início', U.dataBR(String(r.periodo_inicio || '').slice(0, 10)))}
      ${fichaItem('Período fim', U.dataBR(String(r.periodo_fim || '').slice(0, 10)))}
      ${fichaItem('Semana / Ano', [r.semana, r.ano].filter(Boolean).join(' / '))}
    </div>

    <div class="detalhe-secao">USP / Ombreiras</div>
    <div class="detalhe-grid">
      ${fichaItem('Com USP', fichaSimNao(r.com_usp))}${fichaItem('USP (Lote)', r.usp_lote)}
      ${fichaItem('Ombreira', r.tipo_ombreira)}${fichaItem('Lote Ombreira', r.lote_ombreira)}
    </div>

    <div class="detalhe-secao">Temperatura (°C)</div>
    <div class="detalhe-grid">
      ${fichaItem('Inicial', r.temp_inicial)}${fichaItem('Meio', r.temp_meio)}${fichaItem('Final', r.temp_final)}
    </div>

    <div class="detalhe-secao">Slump Test (mm)</div>
    <div class="detalhe-grid">
      ${fichaItem('Início Abat.', r.slump_inicial_abatimento)}${fichaItem('Início Esp.', r.slump_inicial_espalhamento)}
      ${fichaItem('Meio Abat.', r.slump_meio_abatimento)}${fichaItem('Meio Esp.', r.slump_meio_espalhamento)}
      ${fichaItem('Fim Abat.', r.slump_final_abatimento)}${fichaItem('Fim Esp.', r.slump_final_espalhamento)}
    </div>

    <div class="detalhe-secao">Desprotensão</div>
    <div class="detalhe-grid">
      ${fichaItem('Início Pista', r.despro_ini)}${fichaItem('Meio Pista', r.despro_meio)}${fichaItem('Fim Pista', r.despro_fim)}
    </div>

    <div class="detalhe-secao">Resistências (CP 1 / CP 2)</div>
    <div class="detalhe-grid">
      ${fichaItem('Comp. 7d', fichaCp(r.comp_7, r.comp_7_cp2))}${fichaItem('Comp. 14d', fichaCp(r.comp_14, r.comp_14_cp2))}
      ${fichaItem('Tração 14d', fichaCp(r.tracao_14, r.tracao_14_cp2))}${fichaItem('Comp. 28d', fichaCp(r.comp_28, r.comp_28_cp2))}
      ${fichaItem('Tração 28d', fichaCp(r.tracao_28, r.tracao_28_cp2))}
    </div>

    <div class="detalhe-secao">Ensaio / Resultado do lançamento</div>
    <div class="detalhe-grid">
      ${fichaItem('iAuditor', r.iauditor)}${fichaItem('Ensaiados', r.dorm_ensaiados)}
      ${fichaItem('A Analisar', r.dorm_a_analisar)}${fichaItem('Reprovados', r.dorm_reprovados)}
      ${fichaItem('Aprovado', r.total_aprovado)}${fichaItem('Status', r.status)}
    </div>
    ${r.motivo ? `<div class="detalhe-secao">Motivo / Especificação</div><p style="font-size:13.5px;color:var(--cinza-texto)">${U.esc(r.motivo)}</p>` : ''}

    <div class="detalhe-secao">Ensaios de liberação deste lote</div>
    <div class="ficha-chips">${ensaiosDoLote.length ? ensaiosDoLote.map(ensaioChip).join('') : '<span class="txt-mini txt-cinza">Nenhum ensaio registrado com este lote. ' + (serie && serie.ensaios.length ? 'A série tem ensaios em outros lotes (veja o card da série).' : '') + '</span>'}</div>

    <div class="detalhe-secao">Vínculos no site</div>
    <div id="fichaVinculos"><span class="txt-mini txt-cinza">Buscando inspeções, reprovas e relatórios deste lote...</span></div>

    ${serie && serie.lotes.length > 1 ? `
      <div class="detalhe-secao">Lotes da mesma série</div>
      <div class="ficha-chips">${serie.lotes.map(l => String(l.id) === String(lote.id)
        ? `<span class="lote-serie-chip atual"><strong>${U.esc(l.lote || '—')}</strong><em>este lote</em></span>`
        : `<span class="lote-serie-chip clicavel" onclick="abrirFichaLote('${U.esc(String(l.id))}')" title="Ver ficha deste lote" role="button" tabindex="0"><strong>${U.esc(l.lote || '—')}</strong><em>${U.dataBR(l.dataFabricacao)}</em></span>`).join('')}</div>` : ''}

    <div class="form-acoes">
      <a class="btn btn-secundario" href="producao.html?lote=${encodeURIComponent(lote.lote || '')}">${ICN.producao}Abrir na Produção</a>
      <button class="btn btn-secundario" onclick="fecharFichaLote()">Fechar</button>
    </div>
  `;
}

function ensaioEhDoLote(e, lote) {
  if (e.producaoLoteId && String(e.producaoLoteId) === String(lote.id)) return true;
  const a = String(e.lote || '').trim().toUpperCase();
  const b = String(lote.lote || '').trim().toUpperCase();
  return !!a && a === b;
}

async function carregarVinculosLote(lote) {
  const chave = String(lote.id);
  if (FICHA_VINCULOS_CACHE.has(chave)) {
    if (FICHA_LOTE_ATUAL && String(FICHA_LOTE_ATUAL.id) === chave) {
      setHtml('fichaVinculos', vinculosLoteHtml(lote, FICHA_VINCULOS_CACHE.get(chave)));
    }
    return;
  }
  const filtroLote = String(lote.lote || '').trim();
  try {
    const [pista, concretagem, reprovados] = filtroLote ? await Promise.all([
      StoreSupabase.listarInspecoesPista({ lote: filtroLote, limite: 200 }),
      StoreSupabase.listarInspecoesConcretagem({ lote: filtroLote, limite: 200 }),
      StoreSupabase.listarReprovados({ lote: filtroLote, limite: 200 }),
    ]) : [[], [], []];
    const dados = { pista: pista || [], concretagem: concretagem || [], reprovados: reprovados || [] };
    FICHA_VINCULOS_CACHE.set(chave, dados);
    if (FICHA_LOTE_ATUAL && String(FICHA_LOTE_ATUAL.id) === chave) {
      setHtml('fichaVinculos', vinculosLoteHtml(lote, dados));
    }
  } catch (err) {
    console.error('Erro ao buscar vínculos do lote', err);
    if (FICHA_LOTE_ATUAL && String(FICHA_LOTE_ATUAL.id) === chave) {
      setHtml('fichaVinculos', `<span class="txt-mini txt-cinza">Não foi possível buscar os vínculos agora. ${U.esc(mensagemErroBanco(err, ''))}</span>`);
    }
  }
}

function vinculosLoteHtml(lote, dados) {
  const loteParam = encodeURIComponent(String(lote.lote || '').trim());
  return `<div class="ficha-vinculos-grid">
    ${blocoVinculo('Inspeções de pista', dados.pista, `inspecao-pista.html?lote=${loteParam}`, i => ({
      data: String(i.data_inspecao || '').slice(0, 10), texto: i.resultado || i.atividade || '', link: i.link_relatorio
    }))}
    ${blocoVinculo('Inspeções de concretagem', dados.concretagem, `inspecao-concretagem.html?lote=${loteParam}`, i => ({
      data: String(i.data_inspecao || '').slice(0, 10), texto: i.resultado || i.atividade || '', link: i.link_relatorio
    }))}
    ${blocoVinculo('Dormentes reprovados', dados.reprovados, `reprovados.html?lote=${loteParam}`, i => ({
      data: String(i.data_producao || '').slice(0, 10), texto: [i.motivo_indicador, i.total_refugos ? `${i.total_refugos} refugo(s)` : ''].filter(Boolean).join(' · '), link: ''
    }))}
    ${blocoVinculoLink('Ensaios de liberação', `ensaios-liberacao.html?lote=${loteParam}`)}
  </div>`;
}

function blocoVinculo(titulo, itens, hrefPagina, extrair) {
  const lista = (itens || []).slice(0, 4).map(i => {
    const d = extrair(i);
    const href = linkRelatorioHref(d.link);
    return `<li>${U.dataBR(d.data)}${d.texto ? ` · ${U.esc(d.texto)}` : ''}${href ? ` · <a href="${U.esc(href)}" target="_blank" rel="noopener">relatório</a>` : ''}</li>`;
  }).join('');
  const extra = (itens || []).length > 4 ? `<li class="txt-cinza">+ ${itens.length - 4} registro(s)</li>` : '';
  return `<div class="ficha-vinculo">
    <div class="ficha-vinculo-topo"><strong>${U.esc(titulo)}</strong><span class="badge ${itens?.length ? 'badge-amarelo' : 'badge-ok'}">${itens?.length || 0}</span></div>
    ${lista ? `<ul>${lista}${extra}</ul>` : '<p class="txt-mini txt-cinza">Nenhum registro para este lote.</p>'}
    <a href="${U.esc(hrefPagina)}">Abrir página filtrada</a>
  </div>`;
}

function blocoVinculoLink(titulo, hrefPagina) {
  return `<div class="ficha-vinculo">
    <div class="ficha-vinculo-topo"><strong>${U.esc(titulo)}</strong></div>
    <p class="txt-mini txt-cinza">Os ensaios deste lote e da série aparecem nas seções acima.</p>
    <a href="${U.esc(hrefPagina)}">Abrir página filtrada</a>
  </div>`;
}

function fichaItem(rot, val) {
  const texto = String(val == null ? '' : val).trim();
  return `<div class="detalhe-item"><div class="rot">${U.esc(rot)}</div><div class="val">${U.esc(texto || '—')}</div></div>`;
}

function fichaCp(cp1, cp2) {
  const a = String(cp1 == null ? '' : cp1).trim();
  const b = String(cp2 == null ? '' : cp2).trim();
  if (!a && !b) return '';
  return b ? `${a || '—'} / ${b}` : a;
}

function fichaSimNao(v) {
  if (v === true) return 'Sim';
  if (v === false) return 'Não';
  return v == null ? '' : String(v);
}

window.render = renderFluxo;
window.carregarFluxoLiberacao = carregarFluxoLiberacao;
window.abrirFichaLote = abrirFichaLote;
window.fecharFichaLote = fecharFichaLote;
window.iniciarEdicaoLotesSerie = iniciarEdicaoLotesSerie;
window.cancelarEdicaoLotesSerie = cancelarEdicaoLotesSerie;
window.alternarLoteEdicaoSerie = alternarLoteEdicaoSerie;
window.adicionarLoteSelecionadoSerie = adicionarLoteSelecionadoSerie;
window.salvarEdicaoLotesSerie = salvarEdicaoLotesSerie;
