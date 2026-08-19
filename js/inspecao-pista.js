/* =====================================================================
   INSPECAO-PISTA.JS — Histórico consultivo de inspeções de pista.
   Independente das demais telas: leitura de iAuditor + registro com link.
   ===================================================================== */
let PISTA_REGISTROS = [];
let PISTA_CARREGANDO = false;
let PISTA_ERRO = '';
let PISTA_TABELA_FALTANDO = false;
let IAUDITOR_RELATORIOS = [];        // todos os PDFs lidos no lote atual
let IAUDITOR_RELATORIO_ATUAL = null; // último relatório aberto para edição (compat)
let IAUDITOR_EDIT_IDX = null;        // índice do relatório do lote aberto no modal de edição

const CAMPOS_PISTA = [
  'dataInspecao', 'lote', 'projeto', 'bitola', 'fornecedor', 'responsavel',
  'pista', 'dormentesReprovados', 'trechoPosicao', 'molde', 'cavidade', 'atividade', 'itensInspecionados',
  'naoConformidades', 'acoesCorretivas', 'linkRelatorio', 'arquivoOrigem', 'observacoes'
];
const PALAVRAS_PISTA_EXPLICITAS = [
  'inspecao de pista', 'inspeção de pista', 'checklist de pista', 'check list de pista',
  'liberacao de pista', 'liberação de pista', 'relatorio de pista', 'relatório de pista'
];
const CHAVES_CONTEXTO_PISTA = [
  'pista', 'limpeza', 'forma', 'formas', 'molde', 'cavidade', 'liberacao', 'liberação',
  'posicionamento', 'armadura', 'desmoldante', 'inspecao', 'inspeção', 'conferencia',
  'conferência', 'preparacao', 'preparação', 'montagem', 'travamento', 'nivelamento',
  'trilho', 'trilhos', 'insertos', 'ombreira', 'placa', 'base', 'local inspecionado'
];
const CHAVES_LEITURA_PISTA = [
  'pista', 'trecho', 'posição', 'posicao', 'local', 'molde', 'cavidade', 'atividade',
  'etapa', 'limpeza', 'forma', 'formas', 'liberação', 'liberacao', 'armadura',
  'desmoldante', 'conferência', 'conferencia', 'não conformidade', 'nao conformidade',
  'pendência', 'pendencia', 'ação corretiva', 'acao corretiva', 'observação', 'observacao'
];
const CHAVES_OUTROS_RELATORIOS = [
  'inspecao de concretagem', 'inspeção de concretagem', 'concretagem', 'slump', 'abatimento',
  'espalhamento', 'temperatura de lancamento', 'temperatura de lançamento', 'arrancamento',
  'ensaio de bitola', 'regua de bitola', 'régua de bitola', 'momento positivo',
  'momento negativo', 'carga ultima', 'carga última', 'aderencia', 'aderência'
];

// Termos que, quando aparecem com "pista", indicam forte chance de ser inspeção de pista.
const SINAIS_PISTA = [
  'limpeza da pista', 'liberacao da pista', 'liberação da pista', 'inspecao da pista',
  'inspeção da pista', 'preparacao da pista', 'preparação da pista', 'montagem da pista',
  'conferencia da pista', 'conferência da pista', 'pista liberada', 'pista reprovada',
  'pista aprovada', 'pista pendente'
];

document.addEventListener('DOMContentLoaded', async () => {
  if (!await Auth.exigirLogin()) return;
  document.body.classList.add('pagina-ensaios-liberacao');
  App.montarLayout('inspecaoPista', Area.titulo('Inspeção de Pista'), `Histórico consultivo de inspeções de pista — ${Area.fornecedor()}`);
  App.acoesTopo(`
    <button class="btn btn-secundario" onclick="abrirImportadorIauditor()">${ICN.upload}Importar PDFs iAuditor</button>
    ${SafetyCultureSync.controlesTopoHtml()}
    ${Auth.pode('criar') ? `<button class="btn btn-primario" onclick="abrirNovo()">${ICN.add}Novo relatório</button>` : App.avisoModoConsulta()}
  `);
  SafetyCultureSync.carregarStatusTopo();

  preencherSelect('projeto', CFG.listas.projetos, 'Selecione...');
  preencherSelect('bitola', CFG.listas.bitolas, 'Selecione...');
  preencherSelect('fornecedor', CFG.listas.fornecedores, 'Selecione...');

  preencherSelect('fFornecedor', CFG.listas.fornecedores, 'Todos');
  preencherSelect('fProjeto', CFG.listas.projetos, 'Todos');
  preencherSelect('fBitola', CFG.listas.bitolas, 'Todas');

  ['busca', 'fFornecedor', 'fProjeto', 'fBitola', 'fDataIni', 'fDataFim'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.addEventListener('input', render); el.addEventListener('change', render); }
  });

  inicializarLeitorIauditor();
  aplicarLoteDaUrl();
  render();
  await carregar();
});

function aplicarLoteDaUrl() {
  const lote = new URLSearchParams(location.search).get('lote');
  if (!lote) return;
  const busca = document.getElementById('busca');
  if (busca) busca.value = lote;
}

function preencherSelect(id, arr, ph) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = U.opcoes(arr, '', ph);
}

/* ---------------------------------------------------------------------
   Carregamento e persistência
   --------------------------------------------------------------------- */
