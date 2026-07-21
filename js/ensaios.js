/* =====================================================================
   ENSAIOS.JS — Fluxo de Liberação em etapas horizontais por lote
   Cada lote aparece como uma linha e herda as decisões da própria série.
   ===================================================================== */
let PAINEL_PRODUCAO = [];
let PAINEL_ENSAIOS = [];
let PAINEL_CONCRETAGENS = [];
let PAINEL_INSPECOES_PISTA = [];
let PAINEL_ENSAIOS_BITOLA = [];
let PAINEL_ARRANCAMENTOS_USP = [];
let PAINEL_DOSSIE_AVISOS = [];
let PAINEL_CARREGANDO = false;
let PAINEL_ERRO = '';
let PAINEL_DADOS = null;
let PAINEL_DOSSIES_LOTE = new Map();

const STATUS_OPCOES = [
  { valor: '', texto: 'Todos' },
  { valor: 'formando', texto: 'Série em formação' },
  { valor: 'cura14', texto: 'Em cura 14 dias' },
  { valor: 'aguardando14', texto: 'Aguardando ensaio 14 dias' },
  { valor: 'cura28', texto: 'Em cura 28 dias' },
  { valor: 'aguardando28', texto: 'Aguardando ensaio 28 dias' },
  { valor: 'reteste28', texto: 'Aguardando 2 contraensaios' },
  { valor: 'pendente', texto: 'Resultado pendente' },
  { valor: 'liberado', texto: 'Liberado para transporte' },
  { valor: 'travado', texto: 'Coordenação/especialistas' },
];

const ETAPAS_EXPORT = [
  'produzido', 'cura14', 'ensaio14', 'aguardando28', 'cura28', 'ensaio28',
  'contraensaios', 'liberado', 'coordenacao'
];

document.addEventListener('DOMContentLoaded', async () => {
  document.body.classList.add('pagina-painel-series');
  if (!await Auth.exigirLogin()) return;

  App.montarLayout('painelSeries', 'Fluxo de Liberação', 'Etapas horizontais por lote, série, cura, ensaios e liberação para transporte');
  App.acoesTopo(`
    <button class="btn btn-secundario" onclick="location.href='producao.html'">${ICN.producao}Produção</button>
    <button class="btn btn-secundario" onclick="location.href='ensaios-liberacao.html'">${ICN.check}Ensaios</button>
    <button class="btn btn-primario" onclick="carregarPainelSeries()">${ICN.download}Atualizar fluxo</button>
  `);

  preencherFiltros();
  configurarEventos();
  render();
  await carregarPainelSeries();
});

function configurarEventos() {
  ['busca', 'fFornecedor', 'fProjeto', 'fBitola', 'fSerie', 'fStatusSerie'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', render);
    el.addEventListener('change', render);
  });

  document.getElementById('fSemana')?.addEventListener('change', () => {
    U.aplicarSemanaSelecionada('fSemana', 'fPeriodoIni', 'fPeriodoFim');
    render();
  });

  ['fPeriodoIni', 'fPeriodoFim'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      sincronizarSemanaPainel();
      render();
    });
  });

  document.addEventListener('click', (ev) => {
    const abrir = ev.target.closest?.('[data-abrir-dossie]');
    if (abrir) {
      ev.preventDefault();
      abrirDossieLote(abrir.dataset.dossieKey || '');
      return;
    }

    if (ev.target.closest?.('[data-fechar-dossie]') || ev.target.classList?.contains('dossie-modal-backdrop')) {
      ev.preventDefault();
      fecharDossieLote();
    }
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') fecharDossieLote();
  });

  window.render = render;
}

async function carregarPainelSeries() {
  PAINEL_CARREGANDO = true;
  PAINEL_ERRO = '';
  render();

  try {
    await Auth.exigirLogin();
    PAINEL_DOSSIE_AVISOS = [];
    const [producao, ensaios, concretagens, inspecoesPista, ensaiosBitola, arrancamentosUsp] = await Promise.all([
      StoreSupabase.listarProducao({ limite: 10000 }),
      StoreSupabase.listarEnsaiosLiberacao({ limite: 10000 }),
      carregarDadoOpcionalDossie('Inspeção de concretagem', () => StoreSupabase.listarInspecoesConcretagem?.({ limite: 10000 })),
      carregarDadoOpcionalDossie('Inspeção de pista', () => StoreSupabase.listarInspecoesPista?.({ limite: 10000 })),
      carregarDadoOpcionalDossie('Ensaio de bitola', () => StoreSupabase.listarEnsaiosBitola?.({ limite: 10000 })),
      carregarDadoOpcionalDossie('Ensaio de arrancamento USP', () => StoreSupabase.listarEnsaiosArrancamentoUsp?.({ limite: 10000 })),
    ]);

    PAINEL_PRODUCAO = (producao || []).map(mapProducaoPainel);
    PAINEL_ENSAIOS = (ensaios || []).map(mapEnsaioPainel);
    PAINEL_CONCRETAGENS = (concretagens || []).map(mapInspecaoConcretagemPainel);
    PAINEL_INSPECOES_PISTA = (inspecoesPista || []).map(mapInspecaoPistaPainel);
    PAINEL_ENSAIOS_BITOLA = (ensaiosBitola || []).map(mapEnsaioBitolaPainel);
    PAINEL_ARRANCAMENTOS_USP = (arrancamentosUsp || []).map(mapArrancamentoUspPainel);
    PAINEL_DADOS = calcularDadosBase();

    atualizarFiltroSerie();
    atualizarFiltroSemanaPainel();

    PAINEL_CARREGANDO = false;
    render();
  } catch (err) {
    console.error('Erro ao carregar Fluxo de Liberação', err);
    PAINEL_CARREGANDO = false;
    PAINEL_ERRO = mensagemErroBanco(err, 'Não foi possível carregar o Fluxo de Liberação do Supabase.');
    App.toast(PAINEL_ERRO, 'erro');
    render();
  }
}

