/* =====================================================================
   ENSAIO-BITOLA.JS — Histórico consultivo de ensaios de bitola.
   Independente das demais telas: leitura de iAuditor + registro com link opcional.
   ===================================================================== */
let BITOLA_REGISTROS = [];
let BITOLA_CARREGANDO = false;
let BITOLA_ERRO = '';
let BITOLA_TABELA_FALTANDO = false;
let IAUDITOR_RELATORIO_ATUAL = null;

const CAMPOS_BITOLA = [
  'dataEnsaio', 'lote', 'projeto', 'bitola', 'fornecedor',
  'resultado', 'responsavel', 'linkRelatorio', 'arquivoOrigem', 'observacoes'
];
const RESULTADOS_BITOLA = ['Aprovado', 'Reprovado', 'Pendente'];

document.addEventListener('DOMContentLoaded', async () => {
  if (!await Auth.exigirLogin()) return;
  document.body.classList.add('pagina-ensaios-liberacao');
  App.montarLayout('ensaioBitola', 'Ensaio de Bitola', 'Histórico consultivo de ensaios de bitola — link do relatório opcional');
  App.acoesTopo(`
    <button class="btn btn-secundario" onclick="abrirImportadorIauditor()">${ICN.upload}Importar PDF iAuditor</button>
    ${SafetyCultureSync.controlesTopoHtml()}
    ${Auth.pode('criar') ? `<button class="btn btn-primario" onclick="abrirNovo()">${ICN.add}Novo relatório</button>` : App.avisoModoConsulta()}
  `);
  SafetyCultureSync.carregarStatusTopo();

  preencherSelect('projeto', CFG.listas.projetos, 'Selecione...');
  preencherSelect('bitola', CFG.listas.bitolas, 'Selecione...');
  preencherSelect('fornecedor', CFG.listas.fornecedores, 'Selecione...');
  preencherSelect('resultado', RESULTADOS_BITOLA, 'Selecione...');

  preencherSelect('fProjeto', CFG.listas.projetos, 'Todos');
  preencherSelect('fBitola', CFG.listas.bitolas, 'Todas');
  preencherSelect('fResultado', RESULTADOS_BITOLA, 'Todos');

  ['busca', 'fProjeto', 'fBitola', 'fResultado', 'fDataIni', 'fDataFim'].forEach(id => {
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
  BITOLA_CARREGANDO = true;
  BITOLA_ERRO = '';
  BITOLA_TABELA_FALTANDO = false;
  render();
  try {
    await Auth.exigirLogin();
    const dados = await StoreSupabase.listarEnsaiosBitola({ limite: 5000 });
    BITOLA_REGISTROS = (dados || []).map(mapDoBanco);
    BITOLA_CARREGANDO = false;
    render();
  } catch (err) {
    console.error('Erro ao carregar ensaios de bitola', err);
    BITOLA_CARREGANDO = false;
    if (tabelaInexistente(err)) {
      BITOLA_TABELA_FALTANDO = true;
    } else {
      BITOLA_ERRO = mensagemErro(err, 'Não foi possível carregar os ensaios de bitola do Supabase.');
      App.toast(BITOLA_ERRO, 'erro');
    }
    render();
  }
}

function mapDoBanco(row) {
  return {
    id: row.id,
    dataEnsaio: row.data_ensaio || '',
    lote: row.lote || '',
    projeto: row.projeto || '',
    bitola: row.bitola || '',
    fornecedor: row.fornecedor || '',
    resultado: row.resultado || '',
    responsavel: row.responsavel || '',
    linkRelatorio: row.link_relatorio || '',
    arquivoOrigem: row.arquivo_origem || '',
    observacoes: row.observacoes || '',
    criadoEm: row.criado_em || '',
    origemDados: row.origem_dados || 'manual',
    safecultureAuditId: row.safeculture_audit_id || '',
    safecultureTemplateId: row.safeculture_template_id || '',
    safecultureModifiedAt: row.safeculture_modified_at || ''
  };
}

function mapParaBanco(reg) {
  const payload = {
    data_ensaio: reg.dataEnsaio || null,
    lote: reg.lote || null,
    projeto: reg.projeto || null,
    bitola: reg.bitola || null,
    fornecedor: reg.fornecedor || null,
    resultado: reg.resultado || null,
    responsavel: reg.responsavel || null,
    link_relatorio: reg.linkRelatorio || null,
    arquivo_origem: reg.arquivoOrigem || null,
    observacoes: reg.observacoes || null,
    origem_dados: reg.origemDados || (reg.arquivoOrigem ? 'pdf' : 'manual'),
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
    projeto: document.getElementById('fProjeto')?.value || '',
    bitola: document.getElementById('fBitola')?.value || '',
    resultado: document.getElementById('fResultado')?.value || '',
    dataIni: document.getElementById('fDataIni')?.value || '',
    dataFim: document.getElementById('fDataFim')?.value || '',
  };
}

function render() {
  const todos = BITOLA_REGISTROS;
  const f = filtros();
  const lista = todos.filter(r => {
    if (f.projeto && r.projeto !== f.projeto) return false;
    if (f.bitola && r.bitola !== f.bitola) return false;
    if (f.resultado && r.resultado !== f.resultado) return false;
    if (f.dataIni && (r.dataEnsaio || '') < f.dataIni) return false;
    if (f.dataFim && (r.dataEnsaio || '') > f.dataFim) return false;
    if (f.busca) {
      const blob = `${r.lote} ${r.projeto} ${r.bitola} ${r.fornecedor} ${r.resultado} ${r.responsavel} ${r.linkRelatorio} ${r.arquivoOrigem} ${r.observacoes}`.toLowerCase();
      if (!blob.includes(f.busca)) return false;
    }
    return true;
  }).sort((a, b) => (b.dataEnsaio || '').localeCompare(a.dataEnsaio || '') || String(b.criadoEm || '').localeCompare(String(a.criadoEm || '')));

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
    <div class="kpi escuro"><div class="rotulo">Ensaios no filtro</div><div class="valor">${lista.length}</div><div class="extra">registros no histórico</div></div>
    <div class="kpi verde"><div class="rotulo">Aprovados</div><div class="valor">${aprovados}</div><div class="extra">bitola conforme</div></div>
    <div class="kpi vermelho"><div class="rotulo">Reprovados</div><div class="valor">${reprovados}</div><div class="extra">bitola não conforme</div></div>
    <div class="kpi amarelo"><div class="rotulo">Pendentes</div><div class="valor">${pendentes}</div><div class="extra">aguardando conclusão</div></div>
    <div class="kpi"><div class="rotulo">Com relatório</div><div class="valor">${comLink}</div><div class="extra">links anexados</div></div>`;
}

function renderTabela(lista, total) {
  const contador = document.getElementById('contador');
  if (contador) contador.textContent = BITOLA_CARREGANDO ? 'Carregando do Supabase...' : `${lista.length} de ${total} registro(s)`;

  const alvo = document.getElementById('lista');
  if (!alvo) return;

  if (BITOLA_CARREGANDO) {
    alvo.innerHTML = `<div class="vazio">${ICN.vazioBox}<h3>Carregando ensaios de bitola</h3><p>Buscando registros no Supabase...</p></div>`;
    return;
  }
  if (BITOLA_TABELA_FALTANDO) {
    alvo.innerHTML = `<div class="vazio">${ICN.alerta}<h3>Tabela ainda não criada</h3>
      <p>Para ativar o histórico, rode no SQL Editor do Supabase o script <strong>supabase/2026-06-09-ensaios-bitola.sql</strong> incluído no projeto. Depois clique em tentar novamente.</p>
      <button class="btn btn-secundario" onclick="carregar()">Tentar novamente</button></div>`;
    return;
  }
  if (BITOLA_ERRO) {
    alvo.innerHTML = `<div class="vazio">${ICN.alerta}<h3>Erro ao carregar</h3><p>${U.esc(BITOLA_ERRO)}</p><button class="btn btn-secundario" onclick="carregar()">Tentar novamente</button></div>`;
    return;
  }
  if (!lista.length) {
    alvo.innerHTML = `<div class="vazio">${ICN.vazioBox}<h3>Nenhum ensaio de bitola registrado</h3><p>${total ? 'Ajuste os filtros ou' : 'Comece'} importando um PDF do iAuditor ou criando um relatório manual.</p></div>`;
    return;
  }

  alvo.innerHTML = `<div class="tabela-wrap"><table class="tabela">
    <thead><tr>
      <th>Data</th><th>Projeto</th><th>Bitola</th><th>Fornecedor</th>
      <th>Resultado</th><th>Responsável</th><th>Origem</th><th>Relatório</th><th>Ações</th>
    </tr></thead>
    <tbody>${lista.map(r => `<tr>
      <td>${U.dataBR(r.dataEnsaio)}</td>
      <td>${U.badgeProjeto(r.projeto)}</td>
      <td>${badgeBitolaValor(r.bitola)}</td>
      <td>${U.esc(r.fornecedor || '—')}</td>
      <td>${badgeResultado(r.resultado)}</td>
      <td>${U.esc(r.responsavel || '—')}</td>
      <td>${SafetyCultureSync.origemBadge(r)}</td>
      <td>${linkRelatorio(r)}</td>
      <td class="acoes-cel">
        <button class="icone-btn" title="Ver" onclick="ver('${r.id}')">${ICN.olho}</button>
        ${SafetyCultureSync.podeEditarRegistro(r) ? `<button class="icone-btn" title="Editar" onclick="editar('${r.id}')">${ICN.edit}</button>` : ''}
        ${SafetyCultureSync.podeExcluirRegistro(r) ? `<button class="icone-btn del" title="Excluir" onclick="excluir('${r.id}')">${ICN.del}</button>` : ''}
      </td>
    </tr>`).join('')}</tbody>
  </table></div>`;
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
  setValor('dataEnsaio', hojeISO());
  document.getElementById('modalTitulo').textContent = 'Novo ensaio de bitola';
  document.getElementById('modal').classList.add('aberto');
}

function editar(id) {
  if (!Auth.pode('editar')) { App.toast(Auth.mensagemSemPermissao('editar registros'), 'aviso'); return; }
  const r = BITOLA_REGISTROS.find(x => x.id === id);
  if (!r) return;
  if (SafetyCultureSync.bloquearAlteracao(r)) return;
  document.getElementById('form').reset();
  document.getElementById('id').value = r.id;
  CAMPOS_BITOLA.forEach(c => setValor(c, r[c] != null ? r[c] : ''));
  document.getElementById('modalTitulo').textContent = `Editar ensaio de bitola — ${r.lote || ''}`;
  document.getElementById('modal').classList.add('aberto');
}

function lerFormulario() {
  const reg = {};
  CAMPOS_BITOLA.forEach(c => { reg[c] = (document.getElementById(c)?.value || '').trim(); });
  const id = document.getElementById('id').value;
  if (id) reg.id = id;
  return reg;
}

async function salvar() {
  if (!Auth.pode('criar') && !Auth.pode('editar')) { App.toast(Auth.mensagemSemPermissao('salvar registros'), 'aviso'); return; }
  const reg = lerFormulario();
  if (!reg.dataEnsaio) { App.toast('Informe a data do ensaio.', 'aviso'); return; }

  try {
    const salvo = await StoreSupabase.salvarEnsaioBitola(mapParaBanco(reg));
    const convertido = mapDoBanco(salvo);
    const idx = BITOLA_REGISTROS.findIndex(x => x.id === convertido.id);
    if (idx >= 0) BITOLA_REGISTROS[idx] = convertido;
    else BITOLA_REGISTROS.unshift(convertido);
    fecharModal();
    render();
    App.toast('Ensaio de bitola salvo.');
  } catch (err) {
    console.error('Erro ao salvar ensaio de bitola', err);
    App.toast(mensagemErro(err, 'Não foi possível salvar o ensaio de bitola.'), 'erro');
  }
}

async function excluir(id) {
  if (!Auth.pode('excluir')) { App.toast(Auth.mensagemSemPermissao('excluir registros'), 'aviso'); return; }
  const r = BITOLA_REGISTROS.find(x => x.id === id);
  if (!r || SafetyCultureSync.bloquearAlteracao(r)) return;
  if (!App.confirmar(`Excluir o ensaio de bitola${r?.lote ? ' do lote ' + r.lote : ''}? Esta ação não pode ser desfeita.`)) return;
  try {
    await StoreSupabase.removerEnsaioBitola(id);
    BITOLA_REGISTROS = BITOLA_REGISTROS.filter(x => x.id !== id);
    render();
    App.toast('Ensaio de bitola excluído.');
  } catch (err) {
    console.error('Erro ao excluir ensaio de bitola', err);
    App.toast(mensagemErro(err, 'Não foi possível excluir o ensaio de bitola.'), 'erro');
  }
}

function ver(id) {
  const r = BITOLA_REGISTROS.find(x => x.id === id);
  if (!r) return;
  const link = String(r.linkRelatorio || '').trim();
  const href = link ? (/^https?:\/\//i.test(link) ? link : `https://${link}`) : '';
  document.getElementById('verTitulo').textContent = `Ensaio de bitola — ${r.lote || U.dataBR(r.dataEnsaio)}`;
  document.getElementById('verCorpo').innerHTML = `
    <div class="detalhe-grid">
      ${itemVer('Data', U.dataBR(r.dataEnsaio))}
      ${itemVer('Lote', r.lote)}
      ${itemVer('Projeto', r.projeto)}
      ${itemVer('Bitola', r.bitola)}
      ${itemVer('Fornecedor', r.fornecedor)}
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
   Leitor de iAuditor (PDF) — lê e oferece salvar direto
   --------------------------------------------------------------------- */
function inicializarLeitorIauditor() {
  const input = document.getElementById('iauditorPdfInput');
  const drop = document.getElementById('iauditorDropzone');
  const btn = document.getElementById('iauditorEscolherPdf');
  if (!input || !drop) return;

  btn?.addEventListener('click', (e) => { e.stopPropagation(); input.click(); });
  drop.addEventListener('click', (e) => { if (!e.target.closest('button')) input.click(); });
  drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  input.addEventListener('change', (e) => { const file = e.target.files?.[0]; if (file) lerRelatorioIauditor(file); });
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
  alvo.innerHTML = `<div class="iauditor-status"><h3>Lendo ${U.esc(file.name)}...</h3><p>Extraindo lote, projeto, bitola, data e medidas encontradas.</p></div>`;
  try {
    const pages = await extrairPaginasPdf(file);
    const data = RumoParser.parse(pages);
    const registro = montarRegistroIauditor(data, file.name);
    IAUDITOR_RELATORIO_ATUAL = { fileName: file.name, data, registro };
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
  const lote = limparValor(meta['Lote'] || meta['Lote do dormente'] || meta['Lote ensaiado']);
  const projeto = normalizarProjeto(meta['Projeto'] || meta['Destino'] || '');
  const bitola = normalizarBitola(meta['Tipo de dormente'] || projeto || meta['Bitola'] || '');
  const fornecedor = normalizarFornecedor(meta['Fornecedor'] || '');
  const dataEnsaio = dataPtParaISO(meta['Data do ensaio'] || meta['Data da fabricação/inspeção'] || meta['Data da fabricação'] || meta['Data de produção']) || hojeISO();
  const responsavel = limparValor(meta['Fiscal responsável'] || meta['Responsável'] || '');
  const tipo = limparValor(meta['Tipo de relatório']) || 'Ensaio de bitola';
  const linhas = linhasBitola(data);
  const resultado = inferirResultado(data);

  return {
    dataEnsaio, lote, projeto, bitola, fornecedor, resultado, responsavel,
    linkRelatorio: '',
    arquivoOrigem: fileName,
    observacoes: montarObservacoes({ fileName, meta, tipo, linhas }),
    tipo, linhas
  };
}

function linhasBitola(data) {
  const linhas = [];
  (data?.sections || []).forEach(sec => {
    (sec.rows || []).forEach(row => {
      linhas.push({
        secao: sec.title || '—',
        campo: row.ensaio || row.name || '—',
        valor: row.valor != null ? String(row.valor) : '—',
        situacao: row.situacao || ''
      });
    });
  });
  return linhas;
}

function inferirResultado(data) {
  if (data?.conclusao?.situacao === 'ok') return 'Aprovado';
  if (data?.conclusao?.situacao === 'fail') return 'Reprovado';
  const linhas = linhasBitola(data);
  if (linhas.some(l => l.situacao === 'fail')) return 'Reprovado';
  return 'Pendente';
}

function montarObservacoes({ fileName, meta, tipo, linhas }) {
  const cab = [
    'Registro importado do leitor de relatórios iAuditor.',
    `Arquivo: ${fileName}`,
    `Tipo de relatório: ${tipo || '—'}`,
  ];
  const metaTxt = Object.keys(meta || {}).slice(0, 12).map(k => `${k}: ${meta[k]}`).join(' | ');
  const det = (linhas || []).slice(0, 30).map(l => `- ${l.secao} · ${l.campo}: ${l.valor}`);
  return cab.concat(metaTxt ? [`Metadados lidos: ${metaTxt}`] : [], det.length ? ['Leituras:', ...det] : []).join('\n');
}

function renderLeituraIauditor(item) {
  const alvo = document.getElementById('iauditorResultado');
  if (!alvo) return;
  const r = item.registro;
  const linhasMostradas = (r.linhas || []).slice(0, 10);
  const podeCriar = Auth.pode('criar');
  alvo.innerHTML = `
    <div class="iauditor-status ok">
      <h3>Relatório lido — confira e salve no histórico</h3>
      <p>Confira os dados lidos e salve. O link do relatório (SharePoint/iAuditor) é opcional e pode ser informado quando existir.</p>
      <div class="iauditor-meta-grid">
        ${metaItem('Arquivo', item.fileName)}
        ${metaItem('Tipo', r.tipo)}
        ${metaItem('Lote', r.lote)}
        ${metaItem('Projeto', r.projeto)}
        ${metaItem('Bitola', r.bitola)}
        ${metaItem('Data', U.dataBR(r.dataEnsaio))}
        ${metaItem('Responsável', r.responsavel)}
        ${metaItem('Resultado sugerido', r.resultado)}
      </div>
      ${podeCriar ? `
      <div class="form-grid" style="margin-top:14px">
        <div class="campo full"><label>Link do relatório <span class="dica">(opcional)</span></label><input id="iaLink" type="url" placeholder="https://..."></div>
      </div>
      <div class="iauditor-acoes">
        <button class="btn btn-primario" type="button" onclick="salvarLeituraIauditor()">${ICN.check}Salvar relatório</button>
        <button class="btn btn-secundario" type="button" onclick="preencherModalComLeitura()">Editar antes de salvar</button>
      </div>` : '<div class="iauditor-acoes"><span class="badge badge-amarelo">Modo consulta: leitura sem registro</span></div>'}
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
  const link = (document.getElementById('iaLink')?.value || '').trim();

  const reg = {
    dataEnsaio: atual.registro.dataEnsaio,
    lote: atual.registro.lote,
    projeto: atual.registro.projeto,
    bitola: atual.registro.bitola,
    fornecedor: atual.registro.fornecedor,
    resultado: atual.registro.resultado,
    responsavel: atual.registro.responsavel,
    linkRelatorio: link,
    arquivoOrigem: atual.registro.arquivoOrigem,
    observacoes: atual.registro.observacoes,
  };

  const btn = document.querySelector('#iauditorResultado .btn-primario');
  const txt = btn?.innerHTML;
  if (btn) { btn.disabled = true; btn.innerHTML = 'Salvando...'; }
  try {
    const salvo = await StoreSupabase.salvarEnsaioBitola(mapParaBanco(reg));
    const convertido = mapDoBanco(salvo);
    BITOLA_REGISTROS.unshift(convertido);
    render();
    App.toast('Relatório de bitola salvo no histórico.');
    const linkSalvo = link ? `<a class="link-relatorio" href="${U.esc(/^https?:\/\//i.test(link) ? link : 'https://' + link)}" target="_blank" rel="noopener">Abrir relatório</a>` : '<span class="badge badge-amarelo">Sem link de relatório</span>';
    document.getElementById('iauditorResultado').innerHTML = `<div class="iauditor-status ok"><h3>Relatório salvo</h3><p>${U.esc(atual.fileName)} foi registrado no histórico de ensaios de bitola. ${linkSalvo}</p></div>`;
    IAUDITOR_RELATORIO_ATUAL = null;
  } catch (err) {
    console.error('Erro ao salvar leitura iAuditor', err);
    App.toast(mensagemErro(err, 'Não foi possível salvar o relatório de bitola.'), 'erro');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = txt || 'Salvar relatório'; }
  }
}

function preencherModalComLeitura() {
  if (!Auth.pode('criar')) { App.toast(Auth.mensagemSemPermissao('criar registros'), 'aviso'); return; }
  const atual = IAUDITOR_RELATORIO_ATUAL;
  if (!atual?.registro) { abrirNovo(); return; }
  const r = atual.registro;
  document.getElementById('form').reset();
  document.getElementById('id').value = '';
  CAMPOS_BITOLA.forEach(c => setValor(c, r[c] != null ? r[c] : ''));
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
  return code === 'PGRST205' || code === '42P01' || (msg.includes('ensaios_bitola') && (msg.includes('does not exist') || msg.includes('could not find') || msg.includes('schema cache')));
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
