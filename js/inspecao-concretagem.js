/* =====================================================================
   INSPECAO-CONCRETAGEM.JS — Histórico consultivo de inspeções de concretagem.
   Independente das demais telas: leitura de iAuditor + registro com link.
   ===================================================================== */
let CONCRETAGEM_REGISTROS = [];
let CONCRETAGEM_CARREGANDO = false;
let CONCRETAGEM_ERRO = '';
let CONCRETAGEM_TABELA_FALTANDO = false;
let IAUDITOR_RELATORIO_ATUAL = null;

const CAMPOS_CONCRETAGEM = [
  'dataInspecao', 'lote', 'projeto', 'bitola', 'fornecedor', 'resultado', 'responsavel',
  'pista', 'molde', 'cavidade', 'quantidadeProduzida', 'slumpAbatimento', 'slumpEspalhamento',
  'temperaturaLancamento', 'linkRelatorio', 'arquivoOrigem', 'observacoes'
];
const RESULTADOS_CONCRETAGEM = ['Aprovado', 'Reprovado', 'Pendente'];

const PALAVRAS_CONCRETAGEM = [
  'concretagem', 'slump', 'abatimento', 'espalhamento', 'temperatura de lancamento',
  'temperatura lancamento', 'lancamento do concreto', 'informacoes da concretagem',
  'inspecao de concretagem', 'data da fabricacao inspecao'
];

const CHAVES_LEITURA_CONCRETAGEM = [
  'concretagem', 'slump', 'abatimento', 'espalhamento', 'temperatura', 'lançamento', 'lancamento',
  'pista', 'molde', 'cavidade', 'quantidade produzida', 'produção', 'producao', 'concreto'
];

const CHAVES_ESTRUTURAIS_NAO_CONCRETAGEM = [
  'arrancamento', 'ensaio de bitola', 'regua de bitola', 'régua de bitola',
  'momento positivo', 'momento negativo', 'carga ultima', 'carga última', 'aderencia', 'aderência'
];

document.addEventListener('DOMContentLoaded', async () => {
  if (!await Auth.exigirLogin()) return;
  document.body.classList.add('pagina-ensaios-liberacao');
  App.montarLayout('inspecaoConcretagem', 'Inspeção de Concretagem', 'Histórico consultivo de inspeções de concretagem — abre o relatório pelo link');
  App.acoesTopo(`
    <button class="btn btn-secundario" onclick="abrirImportadorIauditor()">${ICN.upload}Importar PDF iAuditor</button>
    ${Auth.pode('criar') ? `<button class="btn btn-primario" onclick="abrirNovo()">${ICN.add}Novo relatório</button>` : App.avisoModoConsulta()}
  `);

  preencherSelect('projeto', CFG.listas.projetos, 'Selecione...');
  preencherSelect('bitola', CFG.listas.bitolas, 'Selecione...');
  preencherSelect('fornecedor', CFG.listas.fornecedores, 'Selecione...');
  preencherSelect('resultado', RESULTADOS_CONCRETAGEM, 'Selecione...');

  preencherSelect('fFornecedor', CFG.listas.fornecedores, 'Todos');
  preencherSelect('fProjeto', CFG.listas.projetos, 'Todos');
  preencherSelect('fBitola', CFG.listas.bitolas, 'Todas');
  preencherSelect('fResultado', RESULTADOS_CONCRETAGEM, 'Todos');

  ['busca', 'fFornecedor', 'fProjeto', 'fBitola', 'fResultado', 'fDataIni', 'fDataFim'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.addEventListener('input', render); el.addEventListener('change', render); }
  });

  inicializarLeitorIauditor();
  render();
  await carregar();
});

function preencherSelect(id, arr, ph) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = U.opcoes(arr, '', ph);
}

/* ---------------------------------------------------------------------
   Carregamento e persistência
   --------------------------------------------------------------------- */
async function carregar() {
  CONCRETAGEM_CARREGANDO = true;
  CONCRETAGEM_ERRO = '';
  CONCRETAGEM_TABELA_FALTANDO = false;
  render();
  try {
    await Auth.exigirLogin();
    const dados = await StoreSupabase.listarInspecoesConcretagem({ limite: 5000 });
    CONCRETAGEM_REGISTROS = (dados || []).map(mapDoBanco);
    CONCRETAGEM_CARREGANDO = false;
    render();
  } catch (err) {
    console.error('Erro ao carregar inspeções de concretagem', err);
    CONCRETAGEM_CARREGANDO = false;
    if (tabelaInexistente(err)) {
      CONCRETAGEM_TABELA_FALTANDO = true;
    } else {
      CONCRETAGEM_ERRO = mensagemErro(err, 'Não foi possível carregar as inspeções de concretagem do Supabase.');
      App.toast(CONCRETAGEM_ERRO, 'erro');
    }
    render();
  }
}