async function carregar() {
  PISTA_CARREGANDO = true;
  PISTA_ERRO = '';
  PISTA_TABELA_FALTANDO = false;
  render();
  try {
    await Auth.exigirLogin();
    const dados = await StoreSupabase.listarInspecoesPista({ limite: 5000 });
    PISTA_REGISTROS = SafetyCultureSync.filtrarDuplicadosPorLote((dados || []).map(mapDoBanco));
    PISTA_CARREGANDO = false;
    render();
  } catch (err) {
    console.error('Erro ao carregar inspeções de pista', err);
    PISTA_CARREGANDO = false;
    if (tabelaInexistente(err)) {
      PISTA_TABELA_FALTANDO = true;
    } else {
      PISTA_ERRO = mensagemErro(err, 'Não foi possível carregar as inspeções de pista do Supabase.');
      App.toast(PISTA_ERRO, 'erro');
    }
    render();
  }
}

function mapDoBanco(row) {
  return {
    id: row.id,
    producaoLoteId: row.producao_lote_id || '',
    dataInspecao: row.data_inspecao || '',
    lote: row.lote || '',
    projeto: row.projeto || '',
    bitola: row.bitola || '',
    fornecedor: row.fornecedor || '',
    pista: row.pista || '',
    dormentesReprovados: normalizarQuantidadeReprovados(row.dormentes_reprovados ?? row.quantidade_reprovada ?? '') || extrairDormentesReprovadosRegistro(row),
    trechoPosicao: row.trecho_posicao || '',
    molde: row.molde || '',
    cavidade: row.cavidade || '',
    atividade: row.atividade || '',
    itensInspecionados: row.itens_inspecionados || '',
    naoConformidades: row.nao_conformidades || '',
    acoesCorretivas: row.acoes_corretivas || '',
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
    data_inspecao: reg.dataInspecao || null,
    lote: reg.lote || null,
    projeto: reg.projeto || null,
    bitola: reg.bitola || null,
    fornecedor: reg.fornecedor || null,
    pista: reg.pista || null,
    trecho_posicao: reg.trechoPosicao || null,
    molde: reg.molde || null,
    cavidade: reg.cavidade || null,
    atividade: reg.atividade || null,
    itens_inspecionados: reg.itensInspecionados || null,
    nao_conformidades: reg.naoConformidades || null,
    acoes_corretivas: reg.acoesCorretivas || null,
    dormentes_reprovados: reg.dormentesReprovados === '' ? null : Number(reg.dormentesReprovados),
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
    fornecedor: document.getElementById('fFornecedor')?.value || '',
    projeto: document.getElementById('fProjeto')?.value || '',
    bitola: document.getElementById('fBitola')?.value || '',
    dataIni: document.getElementById('fDataIni')?.value || '',
    dataFim: document.getElementById('fDataFim')?.value || '',
  };
}

function render() {
  const todos = PISTA_REGISTROS;
  const f = filtros();
  const lista = todos.filter(r => {
    if (f.fornecedor && r.fornecedor !== f.fornecedor) return false;
    if (f.projeto && r.projeto !== f.projeto) return false;
    if (f.bitola && r.bitola !== f.bitola) return false;
    if (f.dataIni && (r.dataInspecao || '') < f.dataIni) return false;
    if (f.dataFim && (r.dataInspecao || '') > f.dataFim) return false;
    if (f.busca) {
      const blob = `${r.lote} ${r.projeto} ${r.bitola} ${r.fornecedor} ${r.pista} ${valorDormentesReprovados(r)} ${r.trechoPosicao} ${r.molde} ${r.cavidade} ${r.atividade} ${r.itensInspecionados} ${r.naoConformidades} ${r.acoesCorretivas} ${r.responsavel} ${r.linkRelatorio} ${r.arquivoOrigem} ${r.observacoes}`.toLowerCase();
      if (!blob.includes(f.busca)) return false;
    }
    return true;
  }).sort((a, b) => (b.dataInspecao || '').localeCompare(a.dataInspecao || '') || String(b.criadoEm || '').localeCompare(String(a.criadoEm || '')));

  renderKpis(lista);
  renderTabela(lista, todos.length);
}

function renderKpis(lista) {
  const comLink = lista.filter(r => String(r.linkRelatorio || '').trim()).length;
  const semLink = lista.length - comLink;
  const comNc = lista.filter(r => String(r.naoConformidades || '').trim()).length;
  const alvo = document.getElementById('kpis');
  if (!alvo) return;
  alvo.innerHTML = `
    <div class="kpi escuro"><div class="rotulo">Inspeções no filtro</div><div class="valor">${lista.length}</div><div class="extra">registros no histórico</div></div>
    <div class="kpi"><div class="rotulo">Com NC</div><div class="valor">${comNc}</div><div class="extra">relatos de desvio</div></div>
    <div class="kpi"><div class="rotulo">Com relatório</div><div class="valor">${comLink}</div><div class="extra">links anexados</div></div>
    <div class="kpi amarelo"><div class="rotulo">Sem relatório</div><div class="valor">${semLink}</div><div class="extra">sem link anexado</div></div>`;
}