async function carregarDadoOpcionalDossie(nome, loader) {
  try {
    if (typeof loader !== 'function') return [];
    const dados = await loader();
    return dados || [];
  } catch (err) {
    const msg = err?.message || err?.details || String(err || '');
    console.warn(`Dossiê do lote: ${nome} não carregou`, err);
    PAINEL_DOSSIE_AVISOS.push(`${nome}: ${msg || 'não carregado'}`);
    return [];
  }
}

function calcularDadosBase() {
  if (!window.FluxoLiberacao) {
    throw new Error('Motor FluxoLiberacao não foi carregado. Confira o arquivo js/fluxo-liberacao-core.js.');
  }
  return FluxoLiberacao.calcular(PAINEL_PRODUCAO, PAINEL_ENSAIOS);
}

function preencherFiltros() {
  document.getElementById('fFornecedor').innerHTML = U.opcoes(CFG.listas.fornecedores, '', 'Todas');
  document.getElementById('fProjeto').innerHTML = U.opcoes(CFG.listas.projetos, '', 'Todos');
  document.getElementById('fBitola').innerHTML = U.opcoes(CFG.listas.bitolas, '', 'Todas');
  document.getElementById('fStatusSerie').innerHTML = STATUS_OPCOES.map(s => `<option value="${s.valor}">${s.texto}</option>`).join('');
  atualizarFiltroSerie();
  atualizarFiltroSemanaPainel();
}