function mapDoBanco(row) {
  return {
    id: row.id,
    dataInspecao: row.data_inspecao || '',
    lote: row.lote || '',
    projeto: row.projeto || '',
    bitola: row.bitola || '',
    fornecedor: row.fornecedor || '',
    pista: row.pista || '',
    molde: row.molde || '',
    cavidade: row.cavidade || '',
    quantidadeProduzida: row.quantidade_produzida || '',
    slumpAbatimento: row.slump_abatimento || '',
    slumpEspalhamento: row.slump_espalhamento || '',
    temperaturaLancamento: row.temperatura_lancamento || '',
    resultado: row.resultado || '',
    responsavel: row.responsavel || '',
    linkRelatorio: row.link_relatorio || '',
    arquivoOrigem: row.arquivo_origem || '',
    observacoes: row.observacoes || '',
    criadoEm: row.criado_em || ''
  };
}

function mapParaBanco(reg) {
  const payload = {
    data_inspecao: reg.dataInspecao || null,
    lote: reg.lote || null,
    projeto: reg.projeto || null,
    bitola: reg.bitola || null,
    fornecedor: reg.fornecedor || null,
    pista: reg.pista || null,
    molde: reg.molde || null,
    cavidade: reg.cavidade || null,
    quantidade_produzida: reg.quantidadeProduzida || null,
    slump_abatimento: reg.slumpAbatimento || null,
    slump_espalhamento: reg.slumpEspalhamento || null,
    temperatura_lancamento: reg.temperaturaLancamento || null,
    resultado: reg.resultado || null,
    responsavel: reg.responsavel || null,
    link_relatorio: reg.linkRelatorio || null,
    arquivo_origem: reg.arquivoOrigem || null,
    observacoes: reg.observacoes || null,
  };
  if (reg.id) payload.id = reg.id;
  return payload;
}

/* ---------------------------------------------------------------------
   Filtro / render
   --------------------------------------------------------------------- */
function filtros() {
  return {
    busca: document.getElementById('busca')?.value.toLowerCase().trim() || '',
    fornecedor: document.getElementById('fFornecedor')?.value || '',
    projeto: document.getElementById('fProjeto')?.value || '',
    bitola: document.getElementById('fBitola')?.value || '',
    resultado: document.getElementById('fResultado')?.value || '',
    dataIni: document.getElementById('fDataIni')?.value || '',
    dataFim: document.getElementById('fDataFim')?.value || '',
  };
}

function render() {
  const todos = CONCRETAGEM_REGISTROS;
  const f = filtros();
  const lista = todos.filter(r => {
    if (f.fornecedor && r.fornecedor !== f.fornecedor) return false;
    if (f.projeto && r.projeto !== f.projeto) return false;
    if (f.bitola && r.bitola !== f.bitola) return false;
    if (f.resultado && r.resultado !== f.resultado) return false;
    if (f.dataIni && (r.dataInspecao || '') < f.dataIni) return false;
    if (f.dataFim && (r.dataInspecao || '') > f.dataFim) return false;
    if (f.busca) {
      const blob = `${r.lote} ${r.projeto} ${r.bitola} ${r.fornecedor} ${r.pista} ${r.molde} ${r.cavidade} ${r.quantidadeProduzida} ${r.slumpAbatimento} ${r.slumpEspalhamento} ${r.temperaturaLancamento} ${r.resultado} ${r.responsavel} ${r.linkRelatorio} ${r.arquivoOrigem} ${r.observacoes}`.toLowerCase();
      if (!blob.includes(f.busca)) return false;
    }
    return true;
  }).sort((a, b) => (b.dataInspecao || '').localeCompare(a.dataInspecao || '') || String(b.criadoEm || '').localeCompare(String(a.criadoEm || '')));

  renderKpis(lista);
  renderTabela(lista, todos.length);
}

function renderKpis(lista) {
  const aprovados = lista.filter(r => r.resultado === 'Aprovado').length;
  const reprovados = lista.filter(r => r.resultado === 'Reprovado').length;
  const pendentes = lista.filter(r => r.resultado === 'Pendente').length;
  const comLink = lista.filter(r => String(r.linkRelatorio || '').trim()).length;
  const alvo = document.getElementById('kpis');
  if (!alvo) return;
  alvo.innerHTML = `
    <div class="kpi escuro"><div class="rotulo">Inspeções no filtro</div><div class="valor">${lista.length}</div><div class="extra">registros no histórico</div></div>
    <div class="kpi verde"><div class="rotulo">Aprovadas</div><div class="valor">${aprovados}</div><div class="extra">concretagem conforme</div></div>
    <div class="kpi vermelho"><div class="rotulo">Reprovadas</div><div class="valor">${reprovados}</div><div class="extra">concretagem não conforme</div></div>
    <div class="kpi amarelo"><div class="rotulo">Pendentes</div><div class="valor">${pendentes}</div><div class="extra">aguardando conclusão</div></div>
    <div class="kpi"><div class="rotulo">Com relatório</div><div class="valor">${comLink}</div><div class="extra">links anexados</div></div>`;
}