function renderTabela(lista, total) {
  const contador = document.getElementById('contador');
  if (contador) contador.textContent = PISTA_CARREGANDO ? 'Carregando do Supabase...' : `${lista.length} de ${total} registro(s)`;

  const alvo = document.getElementById('lista');
  if (!alvo) return;

  if (PISTA_CARREGANDO) {
    alvo.innerHTML = `<div class="vazio">${ICN.vazioBox}<h3>Carregando inspeções de pista</h3><p>Buscando registros no Supabase...</p></div>`;
    return;
  }
  if (PISTA_TABELA_FALTANDO) {
    alvo.innerHTML = `<div class="vazio">${ICN.alerta}<h3>Tabela ainda não criada</h3>
      <p>Para ativar o histórico, rode no SQL Editor do Supabase o script <strong>supabase/2026-06-09-inspecoes-pista.sql</strong> incluído no projeto. Depois clique em tentar novamente.</p>
      <button class="btn btn-secundario" onclick="carregar()">Tentar novamente</button></div>`;
    return;
  }
  if (PISTA_ERRO) {
    alvo.innerHTML = `<div class="vazio">${ICN.alerta}<h3>Erro ao carregar</h3><p>${U.esc(PISTA_ERRO)}</p><button class="btn btn-secundario" onclick="carregar()">Tentar novamente</button></div>`;
    return;
  }
  if (!lista.length) {
    alvo.innerHTML = `<div class="vazio">${ICN.vazioBox}<h3>Nenhuma inspeção de pista registrada</h3><p>${total ? 'Ajuste os filtros ou' : 'Comece'} importando um PDF do iAuditor ou criando um relatório manual.</p></div>`;
    return;
  }

  alvo.innerHTML = `<div class="tabela-wrap"><table class="tabela">
    <thead><tr>
      <th>Data</th><th>Lote</th><th>Projeto</th><th>Bitola</th><th>Pista</th><th>Reprovados</th>
      <th>Responsável</th><th>Origem</th><th>Relatório</th><th>Ações</th>
    </tr></thead>
    <tbody>${lista.map(r => `<tr>
      <td>${U.dataBR(r.dataInspecao)}</td>
      <td><strong>${U.esc(r.lote || '—')}</strong></td>
      <td>${U.badgeProjeto(r.projeto)}</td>
      <td>${badgeBitolaValor(r.bitola)}</td>
      <td>${U.esc(r.pista || '—')}</td>
      <td><strong>${U.esc(valorDormentesReprovados(r))}</strong></td>
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

function valorDormentesReprovados(r) {
  const direto = normalizarQuantidadeReprovados(r?.dormentesReprovados ?? r?.dormentes_reprovados ?? r?.quantidadeReprovada ?? r?.quantidade_reprovada ?? '');
  if (direto !== '') return direto;
  const extraido = extrairDormentesReprovadosRegistro(r);
  return extraido !== '' ? extraido : '—';
}

function extrairDormentesReprovadosRegistro(r) {
  if (!r) return '';
  const fontes = [
    r.dormentesReprovados, r.dormentes_reprovados, r.quantidadeReprovada, r.quantidade_reprovada,
    r.observacoes, r.itensInspecionados, r.itens_inspecionados, r.naoConformidades, r.nao_conformidades
  ].filter(v => v != null && String(v).trim());
  for (const fonte of fontes) {
    const qtd = extrairQuantidadeReprovadaTexto(fonte);
    if (qtd !== '') return qtd;
  }
  return '';
}

function extrairQuantidadeReprovadaTexto(texto) {
  const s = limparValor(texto);
  if (!s) return '';
  const padroes = [
    /(?:quantidade\s+reprovada|dormentes?\s+reprovados?|qtd\.?\s*(?:de\s*)?reprovados?|qtde\.?\s*(?:de\s*)?reprovados?)\s*[:=\-]?\s*(\d{1,5})/i,
    /(?:reprovados?)\s*[:=\-]\s*(\d{1,5})/i
  ];
  for (const re of padroes) {
    const m = s.match(re);
    if (m) return normalizarQuantidadeReprovados(m[1]);
  }
  return '';
}

function normalizarQuantidadeReprovados(valor) {
  const s = limparValor(valor);
  if (!s || s === '—') return '';
  const m = s.match(/\d{1,5}/);
  return m ? String(parseInt(m[0], 10)) : '';
}

function resumoTexto(txt) {
  const s = String(txt || '').trim();
  if (!s) return '—';
  return U.esc(s.length > 70 ? s.slice(0, 70) + '...' : s);
}
function badgeBitolaValor(bitola) {
  const cls = bitola === 'Bitola Larga' ? 'badge-bitola-larga' : bitola === 'Bitola Mista' ? 'badge-bitola-mista' : 'badge-bitola-sem';
  return `<span class="badge ${cls}">${U.esc(bitola || 'Sem bitola definida')}</span>`;
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
  IAUDITOR_EDIT_IDX = null;
  document.getElementById('form').reset();
  document.getElementById('id').value = '';
  setValor('dataInspecao', hojeISO());
  document.getElementById('modalTitulo').textContent = 'Nova inspeção de pista';
  document.getElementById('modal').classList.add('aberto');
}

function editar(id) {
  if (!Auth.pode('editar')) { App.toast(Auth.mensagemSemPermissao('editar registros'), 'aviso'); return; }
  const r = PISTA_REGISTROS.find(x => x.id === id);
  if (!r) return;
  if (SafetyCultureSync.bloquearAlteracao(r)) return;
  IAUDITOR_EDIT_IDX = null;
  document.getElementById('form').reset();
  document.getElementById('id').value = r.id;
  CAMPOS_PISTA.forEach(c => setValor(c, r[c] != null ? r[c] : ''));
  document.getElementById('modalTitulo').textContent = `Editar inspeção de pista — ${r.lote || ''}`;
  document.getElementById('modal').classList.add('aberto');
}

function lerFormulario() {
  const reg = {};
  CAMPOS_PISTA.forEach(c => { reg[c] = (document.getElementById(c)?.value || '').trim(); });
  reg.dormentesReprovados = normalizarQuantidadeReprovados(reg.dormentesReprovados);
  reg.observacoes = aplicarDormentesReprovadosNasObservacoes(reg.observacoes, reg.dormentesReprovados);
  const id = document.getElementById('id').value;
  if (id) reg.id = id;
  return reg;
}

function aplicarDormentesReprovadosNasObservacoes(observacoes, quantidade) {
  const qtd = normalizarQuantidadeReprovados(quantidade);
  const linhas = String(observacoes || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter(l => !/^\s*Dormentes\s+reprovados\s*:/i.test(l));

  if (qtd !== '') {
    const linha = `Dormentes reprovados: ${qtd}`;
    const idxLeituras = linhas.findIndex(l => /^\s*Leituras\s+de\s+inspe[cç][aã]o\s+de\s+pista\s*:/i.test(l));
    if (idxLeituras >= 0) linhas.splice(idxLeituras, 0, linha);
    else linhas.push(linha);
  }

  return linhas.join('\n').trim();
}

async function salvar() {
  if (!Auth.pode('criar') && !Auth.pode('editar')) { App.toast(Auth.mensagemSemPermissao('salvar registros'), 'aviso'); return; }
  const reg = lerFormulario();
  if (!reg.dataInspecao) { App.toast('Informe a data da inspeção.', 'aviso'); return; }
  // Link do relatório é opcional: pode ser anexado depois, lote a lote.
  const loteIdx = IAUDITOR_EDIT_IDX; // se veio de um relatório lido em lote, consome esse item depois

  try {
    const salvo = await StoreSupabase.salvarInspecaoPista(mapParaBanco(reg));
    const convertido = mapDoBanco(salvo);
    const idx = PISTA_REGISTROS.findIndex(x => x.id === convertido.id);
    if (idx >= 0) PISTA_REGISTROS[idx] = convertido;
    else PISTA_REGISTROS.unshift(convertido);
    fecharModal();
    if (typeof loteIdx === 'number' && loteIdx >= 0 && loteIdx < IAUDITOR_RELATORIOS.length) {
      capturarLinksIauditor();
      IAUDITOR_RELATORIOS.splice(loteIdx, 1);
      if (IAUDITOR_RELATORIOS.length) renderLeituraIauditorLote();
      else { const alvo = document.getElementById('iauditorResultado'); if (alvo) alvo.innerHTML = ''; }
    }
    render();
    App.toast('Inspeção de pista salva.');
  } catch (err) {
    console.error('Erro ao salvar inspeção de pista', err);
    App.toast(mensagemErro(err, 'Não foi possível salvar a inspeção de pista.'), 'erro');
  }
}

async function excluir(id) {
  if (!Auth.pode('excluir')) { App.toast(Auth.mensagemSemPermissao('excluir registros'), 'aviso'); return; }
  const r = PISTA_REGISTROS.find(x => x.id === id);
  if (!r || SafetyCultureSync.bloquearAlteracao(r)) return;
  if (!App.confirmar(`Excluir a inspeção de pista${r?.lote ? ' do lote ' + r.lote : ''}? Esta ação não pode ser desfeita.`)) return;
  try {
    await StoreSupabase.removerInspecaoPista(id);
    PISTA_REGISTROS = PISTA_REGISTROS.filter(x => x.id !== id);
    render();
    App.toast('Inspeção de pista excluída.');
  } catch (err) {
    console.error('Erro ao excluir inspeção de pista', err);
    App.toast(mensagemErro(err, 'Não foi possível excluir a inspeção de pista.'), 'erro');
  }
}

function ver(id) {
  const r = PISTA_REGISTROS.find(x => x.id === id);
  if (!r) return;
  const link = String(r.linkRelatorio || '').trim();
  const href = link ? (/^https?:\/\//i.test(link) ? link : `https://${link}`) : '';
  document.getElementById('verTitulo').textContent = `Inspeção de pista — ${r.lote || U.dataBR(r.dataInspecao)}`;
  document.getElementById('verCorpo').innerHTML = `
    <div class="detalhe-grid">
      ${itemVer('Data', U.dataBR(r.dataInspecao))}
      ${itemVer('Lote', r.lote)}
      ${itemVer('Projeto', r.projeto)}
      ${itemVer('Bitola', r.bitola)}
      ${itemVer('Fornecedor', r.fornecedor)}
      ${itemVer('Pista', r.pista)}
      ${itemVer('Reprovados', valorDormentesReprovados(r))}
      ${itemVer('Trecho / posição', r.trechoPosicao)}
      ${itemVer('Molde', r.molde)}
      ${itemVer('Cavidade', r.cavidade)}
      ${itemVer('Atividade / etapa', r.atividade)}
      ${itemVer('Responsável', r.responsavel)}
      ${itemVer('Arquivo de origem', r.arquivoOrigem)}
    </div>
    ${r.itensInspecionados ? `<div class="detalhe-secao"><strong>Itens inspecionados</strong><p style="white-space:pre-wrap">${U.esc(r.itensInspecionados)}</p></div>` : ''}
    ${r.naoConformidades ? `<div class="detalhe-secao"><strong>Não conformidades</strong><p style="white-space:pre-wrap">${U.esc(r.naoConformidades)}</p></div>` : ''}
    ${r.acoesCorretivas ? `<div class="detalhe-secao"><strong>Ações corretivas</strong><p style="white-space:pre-wrap">${U.esc(r.acoesCorretivas)}</p></div>` : ''}
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
function fecharModal() { IAUDITOR_EDIT_IDX = null; document.getElementById('modal').classList.remove('aberto'); }
function fecharVer() { document.getElementById('modalVer').classList.remove('aberto'); }

/* ---------------------------------------------------------------------
   Leitor de iAuditor (PDF) — lê, valida Pista e oferece salvar direto
   --------------------------------------------------------------------- */
function inicializarLeitorIauditor() {
  const input = document.getElementById('iauditorPdfInput');
  const drop = document.getElementById('iauditorDropzone');
  const btn = document.getElementById('iauditorEscolherPdf');
  if (!input || !drop) return;

  btn?.addEventListener('click', (e) => { e.stopPropagation(); input.click(); });
  drop.addEventListener('click', (e) => { if (!e.target.closest('button')) input.click(); });
  drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  input.addEventListener('change', (e) => { const files = Array.from(e.target.files || []); if (files.length) lerRelatoriosIauditor(files); input.value = ''; });
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('arrastando'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('arrastando'); }));
  drop.addEventListener('drop', (e) => { const files = Array.from(e.dataTransfer?.files || []); if (files.length) lerRelatoriosIauditor(files); });
}

function abrirImportadorIauditor() {
  const card = document.getElementById('iauditorCard');
  card?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => document.getElementById('iauditorPdfInput')?.click(), 250);
}

async function lerRelatoriosIauditor(files) {
  const alvo = document.getElementById('iauditorResultado');
  if (!alvo) return;
  const pdfs = Array.from(files || []).filter(f => /\.pdf$/i.test(f.name));
  const ignorados = Array.from(files || []).length - pdfs.length;
  if (!pdfs.length) { renderErroIauditor('Selecione um ou mais arquivos PDF exportados do iAuditor.'); return; }
  if (!window.pdfjsLib || !window.RumoParser) { renderErroIauditor('O leitor de PDF não foi carregado. Verifique sua conexão e recarregue a página.'); return; }

  IAUDITOR_RELATORIOS = [];
  IAUDITOR_RELATORIO_ATUAL = null;
  IAUDITOR_EDIT_IDX = null;

  for (let i = 0; i < pdfs.length; i++) {
    const file = pdfs[i];
    alvo.innerHTML = `<div class="iauditor-status"><h3>Lendo ${i + 1} de ${pdfs.length} PDF(s)...</h3><p>Processando <strong>${U.esc(file.name)}</strong> — extraindo identificação, pista e itens de inspeção encontrados.</p></div>`;
    try {
      const pages = await extrairPaginasPdf(file);
      const data = RumoParser.parse(pages);
      const registro = montarRegistroIauditor(data, file.name);
      const valido = ehRelatorioPista(data, registro, file.name);
      IAUDITOR_RELATORIOS.push({ fileName: file.name, data, registro, valido, erro: false, linkDigitado: '' });
    } catch (err) {
      console.error('Erro ao ler relatório iAuditor', file.name, err);
      IAUDITOR_RELATORIOS.push({ fileName: file.name, data: null, registro: null, valido: false, erro: true, linkDigitado: '' });
    }
  }

  if (ignorados > 0) App.toast(`${ignorados} arquivo(s) ignorado(s) por não ser(em) PDF.`, 'aviso');
  renderLeituraIauditorLote();
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
  const tipo = limparValor(meta['Tipo de relatório']) || inferirTipoRelatorio(data) || 'Inspeção de Pista';
  const linhas = linhasPista(data);
  const lote = limparValor(meta['Lote'] || meta['Lote do dormente'] || meta['Lote ensaiado']);
  const projeto = normalizarProjeto(meta['Projeto'] || meta['Destino'] || tipo || '');
  const bitola = normalizarBitola(meta['Tipo de dormente'] || projeto || meta['Bitola'] || tipo || '');
  const fornecedor = normalizarFornecedor(meta['Fornecedor'] || '');
  const dataInspecao = dataPtParaISO(meta['Data da fabricação/inspeção'] || meta['Data de produção'] || meta['Data da fabricação'] || meta['Data da inspeção'] || meta['Data do ensaio']) || hojeISO();
  const responsavel = limparValor(meta['Fiscal responsável'] || meta['Responsável'] || '');
  const resultado = inferirResultado(data, linhas);
  const dormentesReprovados = extrairDormentesReprovadosIauditor(data, linhas);

  const itensInspecionados = montarResumoItens(linhas);
  const naoConformidades = montarNaoConformidades(linhas, data);
  const acoesCorretivas = limparValor(encontrarValor(linhas, ['ação corretiva', 'acao corretiva', 'tratativa', 'plano de ação', 'plano de acao']));

  return {
    dataInspecao, lote, projeto, bitola, fornecedor, resultado, responsavel, dormentesReprovados,
    pista: limparValor(meta['Pista'] || encontrarValor(linhas, ['pista'])),
    trechoPosicao: limparValor(meta['Trecho'] || meta['Posição'] || meta['Posicao'] || meta['Local'] || encontrarValor(linhas, ['trecho', 'posição', 'posicao', 'local inspecionado', 'local'])),
    molde: limparValor(meta['Molde'] || encontrarValor(linhas, ['molde'])),
    cavidade: limparValor(meta['Cavidade'] || encontrarValor(linhas, ['cavidade'])),
    atividade: limparValor(meta['Atividade'] || meta['Etapa'] || encontrarValor(linhas, ['atividade', 'etapa', 'serviço', 'servico', 'inspeção', 'inspecao'])),
    itensInspecionados,
    naoConformidades,
    acoesCorretivas,
    linkRelatorio: '',
    arquivoOrigem: fileName,
    observacoes: montarObservacoes({ fileName, meta, tipo, linhas, dormentesReprovados }),
    tipo, linhas
  };
}

function extrairDormentesReprovadosIauditor(data, linhas) {
  const meta = data?.meta || {};
  const direto = normalizarQuantidadeReprovados(meta['Quantidade reprovada'] || meta['Dormentes reprovados'] || meta['Reprovados']);
  if (direto !== '') return direto;

  const porLinha = encontrarValor(linhas, [
    'quantidade reprovada', 'dormentes reprovados', 'qtd reprovados', 'qtde reprovados', 'reprovados'
  ]);
  const normalizadoLinha = normalizarQuantidadeReprovados(porLinha);
  if (normalizadoLinha !== '') return normalizadoLinha;

  const textos = [];
  (data?.sections || []).forEach(sec => {
    textos.push(sec.title || '');
    (sec.rows || []).forEach(row => textos.push(row.ensaio, row.name, row.valor, row.criterio, row.situacaoLabel));
  });
  return extrairQuantidadeReprovadaTexto(textos.filter(Boolean).join(' '));
}

function linhasPista(data) {
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
      if (CHAVES_LEITURA_PISTA.some(chave => n.includes(normTexto(chave)))) linhas.push(item);
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

function montarResumoItens(linhas) {
  const itens = (linhas || []).filter(l => !/^conclus/i.test(l.secao)).slice(0, 35)
    .map(l => `- ${l.secao} · ${l.campo}: ${l.valor}${l.situacaoLabel ? ` (${l.situacaoLabel})` : ''}`);
  return itens.join('\n');
}

function montarNaoConformidades(linhas, data) {
  const termos = ['não conforme', 'nao conforme', 'reprovado', 'pendente', 'falha', 'defeito', 'não conformidade', 'nao conformidade'];
  const ncs = (linhas || []).filter(l => {
    const texto = normTexto(`${l.secao} ${l.campo} ${l.valor} ${l.criterio} ${l.situacaoLabel}`);
    return l.situacao === 'fail' || termos.some(t => texto.includes(normTexto(t)));
  }).slice(0, 20).map(l => `- ${l.secao} · ${l.campo}: ${l.valor}${l.criterio ? ` (critério: ${l.criterio})` : ''}`);
  if (!ncs.length && data?.conclusao?.situacao === 'fail') {
    ncs.push(`- Conclusão: ${data.conclusao.valor || data.conclusao.ensaio || 'Relatório com reprovação.'}`);
  }
  return ncs.join('\n');
}

function ehRelatorioPista(data, registro, fileName) {
  const parts = [fileName, registro?.tipo, registro?.pista, registro?.trechoPosicao, registro?.molde, registro?.cavidade, registro?.atividade, registro?.itensInspecionados, registro?.naoConformidades];
  const meta = data?.meta || {};
  Object.keys(meta).forEach(k => parts.push(k, meta[k]));
  (data?.sections || []).forEach(sec => {
    parts.push(sec.title);
    (sec.rows || []).forEach(row => parts.push(row.ensaio, row.name, row.valor, row.criterio, row.situacaoLabel));
  });
  const texto = normTexto(parts.join(' '));
  const explicito = PALAVRAS_PISTA_EXPLICITAS.some(chave => texto.includes(normTexto(chave)));
  const sinalForte = SINAIS_PISTA.some(chave => texto.includes(normTexto(chave)));
  const temPista = texto.includes('pista');
  const contexto = CHAVES_CONTEXTO_PISTA.filter(chave => texto.includes(normTexto(chave))).length;
  const outroRelatorio = CHAVES_OUTROS_RELATORIOS.some(chave => texto.includes(normTexto(chave))) && !explicito;
  return (explicito || sinalForte || (temPista && contexto >= 3)) && !outroRelatorio;
}

function inferirTipoRelatorio(data) {
  const titulos = (data?.sections || []).map(s => s.title).filter(Boolean).join(' / ');
  return titulos || '';
}

function montarObservacoes({ fileName, meta, tipo, linhas, dormentesReprovados }) {
  const cab = [
    'Registro importado do leitor de relatórios iAuditor.',
    `Arquivo: ${fileName}`,
    `Tipo de relatório: ${tipo || '—'}`,
  ];
  const metaTxt = Object.keys(meta || {}).slice(0, 16).map(k => `${k}: ${meta[k]}`).join(' | ');
  const det = (linhas || []).slice(0, 45).map(l => `- ${l.secao} · ${l.campo}: ${l.valor}${l.criterio ? ` (critério: ${l.criterio})` : ''}`);
  const qtdReprovados = normalizarQuantidadeReprovados(dormentesReprovados) || extrairQuantidadeReprovadaTexto(metaTxt) || extrairQuantidadeReprovadaTexto(det.join(' '));
  return cab.concat(
    metaTxt ? [`Metadados lidos: ${metaTxt}`] : [],
    qtdReprovados !== '' ? [`Dormentes reprovados: ${qtdReprovados}`] : [],
    det.length ? ['Leituras de inspeção de pista:', ...det] : []
  ).join('\n');
}

function renderLeituraIauditorLote() {
  const alvo = document.getElementById('iauditorResultado');
  if (!alvo) return;
  const itens = IAUDITOR_RELATORIOS;
  if (!itens.length) { alvo.innerHTML = ''; return; }

  const podeCriar = Auth.pode('criar');
  const validos = itens.filter(it => it.valido);
  const invalidos = itens.filter(it => !it.valido);

  const resumo = `
    <div class="iauditor-status ${validos.length ? 'ok' : 'aviso'}">
      <h3>Leitura concluída — ${itens.length} PDF(s) processado(s)</h3>
      <p>
        ${validos.length} identificado(s) como <strong>Inspeção de Pista</strong> · ${invalidos.length} não identificado(s).
        ${validos.length
          ? (podeCriar
              ? 'Marque os relatórios que deseja registrar nesta página e salve todos de uma só vez. O link do relatório é opcional — você pode colar agora em cada um ou anexar depois pelo botão Editar.'
              : 'Modo consulta: leitura sem registro.')
          : 'Nenhum dos PDFs foi identificado como Inspeção de Pista, então não há o que salvar nesta página.'}
      </p>
    </div>`;

  const barra = (podeCriar && validos.length) ? `
    <div class="iauditor-lote-barra">
      <label class="iauditor-lote-seltodos"><input type="checkbox" id="iaSelTodos" checked onchange="alternarTodosIauditor(this.checked)"> Selecionar todos os identificados</label>
      <span class="txt-mini txt-cinza" id="iaContadorSel"></span>
      <button class="btn btn-primario" type="button" onclick="salvarLeiturasIauditorSelecionadas()">${ICN.check}Salvar selecionados</button>
    </div>` : '';

  const cardsValidos = validos.map(it => {
    const idx = itens.indexOf(it);
    const r = it.registro;
    return `
      <div class="iauditor-lote-item" data-idx="${idx}">
        <div class="iauditor-lote-item-cab">
          <label class="iauditor-lote-check">
            ${podeCriar ? `<input type="checkbox" class="ia-check" data-idx="${idx}" checked onchange="atualizarContadorIauditor()">` : ''}
            <strong>${U.esc(it.fileName)}</strong>
          </label>
          <span class="iauditor-chip ok">Inspeção de Pista</span>
        </div>
        <div class="iauditor-meta-grid">
          ${metaItem('Lote', r.lote)}
          ${metaItem('Projeto', r.projeto)}
          ${metaItem('Bitola', r.bitola)}
          ${metaItem('Pista', r.pista)}
          ${metaItem('Trecho / posição', r.trechoPosicao)}
          ${metaItem('Data', U.dataBR(r.dataInspecao))}
          ${metaItem('Responsável', r.responsavel)}
          ${metaItem('Reprovados', r.dormentesReprovados || '—')}
        </div>
        ${podeCriar ? `
        <div class="form-grid" style="margin-top:10px">
          <div class="campo full"><label>Link do relatório <span class="dica">(opcional — pode anexar depois)</span></label><input id="iaLink_${idx}" type="url" placeholder="https://..." value="${U.esc(it.linkDigitado || '')}"></div>
        </div>
        <div class="iauditor-acoes">
          <button class="btn btn-secundario" type="button" onclick="preencherModalComLeitura(${idx})">Editar antes de salvar</button>
        </div>` : ''}
      </div>`;
  }).join('');

  const cardsInvalidos = invalidos.length ? `
    <div class="iauditor-lote-grupo-titulo">Não identificados como Inspeção de Pista (não serão salvos)</div>
    ${invalidos.map(it => {
      const idx = itens.indexOf(it);
      const r = it.registro;
      return `
        <div class="iauditor-lote-item invalido" data-idx="${idx}">
          <div class="iauditor-lote-item-cab">
            <strong>${U.esc(it.fileName)}</strong>
            <span class="iauditor-chip ${it.erro ? 'erro' : 'aviso'}">${it.erro ? 'Falha na leitura' : 'Não identificado'}</span>
          </div>
          ${it.erro
            ? '<p class="txt-mini txt-cinza" style="margin-top:8px">Não foi possível ler este PDF. Confira se é um relatório exportado do iAuditor.</p>'
            : `<div class="iauditor-meta-grid">
                 ${metaItem('Tipo', r?.tipo)}
                 ${metaItem('Lote', r?.lote)}
                 ${metaItem('Projeto', r?.projeto)}
                 ${metaItem('Data', U.dataBR(r?.dataInspecao))}
               </div>`}
        </div>`;
    }).join('')}` : '';

  alvo.innerHTML = `${resumo}${barra}<div class="iauditor-lote-lista">${cardsValidos}${cardsInvalidos}</div>`;
  atualizarContadorIauditor();
}

function indicesSelecionadosIauditor() {
  return Array.from(document.querySelectorAll('#iauditorResultado .ia-check:checked'))
    .map(cb => parseInt(cb.getAttribute('data-idx'), 10))
    .filter(n => !Number.isNaN(n));
}

function atualizarContadorIauditor() {
  const selecionados = indicesSelecionadosIauditor().length;
  const total = IAUDITOR_RELATORIOS.filter(it => it.valido).length;
  const cont = document.getElementById('iaContadorSel');
  if (cont) cont.textContent = `${selecionados} de ${total} selecionado(s)`;
  const todos = document.getElementById('iaSelTodos');
  if (todos) todos.checked = total > 0 && selecionados === total;
}

function alternarTodosIauditor(marcar) {
  document.querySelectorAll('#iauditorResultado .ia-check').forEach(cb => { cb.checked = !!marcar; });
  atualizarContadorIauditor();
}

function capturarLinksIauditor() {
  IAUDITOR_RELATORIOS.forEach((it, i) => {
    const el = document.getElementById('iaLink_' + i);
    if (el) it.linkDigitado = el.value.trim();
  });
}

function metaItem(rot, val) {
  return `<div class="iauditor-meta-item"><div class="rot">${U.esc(rot)}</div><div class="val">${U.esc(val || '—')}</div></div>`;
}

async function salvarLeiturasIauditorSelecionadas() {
  if (!Auth.pode('criar')) { App.toast(Auth.mensagemSemPermissao('criar registros'), 'aviso'); return; }
  capturarLinksIauditor();
  const indices = indicesSelecionadosIauditor();
  if (!indices.length) { App.toast('Selecione ao menos um relatório identificado como Inspeção de Pista.', 'aviso'); return; }

  const btn = document.querySelector('#iauditorResultado .iauditor-lote-barra .btn-primario');
  const txt = btn?.innerHTML;
  if (btn) btn.disabled = true;

  const salvosIdx = [];
  const falhas = [];
  for (let k = 0; k < indices.length; k++) {
    const idx = indices[k];
    const atual = IAUDITOR_RELATORIOS[idx];
    if (!atual?.registro || !atual.valido) continue;
    if (btn) btn.innerHTML = `Salvando ${k + 1} de ${indices.length}...`;

    const reg = {};
    CAMPOS_PISTA.forEach(c => { reg[c] = atual.registro[c] != null ? atual.registro[c] : ''; });
    reg.linkRelatorio = atual.linkDigitado || '';
    try {
      const salvo = await StoreSupabase.salvarInspecaoPista(mapParaBanco(reg));
      PISTA_REGISTROS.unshift(mapDoBanco(salvo));
      salvosIdx.push(idx);
    } catch (err) {
      console.error('Erro ao salvar leitura iAuditor (lote)', atual.fileName, err);
      falhas.push(atual.fileName);
    }
  }

  if (btn) { btn.disabled = false; btn.innerHTML = txt || 'Salvar selecionados'; }

  // Mantém na tela apenas os que NÃO foram salvos (falhas + não selecionados + não identificados)
  IAUDITOR_RELATORIOS = IAUDITOR_RELATORIOS.filter((_, i) => !salvosIdx.includes(i));
  render();

  if (salvosIdx.length) App.toast(`${salvosIdx.length} relatório(s) de inspeção de pista salvo(s) no histórico.`);
  if (falhas.length) App.toast(`${falhas.length} relatório(s) não puderam ser salvos. Tente novamente.`, 'erro');

  if (IAUDITOR_RELATORIOS.length) {
    renderLeituraIauditorLote();
  } else {
    const alvo = document.getElementById('iauditorResultado');
    if (alvo) {
      const msgLinks = salvosIdx.length ? ' Para anexar o link de cada relatório, use o botão Editar na lista abaixo, lote a lote.' : '';
      alvo.innerHTML = `<div class="iauditor-status ok"><h3>${salvosIdx.length} relatório(s) salvo(s)</h3><p>Os relatórios identificados foram registrados no histórico de inspeções de pista.${msgLinks}</p></div>`;
    }
  }
}

function preencherModalComLeitura(idx) {
  if (!Auth.pode('criar')) { App.toast(Auth.mensagemSemPermissao('criar registros'), 'aviso'); return; }
  capturarLinksIauditor();
  const atual = (typeof idx === 'number') ? IAUDITOR_RELATORIOS[idx] : null;
  if (!atual?.registro) { abrirNovo(); return; }
  if (!atual.valido) { App.toast('Este PDF não foi identificado como Inspeção de Pista.', 'aviso'); return; }
  IAUDITOR_RELATORIO_ATUAL = atual;
  IAUDITOR_EDIT_IDX = idx;
  const r = atual.registro;
  document.getElementById('form').reset();
  document.getElementById('id').value = '';
  CAMPOS_PISTA.forEach(c => setValor(c, r[c] != null ? r[c] : ''));
  if (atual.linkDigitado) setValor('linkRelatorio', atual.linkDigitado);
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
  return code === 'PGRST205' || code === '42P01' || (msg.includes('inspecoes_pista') && (msg.includes('does not exist') || msg.includes('could not find') || msg.includes('schema cache')));
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
window.salvarLeiturasIauditorSelecionadas = salvarLeiturasIauditorSelecionadas;
window.alternarTodosIauditor = alternarTodosIauditor;
window.atualizarContadorIauditor = atualizarContadorIauditor;
window.preencherModalComLeitura = preencherModalComLeitura;
