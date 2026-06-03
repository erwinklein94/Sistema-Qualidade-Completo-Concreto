/* =====================================================================
   PEDIDOS.JS — Pedidos de lotes de dormentes de concreto
   ===================================================================== */
const PEDIDOS_FORNECEDORES = ['Cavan', 'Conprem'];
const PEDIDOS_PROJETOS = ['FERRO NORTE', 'MALHA PAULISTA BITOLA LARGA', 'MALHA PAULISTA BITOLA MISTA', 'FMT', 'MALHA CENTRAL'];
const PEDIDOS_STATUS = ['Novo', 'Planejado', 'Em produção', 'Atendido'];

let PEDIDOS_REGISTROS = [];
let PEDIDOS_PRODUCAO = [];
let PEDIDOS_CARREGANDO = true;
let PEDIDOS_ERRO = '';

const PEDIDOS_COLUNAS_EXPORT = [
  { key: 'numeroPedido', label: 'N° Pedido' },
  { key: 'fornecedor', label: 'Fornecedor' },
  { key: 'projeto', label: 'Projeto' },
  { key: 'quantidade', label: 'Quantidade pedida' },
  { key: 'produzido', label: 'Produzido vinculado' },
  { key: 'saldo', label: 'Saldo' },
  { key: 'status', label: 'Status' },
  { key: 'lotesPlanejadosTxt', label: 'Lotes previstos / vinculados' },
  { key: 'lotesProduzidosTxt', label: 'Lotes produzidos no pedido' },
  { key: 'observacoes', label: 'Observações' },
];

document.addEventListener('DOMContentLoaded', async () => {
  document.body.classList.add('pagina-pedidos-body');
  if (!await Auth.exigirLogin()) return;

  App.montarLayout('pedidos', 'Pedidos', 'Pedidos de lotes de dormentes de concreto feitos pela Rumo');
  App.acoesTopo(`
    <button class="btn btn-secundario" onclick="location.href='producao.html'">${ICN.producao}Produção</button>
    ${Auth.pode('criar') ? `<button class="btn btn-primario" onclick="abrirNovoPedido()">${ICN.add}Novo pedido</button>` : App.avisoModoConsulta()}
  `);

  preencherSelect('fornecedor', PEDIDOS_FORNECEDORES, 'Selecione...');
  preencherSelect('projeto', PEDIDOS_PROJETOS, 'Selecione...');
  preencherSelect('fFornecedor', PEDIDOS_FORNECEDORES, 'Todos');
  preencherSelect('fProjeto', PEDIDOS_PROJETOS, 'Todos');

  ['busca', 'fFornecedor', 'fProjeto', 'fStatus'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', renderPedidos);
    if (el) el.addEventListener('change', renderPedidos);
  });

  renderPedidos();
  await carregarPedidos();
});

function preencherSelect(id, arr, placeholder) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = U.opcoes(arr, '', placeholder);
}

async function carregarPedidos() {
  PEDIDOS_CARREGANDO = true;
  PEDIDOS_ERRO = '';
  renderPedidos();

  try {
    if (!StoreSupabase.listarPedidosDormentes) throw new Error('Função listarPedidosDormentes não encontrada. Atualize js/store-supabase.js.');
    const [pedidos, producao] = await Promise.all([
      StoreSupabase.listarPedidosDormentes({ limite: 5000 }),
      StoreSupabase.listarProducao({ limite: 10000 }),
    ]);
    PEDIDOS_REGISTROS = (pedidos || []).map(mapPedidoDoBanco);
    PEDIDOS_PRODUCAO = (producao || []).map(mapProducaoDoBancoSimples);
    PEDIDOS_CARREGANDO = false;
    renderPedidos();
  } catch (err) {
    console.error('Erro ao carregar pedidos', err);
    PEDIDOS_CARREGANDO = false;
    PEDIDOS_ERRO = mensagemErroPedidos(err, 'Não foi possível carregar os pedidos no Supabase.');
    App.toast(PEDIDOS_ERRO, 'erro');
    renderPedidos();
  }
}