function renderTabela(lista, total) {
  const contador = document.getElementById('contador');
  if (contador) contador.textContent = CONCRETAGEM_CARREGANDO ? 'Carregando do Supabase...' : `${lista.length} de ${total} registro(s)`;

  const alvo = document.getElementById('lista');
  if (!alvo) return;

  if (CONCRETAGEM_CARREGANDO) {
    alvo.innerHTML = `<div class="vazio">${ICN.vazioBox}<h3>Carregando inspeções de concretagem</h3><p>Buscando registros no Supabase...</p></div>`;
    return;
  }
  if (CONCRETAGEM_TABELA_FALTANDO) {
    alvo.innerHTML = `<div class="vazio">${ICN.alerta}<h3>Tabela ainda não criada</h3>
      <p>Para ativar o histórico, rode no SQL Editor do Supabase o script <strong>supabase/2026-06-09-inspecoes-concretagem.sql</strong> incluído no projeto. Depois clique em tentar novamente.</p>
      <button class="btn btn-secundario" onclick="carregar()">Tentar novamente</button></div>`;
    return;
  }
  if (CONCRETAGEM_ERRO) {
    alvo.innerHTML = `<div class="vazio">${ICN.alerta}<h3>Erro ao carregar</h3><p>${U.esc(CONCRETAGEM_ERRO)}</p><button class="btn btn-secundario" onclick="carregar()">Tentar novamente</button></div>`;
    return;
  }
  if (!lista.length) {
    alvo.innerHTML = `<div class="vazio">${ICN.vazioBox}<h3>Nenhuma inspeção de concretagem registrada</h3><p>${total ? 'Ajuste os filtros ou' : 'Comece'} importando um PDF do iAuditor ou criando um relatório manual.</p></div>`;
    return;
  }

  alvo.innerHTML = `<div class="tabela-wrap"><table class="tabela">
    <thead><tr>
      <th>Data</th><th>Lote</th><th>Projeto</th><th>Bitola</th><th>Pista</th>
      <th>Resultado</th><th>Responsável</th><th>Relatório</th><th>Ações</th>
    </tr></thead>
    <tbody>${lista.map(r => `<tr>
      <td>${U.dataBR(r.dataInspecao)}</td>
      <td><strong>${U.esc(r.lote || '—')}</strong></td>
      <td>${U.badgeProjeto(r.projeto)}</td>
      <td>${badgeBitolaValor(r.bitola)}</td>
      <td>${U.esc(r.pista || '—')}</td>
      <td>${badgeResultado(r.resultado)}</td>
      <td>${U.esc(r.responsavel || '—')}</td>
      <td>${linkRelatorio(r)}</td>
      <td class="acoes-cel">
        <button class="icone-btn" title="Ver" onclick="ver('${r.id}')">${ICN.olho}</button>
        ${Auth.pode('editar') ? `<button class="icone-btn" title="Editar" onclick="editar('${r.id}')">${ICN.edit}</button>` : ''}
        ${Auth.pode('excluir') ? `<button class="icone-btn del" title="Excluir" onclick="excluir('${r.id}')">${ICN.del}</button>` : ''}
      </td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

function resumoSlump(r) {
  const itens = [r.slumpAbatimento && `Abat.: ${r.slumpAbatimento}`, r.slumpEspalhamento && `Esp.: ${r.slumpEspalhamento}`].filter(Boolean);
  return itens.length ? U.esc(itens.join(' · ')) : '—';
}
function badgeBitolaValor(bitola) {
  const cls = bitola === 'Bitola Larga' ? 'badge-bitola-larga' : bitola === 'Bitola Mista' ? 'badge-bitola-mista' : 'badge-bitola-sem';
  return `<span class="badge ${cls}">${U.esc(bitola || 'Sem bitola definida')}</span>`;
}
function badgeResultado(resultado) {
  const cls = resultado === 'Aprovado' ? 'badge-ok' : resultado === 'Reprovado' ? 'badge-reprovado' : 'badge-amarelo';
  return `<span class="badge ${cls}">${U.esc(resultado || '—')}</span>`;
}
function linkRelatorio(r) {
  const link = String(r.linkRelatorio || '').trim();
  if (!link) return '—';
  const href = /^https?:\/\//i.test(link) ? link : `https://${link}`;
  return `<a class="link-relatorio" href="${U.esc(href)}" target="_blank" rel="noopener">Abrir relatório</a>`;
}

/* ---------------------------------------------------------------------
   Modal manual / editar / ver / salvar / excluir
   --------------------------------------------------------------------- */
function abrirNovo() {
  if (!Auth.pode('criar')) { App.toast(Auth.mensagemSemPermissao('criar registros'), 'aviso'); return; }
  document.getElementById('form').reset();
  document.getElementById('id').value = '';
  setValor('dataInspecao', hojeISO());
  document.getElementById('modalTitulo').textContent = 'Nova inspeção de concretagem';
  document.getElementById('modal').classList.add('aberto');
}

function editar(id) {
  if (!Auth.pode('editar')) { App.toast(Auth.mensagemSemPermissao('editar registros'), 'aviso'); return; }
  const r = CONCRETAGEM_REGISTROS.find(x => x.id === id);
  if (!r) return;
  document.getElementById('form').reset();
  document.getElementById('id').value = r.id;
  CAMPOS_CONCRETAGEM.forEach(c => setValor(c, r[c] != null ? r[c] : ''));
  document.getElementById('modalTitulo').textContent = `Editar inspeção de concretagem — ${r.lote || ''}`;
  document.getElementById('modal').classList.add('aberto');
}

function lerFormulario() {
  const reg = {};
  CAMPOS_CONCRETAGEM.forEach(c => { reg[c] = (document.getElementById(c)?.value || '').trim(); });
  const id = document.getElementById('id').value;
  if (id) reg.id = id;
  return reg;
}

async function salvar() {
  if (!Auth.pode('criar') && !Auth.pode('editar')) { App.toast(Auth.mensagemSemPermissao('salvar registros'), 'aviso'); return; }
  const reg = lerFormulario();
  if (!reg.dataInspecao) { App.toast('Informe a data da inspeção.', 'aviso'); return; }
  if (!reg.linkRelatorio) { App.toast('Informe o link do relatório — é por ele que a inspeção será consultada.', 'aviso'); return; }

  try {
    const salvo = await StoreSupabase.salvarInspecaoConcretagem(mapParaBanco(reg));
    const convertido = mapDoBanco(salvo);
    const idx = CONCRETAGEM_REGISTROS.findIndex(x => x.id === convertido.id);
    if (idx >= 0) CONCRETAGEM_REGISTROS[idx] = convertido;
    else CONCRETAGEM_REGISTROS.unshift(convertido);
    fecharModal();
    render();
    App.toast('Inspeção de concretagem salva.');
  } catch (err) {
    console.error('Erro ao salvar inspeção de concretagem', err);
    App.toast(mensagemErro(err, 'Não foi possível salvar a inspeção de concretagem.'), 'erro');
  }
}

async function excluir(id) {
  if (!Auth.pode('excluir')) { App.toast(Auth.mensagemSemPermissao('excluir registros'), 'aviso'); return; }
  const r = CONCRETAGEM_REGISTROS.find(x => x.id === id);
  if (!App.confirmar(`Excluir a inspeção de concretagem${r?.lote ? ' do lote ' + r.lote : ''}? Esta ação não pode ser desfeita.`)) return;
  try {
    await StoreSupabase.removerInspecaoConcretagem(id);
    CONCRETAGEM_REGISTROS = CONCRETAGEM_REGISTROS.filter(x => x.id !== id);
    render();
    App.toast('Inspeção de concretagem excluída.');
  } catch (err) {
    console.error('Erro ao excluir inspeção de concretagem', err);
    App.toast(mensagemErro(err, 'Não foi possível excluir a inspeção de concretagem.'), 'erro');
  }
}

function ver(id) {
  const r = CONCRETAGEM_REGISTROS.find(x => x.id === id);
  if (!r) return;
  const link = String(r.linkRelatorio || '').trim();
  const href = link ? (/^https?:\/\//i.test(link) ? link : `https://${link}`) : '';
  document.getElementById('verTitulo').textContent = `Inspeção de concretagem — ${r.lote || U.dataBR(r.dataInspecao)}`;
  document.getElementById('verCorpo').innerHTML = `
    <div class="detalhe-grid">
      ${itemVer('Data', U.dataBR(r.dataInspecao))}
      ${itemVer('Lote', r.lote)}
      ${itemVer('Projeto', r.projeto)}
      ${itemVer('Bitola', r.bitola)}
      ${itemVer('Fornecedor', r.fornecedor)}
      ${itemVer('Pista', r.pista)}
      ${itemVer('Molde', r.molde)}
      ${itemVer('Cavidade', r.cavidade)}
      ${itemVer('Quantidade produzida', r.quantidadeProduzida)}
      ${itemVer('Slump — abatimento', r.slumpAbatimento)}
      ${itemVer('Slump — espalhamento', r.slumpEspalhamento)}
      ${itemVer('Temperatura de lançamento', r.temperaturaLancamento)}
      ${itemVer('Resultado', r.resultado)}
      ${itemVer('Responsável', r.responsavel)}
      ${itemVer('Arquivo de origem', r.arquivoOrigem)}
    </div>
    ${r.observacoes ? `<div class="detalhe-secao"><strong>Observações</strong><p style="white-space:pre-wrap">${U.esc(r.observacoes)}</p></div>` : ''}
    <div class="form-acoes">
      ${href ? `<a class="btn btn-primario" href="${U.esc(href)}" target="_blank" rel="noopener">${ICN.olho}Abrir relatório</a>` : '<span class="badge badge-amarelo">Sem link de relatório</span>'}
    </div>`;
  document.getElementById('modalVer').classList.add('aberto');
}

function itemVer(rot, val) {
  return `<div class="detalhe-item"><div class="rot txt-mini txt-cinza">${U.esc(rot)}</div><div class="val">${U.esc(val || '—')}</div></div>`;
}

function setValor(id, val) { const el = document.getElementById(id); if (el) el.value = val == null ? '' : val; }
function fecharModal() { document.getElementById('modal').classList.remove('aberto'); }
function fecharVer() { document.getElementById('modalVer').classList.remove('aberto'); }

/* ---------------------------------------------------------------------
   Leitor de iAuditor (PDF) — lê, valida Concretagem e oferece salvar direto
   --------------------------------------------------------------------- */
function inicializarLeitorIauditor() {
  const input = document.getElementById('iauditorPdfInput');
  const drop = document.getElementById('iauditorDropzone');
  const btn = document.getElementById('iauditorEscolherPdf');
  if (!input || !drop) return;

  btn?.addEventListener('click', (e) => { e.stopPropagation(); input.click(); });
  drop.addEventListener('click', (e) => { if (!e.target.closest('button')) input.click(); });
  drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  input.addEventListener('change', (e) => { const file = e.target.files?.[0]; if (file) lerRelatorioIauditor(file); input.value = ''; });
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('arrastando'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('arrastando'); }));
  drop.addEventListener('drop', (e) => { const file = e.dataTransfer?.files?.[0]; if (file) lerRelatorioIauditor(file); });
}