function atualizarFiltroSerie() {
  const atual = document.getElementById('fSerie')?.value || '';
  const dados = PAINEL_DADOS || calcularDadosSeguro();
  const series = [...new Set((dados?.series || []).map(s => s.serie).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
  const html = '<option value="">Todas</option>' + series.map(s => `<option value="${U.esc(s)}">${U.esc(s)}</option>`).join('');
  const el = document.getElementById('fSerie');
  if (!el) return;
  el.innerHTML = html;
  if (atual && series.includes(atual)) el.value = atual;
}

function atualizarFiltroSemanaPainel(selecionado) {
  U.preencherFiltroSemana('fSemana', PAINEL_PRODUCAO.map(r => r.dataFabricacao).filter(Boolean), selecionado ?? document.getElementById('fSemana')?.value, 'Todas as semanas');
}

function sincronizarSemanaPainel() {
  U.sincronizarFiltroSemana('fSemana', document.getElementById('fPeriodoIni')?.value, document.getElementById('fPeriodoFim')?.value);
}

function filtros() {
  return {
    busca: (document.getElementById('busca')?.value || '').toLowerCase().trim(),
    fornecedor: document.getElementById('fFornecedor')?.value || '',
    projeto: document.getElementById('fProjeto')?.value || '',
    bitola: document.getElementById('fBitola')?.value || '',
    serie: document.getElementById('fSerie')?.value || '',
    status: document.getElementById('fStatusSerie')?.value || '',
    ini: document.getElementById('fPeriodoIni')?.value || '',
    fim: document.getElementById('fPeriodoFim')?.value || '',
  };
}

function render() {
  const alvo = document.getElementById('painelSeriesFluxo');
  const contador = document.getElementById('contadorSeries');
  if (!alvo) return;

  if (PAINEL_CARREGANDO) {
    alvo.innerHTML = `<div class="vazio compacto"><h3>Carregando fluxo dos lotes</h3><p>Buscando Produção e Ensaios de Liberação no Supabase.</p></div>`;
    if (contador) contador.textContent = 'Carregando...';
    return;
  }

  if (PAINEL_ERRO) {
    alvo.innerHTML = `<div class="vazio compacto">${ICN.alerta}<h3>Não foi possível carregar</h3><p>${U.esc(PAINEL_ERRO)}</p></div>`;
    if (contador) contador.textContent = 'Erro no banco';
    return;
  }

  const dados = PAINEL_DADOS || calcularDadosSeguro();
  if (!dados) {
    alvo.innerHTML = `<div class="vazio compacto"><h3>Nenhum dado carregado</h3><p>Clique em Atualizar fluxo para buscar os dados.</p></div>`;
    if (contador) contador.textContent = '0 lotes';
    return;
  }

  const linhas = montarLinhasFiltradas(dados, filtros());
  registrarExportacaoPainelSeries(linhas, dados);
  renderTabelaFluxo(linhas, dados);

  const seriesDistintas = new Set(linhas.map(l => l.serieRef.chave)).size;
  const lotesEnsaio = linhas.filter(l => l.loteDeEnsaio).length;
  if (contador) contador.innerHTML = `${linhas.length} lote(s) · ${seriesDistintas} série(s) · ${lotesEnsaio} lote(s) de ensaio`;
}

function calcularDadosSeguro() {
  try { return calcularDadosBase(); } catch (err) { console.warn(err); return null; }
}

function montarLinhasFiltradas(dados, f) {
  const linhas = [];

  (dados.series || []).forEach(serie => {
    if (f.fornecedor && serie.fornecedor !== f.fornecedor) return;
    if (f.projeto && serie.projeto !== f.projeto) return;
    if (f.bitola && serie.bitola !== f.bitola) return;
    if (f.serie && serie.serie !== f.serie) return;
    if (f.status && serie.statusChave !== f.status) return;

    (serie.lotes || []).forEach(lote => {
      if (!dentroPeriodo(lote.dataFabricacao, f.ini, f.fim)) return;
      const loteDeEnsaio = mesmoLote(lote, serie.ultimoLote);
      const ctx = { lote, serieRef: serie, loteDeEnsaio };
      ctx.dossie = montarDossieLote(ctx);
      const textoBusca = `${lote.lote} ${serie.fornecedor} ${serie.projeto} ${serie.bitola} ${serie.serie} ${serie.status} ${lote.tipo} ${lote.total} ${textoBuscaDossie(ctx.dossie)}`.toLowerCase();
      if (f.busca && !textoBusca.includes(f.busca)) return;
      linhas.push(ctx);
    });
  });

  return linhas.sort((a, b) =>
    String(a.serieRef.fornecedor).localeCompare(String(b.serieRef.fornecedor), 'pt-BR') ||
    String(a.serieRef.projeto).localeCompare(String(b.serieRef.projeto), 'pt-BR') ||
    String(a.serieRef.bitola).localeCompare(String(b.serieRef.bitola), 'pt-BR') ||
    String(a.serieRef.serie).localeCompare(String(b.serieRef.serie), 'pt-BR', { numeric: true }) ||
    ordemProducao(a.lote, b.lote)
  );
}

function renderTabelaFluxo(linhas, dados) {
  const alvo = document.getElementById('painelSeriesFluxo');
  PAINEL_DOSSIES_LOTE = new Map();
  fecharDossieLote();
  if (!linhas.length) {
    alvo.innerHTML = `<div class="vazio compacto">${ICN.vazioBox}<h3>Nenhum lote encontrado</h3><p>Altere os filtros ou cadastre produção para visualizar o fluxo.</p></div>`;
    return;
  }

  alvo.innerHTML = `
    <div class="painel-series-legenda">
      ${legendaItem('feito', '✓', 'Etapa concluída')}
      ${legendaItem('atual', '●', 'Etapa atual')}
      ${legendaItem('pendente', '—', 'Ainda não chegou')}
      ${legendaItem('erro', '!', 'Reprova/trava')}
      ${legendaItem('dossie', 'D', 'Dossiê do lote')}
      ${PAINEL_DOSSIE_AVISOS.length ? `<span class="legenda-fluxo aviso" title="${U.esc(PAINEL_DOSSIE_AVISOS.join(' | '))}"><b>!</b>Algum histórico não carregou</span>` : ''}
    </div>
    <div class="tabela-wrap fluxo-horizontal-wrap">
      <table class="tabela tabela-fluxo-lotes">
        <thead>
          <tr>
            <th class="sticky-col lote-col">Lote</th>
            <th class="sticky-col serie-col">Projeto / Série</th>
            <th class="dossie-col">Dossiê do lote</th>
            <th>Produzido</th>
            <th>Cura 14d</th>
            <th>Ensaio 14d</th>
            <th>Aguard. 28d</th>
            <th>Cura 28d</th>
            <th>Ensaio 28d</th>
            <th>2 contraensaios</th>
            <th>Liberado transporte</th>
            <th>Coordenação / especialistas</th>
          </tr>
        </thead>
        <tbody>
          ${linhas.map(l => linhaFluxoHtml(l, dados.hoje)).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function legendaItem(cls, ic, txt) {
  return `<span class="legenda-fluxo ${cls}"><b>${ic}</b>${txt}</span>`;
}

function linhaFluxoHtml(ctx, hoje) {
  const { lote, serieRef: serie, loteDeEnsaio } = ctx;
  const etapas = etapasDoLote(ctx, hoje);
  const lotesSerie = (serie.lotes || []).map(l => l.lote).filter(Boolean).join(', ');
  const classes = [`status-${serie.statusChave || 'formando'}`];
  if (loteDeEnsaio) classes.push('linha-lote-ensaio');

  return `<tr class="${classes.join(' ')}">
    <td class="sticky-col lote-col">
      <div class="fluxo-id">
        <strong>Lote ${U.esc(lote.lote || '—')}</strong>
        <span>${U.dataBR(lote.dataFabricacao)} · ${formatNumero(lote.total)} peça(s)</span>
        <em class="tag-lote ${loteDeEnsaio ? 'ensaio' : 'serie'}">${loteDeEnsaio ? 'lote de ensaio' : 'acompanha a série'}</em>
      </div>
    </td>
    <td class="sticky-col serie-col">
      <div class="fluxo-serie-info">
        <strong>${U.esc(serie.projeto || '—')} · ${U.esc(serie.bitola || '—')}</strong>
        <span>${U.esc(serie.fornecedor || '—')} · ${U.esc(serie.serie || '—')}</span>
        <span>${U.esc(serie.status || '—')}</span>
        <small title="${U.esc(lotesSerie)}">${serie.loteQtd} lote(s) na série · ensaio no lote ${U.esc(serie.ultimoLote?.lote || '—')}</small>
      </div>
    </td>
    ${dossieLoteHtml(ctx)}
    ${etapas.map(etapaHtml).join('')}
  </tr>`;
}

function montarDossieLote(ctx) {
  const { lote, serieRef: serie } = ctx;
  const loteAtual = norm(lote?.lote || '');
  const loteEnsaioSerie = norm(serie?.ultimoLote?.lote || '');
  const lotesSerie = new Set((serie?.lotes || []).map(l => norm(l.lote)).filter(Boolean));
  const idAtual = String(lote?.id || '').trim();

  const producao = [{
    data: lote?.dataFabricacao || '',
    lote: lote?.lote || '',
    resultado: lote?.status || 'Cadastrado',
    detalhes: `${formatNumero(lote?.total)} peça(s)`,
    relacao: 'lote direto',
  }];

  const concretagem = filtrarDireto(PAINEL_CONCRETAGENS, lote, serie);
  const pista = filtrarDireto(PAINEL_INSPECOES_PISTA, lote, serie);
  const liberacao = (serie?.ensaios || []).map(e => ({
    ...e,
    data: e.dataEnsaio,
    relacao: registroEhDireto(e, lote, ['lote'], ['producaoLoteId']) ? 'lote direto' : `por série${e.lote ? ' · lote ' + e.lote : ''}`,
    detalhes: `${e.fase || '?'}d${e.quantidadeEnsaiada ? ' · ' + e.quantidadeEnsaiada + ' CP(s)' : ''}`,
  }));
  const bitola = filtrarDiretoOuSerie(PAINEL_ENSAIOS_BITOLA, lote, serie, lotesSerie, loteAtual, loteEnsaioSerie);
  const arrancamento = filtrarDiretoOuSerie(PAINEL_ARRANCAMENTOS_USP, lote, serie, lotesSerie, loteAtual, loteEnsaioSerie, ['lote', 'loteOmbreira']);

  const itens = [
    itemDossie('producao', 'Produção', producao, 'producao.html', 'Lote cadastrado na Produção'),
    itemDossie('concretagem', 'Inspeção de concretagem', concretagem, 'inspecao-concretagem.html', 'Nenhuma inspeção de concretagem vinculada ao lote'),
    itemDossie('pista', 'Inspeção de pista', pista, 'inspecao-pista.html', 'Nenhuma inspeção de pista vinculada ao lote'),
    itemDossie('liberacao', 'Ensaio de liberação', liberacao, 'ensaios-liberacao.html', 'Nenhum ensaio de liberação da série encontrado'),
    itemDossie('bitola', 'Ensaio de bitola', bitola, 'ensaio-bitola.html', 'Nenhum ensaio de bitola direto ou por lote de ensaio da série'),
    itemDossie('arrancamento', 'Arrancamento USP', arrancamento, 'ensaio-arrancamento-usp.html', 'Nenhum ensaio de arrancamento USP direto ou por lote de ensaio da série'),
  ];

  const encontrados = itens.filter(i => i.encontrado).length;
  const links = itens.flatMap(i => (i.registros || []).map(r => r.linkRelatorio).filter(Boolean));
  return { itens, encontrados, total: itens.length, links, lote: lote?.lote || '', serie: serie?.serie || '' };
}

function filtrarDireto(registros, lote, serie) {
  return (registros || [])
    .filter(r => registroEhDireto(r, lote) && mesmoGrupoRegistro(r, serie))
    .map(r => ({ ...r, relacao: 'lote direto' }));
}

function filtrarDiretoOuSerie(registros, lote, serie, lotesSerie, loteAtual, loteEnsaioSerie, camposLote = ['lote']) {
  return (registros || [])
    .filter(r => {
      if (!mesmoGrupoRegistro(r, serie)) return false;
      const direto = registroEhDireto(r, lote, camposLote);
      if (direto) return true;
      const loteRegistro = camposLote.map(c => norm(r?.[c])).find(Boolean) || '';
      return !!loteRegistro && (loteRegistro === loteEnsaioSerie || lotesSerie.has(loteRegistro));
    })
    .map(r => {
      const direto = registroEhDireto(r, lote, camposLote);
      const loteRegistro = camposLote.map(c => r?.[c]).find(Boolean) || r.lote || '';
      return { ...r, relacao: direto ? 'lote direto' : `por série · lote ${loteRegistro || serie?.ultimoLote?.lote || '—'}` };
    });
}

function registroEhDireto(registro, lote, camposLote = ['lote'], camposId = ['producaoLoteId']) {
  if (!registro || !lote) return false;
  const idLote = String(lote.id || '').trim();
  if (idLote && camposId.some(c => String(registro?.[c] || '').trim() === idLote)) return true;
  const loteAtual = norm(lote.lote || '');
  return !!loteAtual && camposLote.some(c => norm(registro?.[c]) === loteAtual);
}

function mesmoGrupoRegistro(registro, serie) {
  if (!registro || !serie) return true;
  if (registro.fornecedor && serie.fornecedor && norm(registro.fornecedor) !== norm(serie.fornecedor)) return false;
  if (registro.projeto && serie.projeto && !projetosCompativeis(registro.projeto, serie.projeto)) return false;
  if (registro.bitola && serie.bitola && norm(registro.bitola) !== norm(serie.bitola)) return false;
  return true;
}

function projetosCompativeis(a, b) {
  const pa = FluxoLiberacao?.projetoCanonico ? FluxoLiberacao.projetoCanonico(a) : normalizarProjeto(a);
  const pb = FluxoLiberacao?.projetoCanonico ? FluxoLiberacao.projetoCanonico(b) : normalizarProjeto(b);
  const na = norm(pa || a);
  const nb = norm(pb || b);
  if (na === nb || norm(a) === norm(b)) return true;
  return na.includes('MALHA PAULISTA') && nb.includes('MALHA PAULISTA');
}

function itemDossie(key, titulo, registros, pagina, vazio) {
  const lista = (registros || []).filter(Boolean).sort(ordemRegistroDossie);
  const encontrado = lista.length > 0;
  const status = !encontrado ? 'pendente' : lista.some(r => resultadoClasseDossie(r) === 'erro') ? 'erro' : lista.some(r => resultadoClasseDossie(r) === 'aviso') ? 'aviso' : 'ok';
  return { key, titulo, pagina, vazio, registros: lista, encontrado, status };
}

function ordemRegistroDossie(a, b) {
  return String(b.data || '').localeCompare(String(a.data || '')) || String(b.id || '').localeCompare(String(a.id || ''));
}

function resultadoClasseDossie(r) {
  const n = norm(r?.resultado || '');
  if (n.includes('REPROV') || n.includes('RECUS') || n.includes('TRAV')) return 'erro';
  if (n.includes('PEND') || n.includes('AGUARD')) return 'aviso';
  return 'ok';
}

function textoBuscaDossie(dossie) {
  return (dossie?.itens || []).map(i => [
    i.titulo,
    i.encontrado ? 'encontrado com registro check' : 'sem registro pendente não encontrado',
    ...(i.registros || []).map(r => `${r.lote || ''} ${r.resultado || ''} ${r.relacao || ''} ${r.responsavel || ''} ${r.linkRelatorio || ''} ${r.detalhes || ''}`),
  ].join(' ')).join(' ');
}

function dossieLoteHtml(ctx) {
  const dossie = ctx.dossie || montarDossieLote(ctx);
  const resumoLinks = dossie.links.length ? `${dossie.links.length} link(s)` : 'sem links';
  const key = dossieKey(ctx);
  PAINEL_DOSSIES_LOTE.set(key, { dossie, ctx });

  return `<td class="dossie-col">
    <button type="button" class="dossie-lote-card" data-abrir-dossie data-dossie-key="${U.esc(key)}" title="Abrir Dossiê do lote">
      <span>Dossiê do lote</span>
      <strong>${dossie.encontrados}/${dossie.total}</strong>
      <small>${U.esc(resumoLinks)}</small>
    </button>
  </td>`;
}

function dossieKey(ctx) {
  return [
    ctx?.lote?.id || '',
    ctx?.lote?.lote || '',
    ctx?.serieRef?.fornecedor || '',
    ctx?.serieRef?.projeto || '',
    ctx?.serieRef?.bitola || '',
    ctx?.serieRef?.serie || '',
  ].map(v => String(v).trim()).join('|');
}

function abrirDossieLote(key) {
  const registro = PAINEL_DOSSIES_LOTE.get(String(key || ''));
  if (!registro) {
    App.toast('Não foi possível abrir o dossiê deste lote. Atualize o fluxo e tente novamente.', 'erro');
    return;
  }

  fecharDossieLote();

  const { dossie, ctx } = registro;
  const lote = ctx?.lote || {};
  const serie = ctx?.serieRef || {};
  const linksTexto = dossie.links.length ? `${dossie.links.length} link(s) de relatório` : 'Sem links de relatório';
  const overlay = document.createElement('div');
  overlay.className = 'dossie-modal-backdrop';
  overlay.innerHTML = `
    <section class="dossie-modal" role="dialog" aria-modal="true" aria-labelledby="dossieModalTitulo">
      <header class="dossie-modal-cabecalho">
        <div>
          <span>Dossiê do lote</span>
          <h3 id="dossieModalTitulo">Lote ${U.esc(lote.lote || '—')}</h3>
          <p>${U.esc(serie.projeto || '—')} · ${U.esc(serie.bitola || '—')} · ${U.esc(serie.fornecedor || '—')} · ${U.esc(serie.serie || '—')}</p>
        </div>
        <button type="button" class="dossie-modal-fechar" data-fechar-dossie aria-label="Fechar dossiê">×</button>
      </header>

      <div class="dossie-modal-resumo">
        <span><b>${dossie.encontrados}/${dossie.total}</b> grupos com registro</span>
        <span><b>${U.esc(linksTexto)}</b></span>
        <span><b>${ctx?.loteDeEnsaio ? 'Lote de ensaio' : 'Acompanha a série'}</b></span>
      </div>

      <div class="dossie-lista dossie-modal-lista">
        ${dossie.itens.map(dossieItemHtml).join('')}
      </div>
    </section>
  `;

  document.body.appendChild(overlay);
  document.body.classList.add('dossie-modal-aberto');
  overlay.querySelector('[data-fechar-dossie]')?.focus();
}

function fecharDossieLote() {
  document.querySelector('.dossie-modal-backdrop')?.remove();
  document.body.classList.remove('dossie-modal-aberto');
}

function dossieItemHtml(item) {
  const icones = { ok: '✓', aviso: '●', erro: '!', pendente: '—' };
  const resumo = item.encontrado ? `${item.registros.length} registro(s)` : item.vazio;
  const registros = item.encontrado
    ? item.registros.slice(0, 4).map(registroDossieHtml).join('') + (item.registros.length > 4 ? `<span class="dossie-mais">+${item.registros.length - 4} outro(s) registro(s)</span>` : '')
    : `<span class="dossie-vazio">Sem registro encontrado</span>`;
  return `<div class="dossie-item ${item.status}">
    <div class="dossie-item-topo">
      <b>${icones[item.status] || '—'}</b>
      <div><strong>${U.esc(item.titulo)}</strong><span>${U.esc(resumo)}</span></div>
      <a href="${U.esc(item.pagina)}" title="Abrir módulo" target="_self">módulo</a>
    </div>
    <div class="dossie-registros">${registros}</div>
  </div>`;
}

function registroDossieHtml(r) {
  const data = U.dataBR(r.data || r.dataEnsaio || r.dataInspecao || r.dataFabricacao);
  const resultado = r.resultado || 'Registrado';
  const lote = r.lote ? ` · lote ${r.lote}` : '';
  const detalhes = r.detalhes ? ` · ${r.detalhes}` : '';
  const relacao = r.relacao ? ` · ${r.relacao}` : '';
  const link = hrefRelatorioDossie(r.linkRelatorio);
  return `<span class="dossie-registro ${resultadoClasseDossie(r)}">
    <em>${U.esc(data)} · ${U.esc(resultado)}${U.esc(lote)}${U.esc(relacao)}${U.esc(detalhes)}</em>
    ${link ? `<a href="${U.esc(link)}" target="_blank" rel="noopener">relatório</a>` : ''}
  </span>`;
}

function hrefRelatorioDossie(link) {
  const v = String(link || '').trim();
  if (!v) return '';
  if (/^(https?:|mailto:|file:)/i.test(v)) return v;
  return `https://${v}`;
}

function resumoDossieExport(dossie) {
  return (dossie?.itens || []).map(i => {
    const status = i.encontrado ? `${i.registros.length} registro(s)` : 'sem registro';
    return `${i.titulo}: ${status}`;
  }).join(' | ');
}

function linksDossieExport(dossie) {
  const links = [];
  (dossie?.itens || []).forEach(i => {
    (i.registros || []).forEach(r => {
      if (r.linkRelatorio) links.push(`${i.titulo}: ${r.linkRelatorio}`);
    });
  });
  return links.join(' | ');
}

function etapasDoLote(ctx, hoje) {
  const { lote, serieRef: s } = ctx;
  const ens14 = (s.ensaios14 || []).filter(e => e.resultado);
  const ens28 = (s.ensaios28 || []).filter(e => e.resultado);
  const aprovado14 = ens14.find(e => e.resultado === 'Aprovado');
  const reprovado14 = ens14.find(e => e.resultado === 'Reprovado');
  const primeiro14 = aprovado14 || reprovado14 || ens14[0] || null;
  const ens28ComResultado = ens28.filter(e => e.resultado === 'Aprovado' || e.resultado === 'Reprovado');
  const primeiro28 = ens28ComResultado[0] || null;
  const contra = primeiro28 ? ens28ComResultado.slice(1) : [];
  const contraAprovados = contra.filter(e => e.resultado === 'Aprovado');
  const contraReprovados = contra.filter(e => e.resultado === 'Reprovado');

  // Em cura térmica os 28 dias são obrigatórios: não dependem de reprova no
  // ensaio de 14 dias, que ali é só acompanhamento e não libera nada.
  const termica = !!s.curaTermica;
  const cura14Ok = !!(s.cura14 && hoje >= s.cura14) || !!primeiro14 || !!primeiro28 || s.statusChave === 'liberado' || s.statusChave === 'travado';
  const cura28Disparada = termica || !!reprovado14;
  const cura28Ok = cura28Disparada && (!!(s.cura28 && hoje >= s.cura28) || !!primeiro28 || s.statusChave === 'liberado' || s.statusChave === 'travado');
  const contraDisparado = primeiro28?.resultado === 'Reprovado';
  const contraOk = contraDisparado && contraAprovados.length >= 2 && !contraReprovados.length;
  const liberado = s.statusChave === 'liberado';
  const travado = s.statusChave === 'travado';

  return [
    etapa('produzido', 'Produzido', lote.dataFabricacao ? 'feito' : 'pendente', U.dataBR(lote.dataFabricacao), `${formatNumero(lote.total)} peça(s)`),
    etapa('cura14', 'Cura 14 dias', cura14Ok ? 'feito' : (s.statusChave === 'cura14' || s.statusChave === 'formando' ? 'atual' : 'pendente'), detalheCura(s.cura14, hoje), `Base: último lote ${s.ultimoLote?.lote || '—'}`),
    etapa('ensaio14', termica ? 'Acompanhamento 14 dias' : 'Ensaio 14 dias', estadoEnsaio(primeiro14, s.statusChave === 'aguardando14' || s.statusChave === 'pendente'), detalheEnsaio(primeiro14, termica ? 'Informativo — não libera' : 'Aguardando ensaio'), resultadoCurto(primeiro14)),
    etapa('aguardando28', 'Aguardando 28 dias', cura28Disparada ? (s.statusChave === 'cura28' || s.statusChave === 'aguardando28' ? 'atual' : 'feito') : 'pendente', termica ? 'Obrigatório na cura térmica' : (reprovado14 ? '14d reprovado' : 'Só ativa se reprovar 14d'), s.cura28 ? `Ensaio a partir de ${U.dataBR(s.cura28)}` : ''),
    etapa('cura28', 'Cura 28 dias', cura28Ok ? 'feito' : (s.statusChave === 'cura28' ? 'atual' : 'pendente'), cura28Disparada ? detalheCura(s.cura28, hoje) : 'Não acionada', `Base: último lote ${s.ultimoLote?.lote || '—'}`),
    etapa('ensaio28', 'Ensaio 28 dias', estadoEnsaio(primeiro28, s.statusChave === 'aguardando28'), detalheEnsaio(primeiro28, cura28Disparada ? 'Aguardando ensaio' : 'Não acionado'), resultadoCurto(primeiro28)),
    etapa('contraensaios', '2 contraensaios', contraReprovados.length ? 'erro' : (contraOk ? 'feito' : (contraDisparado ? 'atual' : 'pendente')), contraDisparado ? `${contraAprovados.length}/2 aprovado(s)` : 'Só ativa se reprovar 28d', contraReprovados.length ? 'Contraensaio reprovado' : (contraOk ? 'Dois aprovados' : '')), 
    etapa('liberado', 'Liberado', liberado ? 'feito' : 'pendente', liberado ? U.dataBR((s.liberadoPor || {}).dataEnsaio) : 'Aguardando aprovação', liberado ? (s.detalheFluxo || 'Série liberada') : ''),
    etapa('coordenacao', 'Coordenação', travado ? 'erro' : 'pendente', travado ? 'Série travada' : 'Só aparece se houver reprova final', travado ? (s.detalheFluxo || 'Decisão necessária') : ''),
  ];
}

function etapa(key, titulo, estado, detalhe, extra = '') {
  return { key, titulo, estado, detalhe, extra };
}

function estadoEnsaio(ensaio, ativo) {
  if (!ensaio) return ativo ? 'atual' : 'pendente';
  if (ensaio.resultado === 'Reprovado') return 'erro';
  if (ensaio.resultado === 'Pendente') return 'atual';
  return 'feito';
}

function etapaHtml(e) {
  const icones = { feito: '✓', atual: '●', pendente: '—', erro: '!' };
  return `<td class="etapa-cell ${e.estado} etapa-${e.key}">
    <div class="etapa-box">
      <b>${icones[e.estado] || '—'}</b>
      <span>${U.esc(e.titulo)}</span>
      <small>${U.esc(e.detalhe || '—')}</small>
      ${e.extra ? `<em>${U.esc(e.extra)}</em>` : ''}
    </div>
  </td>`;
}

function detalheCura(dataFim, hoje) {
  if (!dataFim) return 'Sem data base';
  const diff = FluxoLiberacao.diffDias(hoje, dataFim);
  if (diff == null) return U.dataBR(dataFim);
  if (diff > 0) return `Faltam ${diff} dia(s) · ${U.dataBR(dataFim)}`;
  if (diff === 0) return `Vence hoje · ${U.dataBR(dataFim)}`;
  return `Concluída em ${U.dataBR(dataFim)}`;
}

function detalheEnsaio(ensaio, fallback) {
  if (!ensaio) return fallback;
  return `${U.dataBR(ensaio.dataEnsaio)} · lote ${ensaio.lote || '—'}`;
}

function resultadoCurto(ensaio) {
  return ensaio?.resultado || '';
}

function registrarExportacaoPainelSeries(linhas, dados) {
  if (!window.Exportacoes) return;
  Exportacoes.registrar({
    titulo: 'Fluxo de Liberação',
    nomeArquivo: 'fluxo-liberacao-lotes',
    filtros: Exportacoes.filtrosDaTela(),
    secoes: [{
      titulo: 'Fluxo horizontal por lote',
      columns: [
        { key: 'fornecedor', label: 'Fábrica' },
        { key: 'projeto', label: 'Projeto' },
        { key: 'bitola', label: 'Bitola' },
        { key: 'serie', label: 'Série' },
        { key: 'lote', label: 'Lote' },
        { key: 'dataFabricacao', label: 'Produzido em' },
        { key: 'total', label: 'Qtd. produzida' },
        { key: 'loteDeEnsaio', label: 'Lote de ensaio' },
        { key: 'statusSerie', label: 'Status atual da série' },
        { key: 'ultimoLoteSerie', label: 'Último lote da série' },
        { key: 'lotesVinculados', label: 'Lotes vinculados' },
        { key: 'dossieResumo', label: 'Dossiê do lote' },
        { key: 'dossieLinks', label: 'Links de relatórios do dossiê' },
        ...ETAPAS_EXPORT.map(k => ({ key: k, label: nomeEtapaExport(k) })),
      ],
      rows: linhas.map(ctx => linhaExport(ctx, dados.hoje)),
    }]
  });
}

function linhaExport(ctx, hoje) {
  const { lote, serieRef: s, loteDeEnsaio } = ctx;
  const etapas = Object.fromEntries(etapasDoLote(ctx, hoje).map(e => [e.key, `${e.estado.toUpperCase()} - ${e.detalhe || ''} ${e.extra || ''}`.trim()]));
  return {
    fornecedor: s.fornecedor,
    projeto: s.projeto,
    bitola: s.bitola,
    serie: s.serie,
    lote: lote.lote,
    dataFabricacao: U.dataBR(lote.dataFabricacao),
    total: lote.total,
    loteDeEnsaio: loteDeEnsaio ? 'Sim' : 'Não, acompanha a série',
    statusSerie: s.status,
    ultimoLoteSerie: s.ultimoLote?.lote || '',
    lotesVinculados: (s.lotes || []).map(l => l.lote).filter(Boolean).join(', '),
    dossieResumo: resumoDossieExport(ctx.dossie || montarDossieLote(ctx)),
    dossieLinks: linksDossieExport(ctx.dossie || montarDossieLote(ctx)),
    ...etapas,
  };
}

function nomeEtapaExport(k) {
  return {
    produzido: 'Produzido',
    cura14: 'Cura 14 dias',
    ensaio14: 'Ensaio 14 dias',
    aguardando28: 'Aguardando 28 dias',
    cura28: 'Cura 28 dias',
    ensaio28: 'Ensaio 28 dias',
    contraensaios: '2 contraensaios',
    liberado: 'Liberado transporte',
    coordenacao: 'Coordenação/especialistas',
  }[k] || k;
}

function mapProducaoPainel(r) {
  return {
    id: r.id,
    fornecedor: r.fornecedor || '',
    pedido: r.pedido || '',
    lote: r.lote || '',
    projeto: normalizarProjeto(r.projeto || ''),
    bitola: r.bitola || '',
    tipo: r.tipo_dormente || '',
    total: valorBanco(r.total_produzido),
    dataFabricacao: dataBanco(r.data_fabricacao),
    serie: r.serie || '',
    status: r.status || '',
    // Sem este campo o motor trata toda série como cura normal e libera no
    // ensaio de 14 dias. Em cura térmica os 14 dias são só acompanhamento:
    // a liberação vem exclusivamente do ensaio de 28 dias.
    curaTermica: !!r.cura_termica,
    origem: r,
  };
}

function mapEnsaioPainel(r) {
  return {
    id: r.id,
    producaoLoteId: r.producao_lote_id || '',
    dataEnsaio: dataBanco(r.data_ensaio),
    fornecedor: r.fornecedor || '',
    projeto: normalizarProjeto(r.projeto || ''),
    bitola: r.bitola || '',
    lote: r.lote_ensaiado || '',
    serieLiberada: r.serie_liberada || '',
    resultado: normalizarResultado(r.resultado || ''),
    quantidadeEnsaiada: valorBanco(r.quantidade_ensaiada),
    responsavel: r.responsavel || '',
    linkRelatorio: r.link_relatorio_iauditor || '',
    observacoes: r.observacoes || '',
    origem: r,
  };
}

function mapInspecaoConcretagemPainel(r) {
  return {
    id: r.id,
    data: dataBanco(r.data_inspecao),
    lote: r.lote || '',
    projeto: normalizarProjeto(r.projeto || ''),
    bitola: r.bitola || '',
    fornecedor: r.fornecedor || '',
    pista: r.pista || '',
    molde: r.molde || '',
    cavidade: r.cavidade || '',
    resultado: r.resultado || 'Registrado',
    responsavel: r.responsavel || '',
    linkRelatorio: r.link_relatorio || '',
    arquivoOrigem: r.arquivo_origem || '',
    detalhes: [r.pista && `pista ${r.pista}`, r.molde && `molde ${r.molde}`, r.cavidade && `cav. ${r.cavidade}`, r.temperatura_lancamento && `temp. ${r.temperatura_lancamento}`, r.slump_abatimento && `abat. ${r.slump_abatimento}`].filter(Boolean).join(' · '),
    origem: r,
  };
}

function mapInspecaoPistaPainel(r) {
  return {
    id: r.id,
    data: dataBanco(r.data_inspecao),
    lote: r.lote || '',
    projeto: normalizarProjeto(r.projeto || ''),
    bitola: r.bitola || '',
    fornecedor: r.fornecedor || '',
    pista: r.pista || '',
    molde: r.molde || '',
    cavidade: r.cavidade || '',
    resultado: r.resultado || 'Registrado',
    responsavel: r.responsavel || '',
    linkRelatorio: r.link_relatorio || '',
    arquivoOrigem: r.arquivo_origem || '',
    detalhes: [r.pista && `pista ${r.pista}`, r.molde && `molde ${r.molde}`, r.cavidade && `cav. ${r.cavidade}`, (r.reprovados || r.quantidade_reprovados) && `reprovados ${r.reprovados || r.quantidade_reprovados}`, r.atividade].filter(Boolean).join(' · '),
    origem: r,
  };
}

function mapEnsaioBitolaPainel(r) {
  return {
    id: r.id,
    data: dataBanco(r.data_ensaio),
    lote: r.lote || '',
    projeto: normalizarProjeto(r.projeto || ''),
    bitola: r.bitola || '',
    fornecedor: r.fornecedor || '',
    resultado: r.resultado || 'Registrado',
    responsavel: r.responsavel || '',
    linkRelatorio: r.link_relatorio || '',
    arquivoOrigem: r.arquivo_origem || '',
    detalhes: r.observacoes || '',
    origem: r,
  };
}

function mapArrancamentoUspPainel(r) {
  return {
    id: r.id,
    data: dataBanco(r.data_ensaio),
    lote: r.lote || '',
    projeto: normalizarProjeto(r.projeto || ''),
    bitola: r.bitola || '',
    fornecedor: r.fornecedor || '',
    usp: r.usp || '',
    tipoOmbreira: r.tipo_ombreira || '',
    loteOmbreira: r.lote_ombreira || '',
    resultado: r.resultado || 'Registrado',
    responsavel: r.responsavel || '',
    linkRelatorio: r.link_relatorio || '',
    arquivoOrigem: r.arquivo_origem || '',
    detalhes: [r.usp && `USP ${r.usp}`, r.tipo_ombreira, r.lote_ombreira && `ombreira ${r.lote_ombreira}`, r.arrancamento_a && `A ${r.arrancamento_a}`, r.arrancamento_b && `B ${r.arrancamento_b}`, r.arrancamento_c && `C ${r.arrancamento_c}`].filter(Boolean).join(' · '),
    origem: r,
  };
}

function normalizarProjeto(p) {
  const n = norm(p);
  if (n.includes('FERRO')) return 'FERRO NORTE';
  if (n.includes('FMT')) return 'FMT';
  if (n.includes('MALHA CENTRAL')) return 'MALHA CENTRAL';
  if (n.includes('MALHA PAULISTA')) return 'MALHA PAULISTA';
  return p || '';
}

function normalizarResultado(v) {
  const n = norm(v);
  if (n.includes('APROV')) return 'Aprovado';
  if (n.includes('REPROV') || n.includes('RECUS')) return 'Reprovado';
  if (n.includes('PEND')) return 'Pendente';
  return v || '';
}

function valorBanco(v) { return v == null ? '' : String(v); }
function dataBanco(v) { return v ? String(v).slice(0, 10) : ''; }
function formatNumero(v) { return (Number.parseInt(String(v || '0').replace(/[^0-9-]/g, ''), 10) || 0).toLocaleString('pt-BR'); }

function mensagemErroBanco(err, padrao) {
  const msg = err?.message || err?.details || '';
  if (!msg) return padrao;
  if (/row-level security|violates row-level security/i.test(msg)) return 'Acesso bloqueado pelas regras de segurança do Supabase. Confira seu perfil em usuarios_app.';
  if (/JWT|token|auth/i.test(msg)) return 'Sessão expirada ou inválida. Saia e faça login novamente.';
  return msg;
}

function periodoUltimaProducao() {
  const datas = PAINEL_PRODUCAO.map(r => r.dataFabricacao).filter(Boolean).sort();
  const ultima = datas.pop();
  return ultima ? U.periodoSemanaOperacional(ultima) : null;
}

function dentroPeriodo(iso, ini, fim) {
  if (!ini && !fim) return true;
  if (!iso) return false;
  if (ini && iso < ini) return false;
  if (fim && iso > fim) return false;
  return true;
}

function ordemProducao(a, b) {
  return String(a.dataFabricacao || '').localeCompare(String(b.dataFabricacao || '')) || ordemLote(a.lote, b.lote);
}

function ordemLote(a, b) {
  const na = parseInt(a, 10), nb = parseInt(b, 10);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return String(a || '').localeCompare(String(b || ''), 'pt-BR', { numeric: true });
}

function mesmoLote(a, b) {
  if (!a || !b) return false;
  if (a.id && b.id && String(a.id) === String(b.id)) return true;
  return norm(a.lote) && norm(a.lote) === norm(b.lote);
}

function norm(v) {
  return String(v == null ? '' : v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
}