function renderPedidos() {
  const q = String(document.getElementById('busca')?.value || '').trim().toLowerCase();
  const fornecedor = document.getElementById('fFornecedor')?.value || '';
  const projeto = document.getElementById('fProjeto')?.value || '';
  const status = document.getElementById('fStatus')?.value || '';
  const todos = PEDIDOS_REGISTROS.map(enriquecerPedido);

  const lista = todos.filter(p => {
    if (fornecedor && p.fornecedor !== fornecedor) return false;
    if (projeto && p.projeto !== projeto) return false;
    if (status && p.status !== status) return false;
    if (q) {
      const blob = [
        p.numeroPedido, p.fornecedor, p.projeto, p.status, p.observacoes,
        ...p.lotesPlanejados, ...p.lotesProduzidos.map(l => l.lote)
      ].join(' ').toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => String(b.criadoEm || '').localeCompare(String(a.criadoEm || '')) || String(a.numeroPedido).localeCompare(String(b.numeroPedido)));

  renderKpisPedidos(lista);
  registrarExportacaoPedidos(lista);

  const contador = document.getElementById('contadorPedidos');
  if (contador) contador.textContent = PEDIDOS_CARREGANDO
    ? 'Carregando do Supabase...'
    : `${lista.length} de ${PEDIDOS_REGISTROS.length} pedido(s)`;

  const alvo = document.getElementById('listaPedidos');
  if (!alvo) return;

  if (PEDIDOS_CARREGANDO) {
    alvo.innerHTML = `<div class="card pedidos-grid-full"><div class="vazio">${ICN.vazioBox}<h3>Carregando pedidos</h3><p>Buscando pedidos e lotes de produção no Supabase...</p></div></div>`;
    return;
  }

  if (PEDIDOS_ERRO) {
    alvo.innerHTML = `<div class="card pedidos-grid-full"><div class="vazio">${ICN.alerta}<h3>Pedidos indisponíveis</h3><p>${U.esc(PEDIDOS_ERRO)}</p><button class="btn btn-secundario" onclick="carregarPedidos()">Tentar novamente</button></div></div>`;
    return;
  }

  if (!lista.length) {
    alvo.innerHTML = `<div class="card pedidos-grid-full"><div class="vazio">${ICN.vazioBox}<h3>Nenhum pedido encontrado</h3><p>${PEDIDOS_REGISTROS.length ? 'Ajuste os filtros para visualizar outros pedidos.' : 'Cadastre o primeiro pedido feito pela Rumo.'}</p></div></div>`;
    return;
  }

  alvo.innerHTML = lista.map(cardPedido).join('');
}

function renderKpisPedidos(lista) {
  const alvo = document.getElementById('kpisPedidos');
  if (!alvo) return;
  const totalPedidos = lista.length;
  const totalSolicitado = soma(lista, 'quantidade');
  const totalProduzido = soma(lista, 'produzido');
  const saldo = Math.max(0, totalSolicitado - totalProduzido);
  alvo.innerHTML = `
    <div class="kpi escuro"><div class="rotulo">Pedidos</div><div class="valor">${fmt(totalPedidos)}</div><div class="extra">card(s) no filtro atual</div></div>
    <div class="kpi"><div class="rotulo">Dormentes pedidos</div><div class="valor">${fmt(totalSolicitado)}</div><div class="extra">quantidade solicitada pela Rumo</div></div>
    <div class="kpi verde"><div class="rotulo">Produzidos vinculados</div><div class="valor">${fmt(totalProduzido)}</div><div class="extra">lotes da aba Produção com mesmo N° Pedido</div></div>
    <div class="kpi amarelo"><div class="rotulo">Saldo</div><div class="valor">${fmt(saldo)}</div><div class="extra">dormentes ainda não vinculados</div></div>`;
}

function cardPedido(p) {
  const lotesPlanejados = chipsLotes(p.lotesPlanejados, 'Nenhum lote previsto informado.');
  const lotesProduzidos = p.lotesProduzidos.length
    ? p.lotesProduzidos.map(l => `<span class="pedido-lote-chip produzido" title="${U.esc(l.status || '')}"><strong>${U.esc(l.lote || 'Sem lote')}</strong><small>${fmt(l.total)} dorm. · ${U.dataBR(l.dataFabricacao)}</small></span>`).join('')
    : '<span class="txt-mini txt-cinza">Nenhum lote de produção vinculado ainda.</span>';
  const obs = p.observacoes ? `<p class="pedido-observacao">${U.esc(p.observacoes)}</p>` : '';
  const pct = Math.max(0, Math.min(100, p.percentual));

  return `<article class="card pedido-card pedido-status-${slug(p.status)}">
    <div class="pedido-card-topo">
      <div>
        <span class="pedido-label">Pedido</span>
        <h3>${U.esc(p.numeroPedido || 'Sem número')}</h3>
      </div>
      <span class="badge ${classeStatusPedido(p.status)}">${U.esc(p.status)}</span>
    </div>

    <div class="pedido-badges">
      <span class="badge badge-entregue">${U.esc(p.fornecedor || '—')}</span>
      ${U.badgeProjeto(p.projeto || '—')}
    </div>

    <div class="pedido-card-kpis">
      <div><span>Pedido</span><strong>${fmt(p.quantidade)}</strong></div>
      <div><span>Produzido</span><strong>${fmt(p.produzido)}</strong></div>
      <div><span>Saldo</span><strong>${fmt(p.saldo)}</strong></div>
    </div>

    <div class="pedido-progresso" title="${pct}% produzido"><span style="width:${pct}%"></span></div>

    <div class="pedido-secao">
      <strong>Lotes previstos / vinculados</strong>
      <div class="pedido-lotes">${lotesPlanejados}</div>
    </div>

    <div class="pedido-secao">
      <strong>Lotes já produzidos no pedido</strong>
      <div class="pedido-lotes">${lotesProduzidos}</div>
    </div>

    ${obs}

    <div class="pedido-card-acoes">
      ${Auth.pode('editar') ? `<button class="btn btn-secundario btn-sm" onclick="editarPedido('${p.id}')">${ICN.edit}Editar</button>` : ''}
      ${Auth.pode('excluir') ? `<button class="btn btn-perigo btn-sm" onclick="excluirPedido('${p.id}')">${ICN.del}Excluir</button>` : ''}
    </div>
  </article>`;
}

function abrirNovoPedido() {
  if (!Auth.pode('criar')) { App.toast(Auth.mensagemSemPermissao('criar registros'), 'aviso'); return; }
  document.getElementById('formPedido')?.reset();
  document.getElementById('id').value = '';
  document.getElementById('modalTitulo').textContent = 'Novo pedido';
  document.getElementById('modalPedido').classList.add('aberto');
}

function editarPedido(id) {
  if (!Auth.pode('editar')) { App.toast(Auth.mensagemSemPermissao('editar registros'), 'aviso'); return; }
  const p = PEDIDOS_REGISTROS.find(x => String(x.id) === String(id));
  if (!p) return;
  document.getElementById('id').value = p.id;
  document.getElementById('fornecedor').value = p.fornecedor || '';
  document.getElementById('projeto').value = p.projeto || '';
  document.getElementById('numeroPedido').value = p.numeroPedido || '';
  document.getElementById('quantidade').value = p.quantidade || 0;
  document.getElementById('lotesPlanejados').value = (p.lotesPlanejados || []).join('\n');
  document.getElementById('observacoes').value = p.observacoes || '';
  document.getElementById('modalTitulo').textContent = `Editar pedido ${p.numeroPedido || ''}`;
  document.getElementById('modalPedido').classList.add('aberto');
}

async function salvarPedido() {
  const editando = !!document.getElementById('id')?.value;
  if (!Auth.pode(editando ? 'editar' : 'criar')) {
    App.toast(Auth.mensagemSemPermissao(editando ? 'editar registros' : 'criar registros'), 'aviso');
    return;
  }

  const fornecedor = document.getElementById('fornecedor').value;
  const projeto = document.getElementById('projeto').value;
  const numeroPedido = document.getElementById('numeroPedido').value.trim();
  const quantidade = inteiro(document.getElementById('quantidade').value);

  if (!fornecedor || !projeto || !numeroPedido || quantidade < 0) {
    App.toast('Preencha fornecedor, projeto, N° Pedido e quantidade.', 'aviso');
    return;
  }

  const payload = mapPedidoParaBanco({
    id: document.getElementById('id').value || undefined,
    fornecedor,
    projeto,
    numeroPedido,
    quantidade,
    lotesPlanejados: lotesDoTextarea(document.getElementById('lotesPlanejados').value),
    observacoes: document.getElementById('observacoes').value,
  });

  const btn = document.querySelector('#modalPedido .form-acoes .btn-primario');
  const textoOriginal = btn?.innerHTML;
  if (btn) { btn.disabled = true; btn.innerHTML = 'Salvando...'; }

  try {
    const salvo = await StoreSupabase.salvarPedidoDormente(payload);
    const convertido = mapPedidoDoBanco(salvo);
    const idx = PEDIDOS_REGISTROS.findIndex(x => String(x.id) === String(convertido.id));
    if (idx >= 0) PEDIDOS_REGISTROS[idx] = convertido;
    else PEDIDOS_REGISTROS.unshift(convertido);
    App.toast('Pedido salvo no Supabase.');
    fecharModalPedido();
    renderPedidos();
  } catch (err) {
    console.error('Erro ao salvar pedido', err);
    App.toast(mensagemErroPedidos(err, 'Não foi possível salvar o pedido no Supabase.'), 'erro');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = textoOriginal || 'Salvar pedido'; }
  }
}

async function excluirPedido(id) {
  const p = PEDIDOS_REGISTROS.find(x => String(x.id) === String(id));
  if (!p) return;
  if (!Auth.pode('excluir')) { App.toast(Auth.mensagemSemPermissao('excluir registros'), 'aviso'); return; }
  if (!App.confirmar(`Excluir o pedido ${p.numeroPedido}?`)) return;
  try {
    await StoreSupabase.removerPedidoDormente(id);
    PEDIDOS_REGISTROS = PEDIDOS_REGISTROS.filter(x => String(x.id) !== String(id));
    App.toast('Pedido excluído do Supabase.', 'aviso');
    renderPedidos();
  } catch (err) {
    console.error('Erro ao excluir pedido', err);
    App.toast(mensagemErroPedidos(err, 'Não foi possível excluir o pedido no Supabase.'), 'erro');
  }
}

function fecharModalPedido() { document.getElementById('modalPedido').classList.remove('aberto'); }

function enriquecerPedido(p) {
  const chave = normalizarPedido(p.numeroPedido);
  const lotesProduzidos = PEDIDOS_PRODUCAO.filter(l => normalizarPedido(l.pedido) === chave && chave && chave !== 'N/A');
  const produzido = lotesProduzidos.reduce((acc, l) => acc + inteiro(l.total), 0);
  const quantidade = inteiro(p.quantidade);
  const saldo = Math.max(0, quantidade - produzido);
  const percentual = quantidade > 0 ? Math.round((produzido / quantidade) * 100) : 0;
  return {
    ...p,
    quantidade,
    produzido,
    saldo,
    percentual,
    lotesProduzidos,
    status: statusPedido(quantidade, produzido, p.lotesPlanejados),
  };
}

function statusPedido(quantidade, produzido, lotesPlanejados) {
  if (quantidade > 0 && produzido >= quantidade) return 'Atendido';
  if (produzido > 0) return 'Em produção';
  if ((lotesPlanejados || []).length) return 'Planejado';
  return 'Novo';
}

function classeStatusPedido(status) {
  if (status === 'Atendido') return 'badge-ok';
  if (status === 'Em produção') return 'badge-cura';
  if (status === 'Planejado') return 'badge-amarelo';
  return 'badge-entregue';
}

function chipsLotes(lotes, vazio) {
  if (!lotes || !lotes.length) return `<span class="txt-mini txt-cinza">${U.esc(vazio)}</span>`;
  return lotes.map(l => `<span class="pedido-lote-chip">${U.esc(l)}</span>`).join('');
}

function mapPedidoDoBanco(r) {
  return {
    id: r.id,
    fornecedor: r.fornecedor || '',
    projeto: r.projeto || '',
    numeroPedido: r.numero_pedido || '',
    quantidade: inteiro(r.quantidade_dormentes),
    lotesPlanejados: arrayTexto(r.lotes_planejados),
    observacoes: r.observacoes || '',
    criadoEm: r.criado_em || '',
    atualizadoEm: r.atualizado_em || '',
  };
}

function mapPedidoParaBanco(reg) {
  const payload = {
    fornecedor: textoOuNull(reg.fornecedor),
    projeto: textoOuNull(reg.projeto),
    numero_pedido: textoOuNull(reg.numeroPedido),
    quantidade_dormentes: inteiro(reg.quantidade),
    lotes_planejados: arrayTexto(reg.lotesPlanejados),
    observacoes: textoOuNull(reg.observacoes),
  };
  if (reg.id) payload.id = reg.id;
  return payload;
}

function mapProducaoDoBancoSimples(r) {
  return {
    id: r.id,
    fornecedor: r.fornecedor || '',
    projeto: r.projeto || '',
    pedido: r.pedido || '',
    lote: r.lote || '',
    total: inteiro(r.total_produzido),
    dataFabricacao: dataBanco(r.data_fabricacao),
    status: r.status || '',
  };
}

function registrarExportacaoPedidos(lista) {
  if (!window.Exportacoes) return;
  const rows = lista.map(p => ({
    ...p,
    lotesPlanejadosTxt: (p.lotesPlanejados || []).join(', '),
    lotesProduzidosTxt: (p.lotesProduzidos || []).map(l => `${l.lote} (${fmt(l.total)})`).join(', '),
  }));
  Exportacoes.registrar({
    titulo: 'Pedidos de Dormentes de Concreto',
    nomeArquivo: 'pedidos-dormentes',
    filtros: Exportacoes.filtrosDaTela(),
    observacao: 'Fonte: Supabase. Lotes produzidos são vinculados pelo N° Pedido informado na aba Produção.',
    secoes: [{ titulo: 'Pedidos', columns: PEDIDOS_COLUNAS_EXPORT, rows }],
  });
}

function mensagemErroPedidos(err, padrao) {
  const msg = err?.message || err?.details || '';
  if (/pedidos_dormentes|relation .* does not exist|Could not find the table|schema cache/i.test(msg)) {
    return 'Tabela pedidos_dormentes ainda não foi criada no Supabase. Rode o arquivo supabase/2026-06-03-pedidos-dormentes.sql no SQL Editor.';
  }
  if (/duplicate key|unique constraint/i.test(msg)) return 'Já existe um pedido com esse número no Supabase.';
  if (/row-level security|violates row-level security/i.test(msg)) return 'Acesso bloqueado pelas regras de segurança do Supabase. Confira seu perfil em usuarios_app.';
  if (/JWT|token|auth/i.test(msg)) return 'Sessão expirada ou inválida. Saia e faça login novamente.';
  return msg || padrao;
}

function arrayTexto(valor) {
  if (Array.isArray(valor)) return valor.map(v => String(v || '').trim()).filter(Boolean);
  if (valor == null) return [];
  if (typeof valor === 'string') {
    const s = valor.trim();
    if (!s) return [];
    try {
      const json = JSON.parse(s);
      if (Array.isArray(json)) return json.map(v => String(v || '').trim()).filter(Boolean);
    } catch (_) {}
    return lotesDoTextarea(s);
  }
  return [];
}

function lotesDoTextarea(valor) {
  return Array.from(new Set(String(valor || '')
    .split(/[\n;,]+/)
    .map(v => v.trim())
    .filter(Boolean)));
}

function normalizarPedido(v) { return String(v == null ? '' : v).replace(/\s+/g, '').trim().toUpperCase(); }
function slug(v) { return U.norm(v).replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'novo'; }
function soma(lista, campo) { return (lista || []).reduce((acc, item) => acc + inteiro(item[campo]), 0); }
function fmt(n) { return inteiro(n).toLocaleString('pt-BR'); }
function inteiro(v) { const n = parseInt(String(v == null ? '' : v).replace(/[^0-9-]/g, ''), 10); return Number.isFinite(n) ? n : 0; }
function dataBanco(v) { return v ? String(v).slice(0, 10) : ''; }
function textoOuNull(v) { const s = String(v == null ? '' : v).trim(); return s ? s : null; }

window.render = renderPedidos;