function abrirImportadorIauditor() {
  const card = document.getElementById('iauditorCard');
  card?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => document.getElementById('iauditorPdfInput')?.click(), 250);
}

async function lerRelatorioIauditor(file) {
  const alvo = document.getElementById('iauditorResultado');
  if (!alvo) return;
  if (!/\.pdf$/i.test(file.name)) { renderErroIauditor('Selecione um arquivo PDF exportado do iAuditor.'); return; }
  if (!window.pdfjsLib || !window.RumoParser) { renderErroIauditor('O leitor de PDF não foi carregado. Verifique sua conexão e recarregue a página.'); return; }

  IAUDITOR_RELATORIO_ATUAL = null;
  alvo.innerHTML = `<div class="iauditor-status"><h3>Lendo ${U.esc(file.name)}...</h3><p>Extraindo lote, projeto, dados de produção, slump e temperatura encontrados.</p></div>`;
  try {
    const pages = await extrairPaginasPdf(file);
    const data = RumoParser.parse(pages);
    const registro = montarRegistroIauditor(data, file.name);
    const valido = ehRelatorioConcretagem(data, registro, file.name);
    IAUDITOR_RELATORIO_ATUAL = { fileName: file.name, data, registro, valido };
    renderLeituraIauditor(IAUDITOR_RELATORIO_ATUAL);
  } catch (err) {
    console.error('Erro ao ler relatório iAuditor', err);
    renderErroIauditor('Não foi possível ler este PDF. Confira se é um relatório exportado do iAuditor e tente novamente.');
  }
}

async function extrairPaginasPdf(file) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const pages = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    const items = tc.items.filter(it => it.str && it.str.trim())
      .map(it => ({ str: it.str, x: it.transform[4], top: vp.height - it.transform[5], w: it.width || 0 }));
    pages.push({ pageNum: n, width: vp.width, height: vp.height, items });
    if (items.some(i => /resumo de m[ií]dia/i.test(i.str))) break;
  }
  return pages;
}

function montarRegistroIauditor(data, fileName) {
  const meta = data?.meta || {};
  const tipo = limparValor(meta['Tipo de relatório']) || inferirTipoRelatorio(data) || 'Inspeção de Concretagem';
  const linhas = linhasConcretagem(data);
  const lote = limparValor(meta['Lote'] || meta['Lote do dormente'] || meta['Lote ensaiado']);
  const projeto = normalizarProjeto(meta['Projeto'] || meta['Destino'] || tipo || '');
  const bitola = normalizarBitola(meta['Tipo de dormente'] || projeto || meta['Bitola'] || tipo || '');
  const fornecedor = normalizarFornecedor(meta['Fornecedor'] || '');
  const dataInspecao = dataPtParaISO(meta['Data da fabricação/inspeção'] || meta['Data de produção'] || meta['Data da fabricação'] || meta['Data do ensaio']) || hojeISO();
  const responsavel = limparValor(meta['Fiscal responsável'] || meta['Responsável'] || '');
  const resultado = inferirResultado(data, linhas);

  return {
    dataInspecao, lote, projeto, bitola, fornecedor, resultado, responsavel,
    pista: limparValor(meta['Pista'] || encontrarValor(linhas, ['pista'])),
    molde: limparValor(meta['Molde'] || encontrarValor(linhas, ['molde'])),
    cavidade: limparValor(meta['Cavidade'] || encontrarValor(linhas, ['cavidade'])),
    quantidadeProduzida: limparValor(meta['Quantidade produzida'] || encontrarValor(linhas, ['quantidade produzida', 'quantidadeproduzida'])),
    slumpAbatimento: limparValor(encontrarValor(linhas, ['slump test abatimento', 'slump abatimento', 'abatimento'])),
    slumpEspalhamento: limparValor(encontrarValor(linhas, ['slump test espalhamento', 'slump espalhamento', 'espalhamento'])),
    temperaturaLancamento: limparValor(encontrarValor(linhas, ['temperatura de lancamento', 'temperatura de lançamento', 'temperatura lancamento'])),
    linkRelatorio: '',
    arquivoOrigem: fileName,
    observacoes: montarObservacoes({ fileName, meta, tipo, linhas }),
    tipo, linhas
  };
}

function linhasConcretagem(data) {
  const linhas = [];
  (data?.sections || []).forEach(sec => {
    (sec.rows || []).forEach(row => {
      const item = {
        secao: sec.title || '—',
        campo: row.ensaio || row.name || '—',
        valor: row.valor != null ? String(row.valor) : '—',
        criterio: row.criterio || '',
        situacao: row.situacao || '',
        situacaoLabel: row.situacaoLabel || ''
      };
      const n = normTexto(`${item.secao} ${item.campo} ${item.valor} ${item.criterio}`);
      if (CHAVES_LEITURA_CONCRETAGEM.some(chave => n.includes(normTexto(chave)))) linhas.push(item);
    });
  });
  if (data?.conclusao) linhas.push({
    secao: 'Conclusão',
    campo: data.conclusao.ensaio || 'Conclusão',
    valor: data.conclusao.valor || '—',
    criterio: data.conclusao.criterio || '',
    situacao: data.conclusao.situacao || '',
    situacaoLabel: data.conclusao.situacaoLabel || ''
  });
  return linhas;
}

function encontrarValor(linhas, chaves) {
  const ns = (chaves || []).map(normTexto);
  const linha = (linhas || []).find(l => {
    const texto = normTexto(`${l.secao} ${l.campo}`);
    return ns.some(ch => texto.includes(ch));
  });
  return linha?.valor && linha.valor !== '—' ? linha.valor : '';
}

function inferirResultado(data, linhas) {
  if (data?.conclusao?.situacao === 'ok') return 'Aprovado';
  if (data?.conclusao?.situacao === 'fail') return 'Reprovado';
  if ((linhas || []).some(l => l.situacao === 'fail')) return 'Reprovado';
  if ((linhas || []).some(l => l.situacao === 'ok')) return 'Aprovado';
  return 'Pendente';
}

function ehRelatorioConcretagem(data, registro, fileName) {
  const parts = [fileName, registro?.tipo, registro?.pista, registro?.molde, registro?.cavidade, registro?.slumpAbatimento, registro?.slumpEspalhamento, registro?.temperaturaLancamento];
  const meta = data?.meta || {};
  Object.keys(meta).forEach(k => parts.push(k, meta[k]));
  (data?.sections || []).forEach(sec => {
    parts.push(sec.title);
    (sec.rows || []).forEach(row => parts.push(row.ensaio, row.name, row.valor, row.criterio, row.situacaoLabel));
  });
  const texto = normTexto(parts.join(' '));
  const temConcretagem = PALAVRAS_CONCRETAGEM.some(chave => texto.includes(normTexto(chave)));
  const temExclusivoOutroEnsaio = CHAVES_ESTRUTURAIS_NAO_CONCRETAGEM.some(chave => texto.includes(normTexto(chave))) && !temConcretagem;
  return temConcretagem && !temExclusivoOutroEnsaio;
}

function inferirTipoRelatorio(data) {
  const titulos = (data?.sections || []).map(s => s.title).filter(Boolean).join(' / ');
  return titulos || '';
}

function montarObservacoes({ fileName, meta, tipo, linhas }) {
  const cab = [
    'Registro importado do leitor de relatórios iAuditor.',
    `Arquivo: ${fileName}`,
    `Tipo de relatório: ${tipo || '—'}`,
  ];
  const metaTxt = Object.keys(meta || {}).slice(0, 16).map(k => `${k}: ${meta[k]}`).join(' | ');
  const det = (linhas || []).slice(0, 45).map(l => `- ${l.secao} · ${l.campo}: ${l.valor}${l.criterio ? ` (critério: ${l.criterio})` : ''}`);
  return cab.concat(metaTxt ? [`Metadados lidos: ${metaTxt}`] : [], det.length ? ['Leituras de concretagem:', ...det] : []).join('\n');
}

function renderLeituraIauditor(item) {
  const alvo = document.getElementById('iauditorResultado');
  if (!alvo) return;
  const r = item.registro;
  const linhasMostradas = (r.linhas || []).slice(0, 10);
  const podeCriar = Auth.pode('criar');
  const avisoNaoValido = !item.valido ? `
    <div class="iauditor-status erro" style="margin-bottom:12px">
      <h3>Relatório lido, mas não identificado como Inspeção de Concretagem</h3>
      <p>Esta página registra apenas inspeções de concretagem. Verifique se o PDF correto foi importado. A opção de salvar direto fica disponível somente para relatórios de concretagem identificados na leitura.</p>
    </div>` : '';
  alvo.innerHTML = `
    ${avisoNaoValido}
    <div class="iauditor-status ${item.valido ? 'ok' : ''}">
      <h3>${item.valido ? 'Inspeção de Concretagem lida — confira e salve no histórico' : 'Prévia da leitura'}</h3>
      <p>${item.valido ? 'Cole o link do relatório (SharePoint/iAuditor) e salve. Os campos abaixo podem ser ajustados antes.' : 'Os dados extraídos aparecem abaixo apenas para conferência.'}</p>
      <div class="iauditor-meta-grid">
        ${metaItem('Arquivo', item.fileName)}
        ${metaItem('Tipo', r.tipo)}
        ${metaItem('Lote', r.lote)}
        ${metaItem('Projeto', r.projeto)}
        ${metaItem('Bitola', r.bitola)}
        ${metaItem('Pista', r.pista)}
        ${metaItem('Molde', r.molde)}
        ${metaItem('Cavidade', r.cavidade)}
        ${metaItem('Qtd. produzida', r.quantidadeProduzida)}
        ${metaItem('Slump abatimento', r.slumpAbatimento)}
        ${metaItem('Slump espalhamento', r.slumpEspalhamento)}
        ${metaItem('Temperatura', r.temperaturaLancamento)}
        ${metaItem('Data', U.dataBR(r.dataInspecao))}
        ${metaItem('Responsável', r.responsavel)}
        ${metaItem('Resultado sugerido', r.resultado)}
      </div>
      ${podeCriar && item.valido ? `
      <div class="form-grid" style="margin-top:14px">
        <div class="campo full"><label>Link do relatório <span class="obrig">*</span></label><input id="iaLink" type="url" placeholder="https://..."></div>
      </div>
      <div class="iauditor-acoes">
        <button class="btn btn-primario" type="button" onclick="salvarLeituraIauditor()">${ICN.check}Salvar relatório</button>
        <button class="btn btn-secundario" type="button" onclick="preencherModalComLeitura()">Editar antes de salvar</button>
      </div>` : (podeCriar ? '<div class="iauditor-acoes"><span class="badge badge-amarelo">Este PDF não será salvo nesta página por não ter sido identificado como Inspeção de Concretagem.</span></div>' : '<div class="iauditor-acoes"><span class="badge badge-amarelo">Modo consulta: leitura sem registro</span></div>')}
      ${linhasMostradas.length ? `<div class="iauditor-mini-tabela"><table><thead><tr><th>Seção</th><th>Campo lido</th><th>Valor</th></tr></thead><tbody>${linhasMostradas.map(l => `<tr><td>${U.esc(l.secao)}</td><td>${U.esc(l.campo)}</td><td>${U.esc(l.valor)}</td></tr>`).join('')}</tbody></table></div>` : ''}
    </div>`;
}

function metaItem(rot, val) {
  return `<div class="iauditor-meta-item"><div class="rot">${U.esc(rot)}</div><div class="val">${U.esc(val || '—')}</div></div>`;
}

async function salvarLeituraIauditor() {
  if (!Auth.pode('criar')) { App.toast(Auth.mensagemSemPermissao('criar registros'), 'aviso'); return; }
  const atual = IAUDITOR_RELATORIO_ATUAL;
  if (!atual?.registro) { App.toast('Importe um PDF do iAuditor antes de salvar.', 'aviso'); return; }
  if (!atual.valido) { App.toast('Este PDF não foi identificado como Inspeção de Concretagem.', 'aviso'); return; }
  const link = (document.getElementById('iaLink')?.value || '').trim();
  if (!link) { App.toast('Cole o link do relatório antes de salvar.', 'aviso'); document.getElementById('iaLink')?.focus(); return; }

  const reg = {};
  CAMPOS_CONCRETAGEM.forEach(c => { reg[c] = atual.registro[c] != null ? atual.registro[c] : ''; });
  reg.linkRelatorio = link;

  const btn = document.querySelector('#iauditorResultado .btn-primario');
  const txt = btn?.innerHTML;
  if (btn) { btn.disabled = true; btn.innerHTML = 'Salvando...'; }
  try {
    const salvo = await StoreSupabase.salvarInspecaoConcretagem(mapParaBanco(reg));
    const convertido = mapDoBanco(salvo);
    CONCRETAGEM_REGISTROS.unshift(convertido);
    render();
    App.toast('Relatório de inspeção de concretagem salvo no histórico.');
    document.getElementById('iauditorResultado').innerHTML = `<div class="iauditor-status ok"><h3>Relatório salvo</h3><p>${U.esc(atual.fileName)} foi registrado no histórico de inspeções de concretagem. <a class="link-relatorio" href="${U.esc(/^https?:\/\//i.test(link) ? link : 'https://' + link)}" target="_blank" rel="noopener">Abrir relatório</a></p></div>`;
    IAUDITOR_RELATORIO_ATUAL = null;
  } catch (err) {
    console.error('Erro ao salvar leitura iAuditor', err);
    App.toast(mensagemErro(err, 'Não foi possível salvar o relatório de inspeção de concretagem.'), 'erro');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = txt || 'Salvar relatório'; }
  }
}

function preencherModalComLeitura() {
  if (!Auth.pode('criar')) { App.toast(Auth.mensagemSemPermissao('criar registros'), 'aviso'); return; }
  const atual = IAUDITOR_RELATORIO_ATUAL;
  if (!atual?.registro) { abrirNovo(); return; }
  if (!atual.valido) { App.toast('Este PDF não foi identificado como Inspeção de Concretagem.', 'aviso'); return; }
  const r = atual.registro;
  document.getElementById('form').reset();
  document.getElementById('id').value = '';
  CAMPOS_CONCRETAGEM.forEach(c => setValor(c, r[c] != null ? r[c] : ''));
  const ia = document.getElementById('iaLink')?.value?.trim();
  if (ia) setValor('linkRelatorio', ia);
  document.getElementById('modalTitulo').textContent = `Salvar leitura iAuditor — ${r.lote || ''}`;
  document.getElementById('modal').classList.add('aberto');
}

function renderErroIauditor(msg) {
  const alvo = document.getElementById('iauditorResultado');
  if (alvo) alvo.innerHTML = `<div class="iauditor-status erro"><h3>Não foi possível ler o relatório</h3><p>${U.esc(msg)}</p></div>`;
}

/* ---------------------------------------------------------------------
   Helpers de normalização (independentes)
   --------------------------------------------------------------------- */
function limparValor(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }
function normTexto(v) { return limparValor(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
function normLocal(v) { return String(v == null ? '' : v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ''); }
function hojeISO() { return new Date().toISOString().slice(0, 10); }

function normalizarFornecedor(valor) {
  const n = normLocal(valor);
  if (!n) return '';
  if (n.includes('cavan')) return 'Cavan SP';
  if (n.includes('conprem')) return 'Conprem MG';
  return (CFG.listas.fornecedores || []).find(f => n.includes(normLocal(f)) || normLocal(f).includes(n)) || limparValor(valor);
}
function normalizarProjeto(valor) {
  const n = normLocal(valor);
  if (!n) return '';
  if (n.includes('ferronorte') || /\bfn\b/i.test(valor)) return 'FERRO NORTE';
  if (n.includes('malhacentral') || /\bmc\b/i.test(valor)) return 'MALHA CENTRAL';
  if (n.includes('fmt')) return 'FMT';
  if (n.includes('malhapaulista') && n.includes('larga')) return 'MALHA PAULISTA BITOLA LARGA';
  if (n.includes('malhapaulista')) return 'MALHA PAULISTA BITOLA MISTA';
  return (CFG.listas.projetos || []).find(p => n.includes(normLocal(p)) || normLocal(p).includes(n)) || limparValor(valor);
}
function normalizarBitola(valor) {
  const n = normLocal(valor);
  if (n.includes('larga')) return 'Bitola Larga';
  if (n.includes('mista') || n.includes('metrica') || n.includes('metric')) return 'Bitola Mista';
  return '';
}
function dataPtParaISO(v) {
  const s = limparValor(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  let m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) { const ano = m[3].length === 2 ? '20' + m[3] : m[3]; return `${ano}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
  const semAcento = s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  m = semAcento.match(/(\d{1,2})\s+(jan|janeiro|fev|fevereiro|mar|marco|abr|abril|mai|maio|jun|junho|jul|julho|ago|agosto|set|setembro|out|outubro|nov|novembro|dez|dezembro)\.?\s+(\d{4})/);
  if (!m) return '';
  const meses = { jan: '01', janeiro: '01', fev: '02', fevereiro: '02', mar: '03', marco: '03', abr: '04', abril: '04', mai: '05', maio: '05', jun: '06', junho: '06', jul: '07', julho: '07', ago: '08', agosto: '08', set: '09', setembro: '09', out: '10', outubro: '10', nov: '11', novembro: '11', dez: '12', dezembro: '12' };
  return `${m[3]}-${meses[m[2]]}-${m[1].padStart(2, '0')}`;
}

function tabelaInexistente(err) {
  const msg = `${err?.message || ''} ${err?.details || ''} ${err?.hint || ''}`.toLowerCase();
  const code = String(err?.code || '');
  return code === 'PGRST205' || code === '42P01' || (msg.includes('inspecoes_concretagem') && (msg.includes('does not exist') || msg.includes('could not find') || msg.includes('schema cache')));
}
function mensagemErro(err, fallback) {
  const msg = err?.message || err?.error_description || '';
  if (/permission|rls|row-level|not allowed|sem permiss/i.test(msg)) return 'Você não tem permissão para esta ação.';
  return msg ? `${fallback} (${msg})` : fallback;
}

window.abrirNovo = abrirNovo;
window.editar = editar;
window.ver = ver;
window.salvar = salvar;
window.excluir = excluir;
window.fecharModal = fecharModal;
window.fecharVer = fecharVer;
window.carregar = carregar;
window.abrirImportadorIauditor = abrirImportadorIauditor;
window.salvarLeituraIauditor = salvarLeituraIauditor;
window.preencherModalComLeitura = preencherModalComLeitura;
