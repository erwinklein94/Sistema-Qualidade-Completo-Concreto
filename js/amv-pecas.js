/* =====================================================================
   AMV-PECAS.JS — Peças de AMV inspecionadas

   Uma linha por peça descrita nos relatórios, com a classificação
   deduzida do texto (família, trilho, inclinação, mão, geometria,
   montagem, derivação) e o defeito, quando houver.

   Aceita ?inspecao=<id> na URL: é assim que o detalhe da inspeção manda
   o usuário direto para as peças daquele relatório.
   ===================================================================== */
'use strict';

let PECAS_REGISTROS = [];
let PECAS_INSPECOES = [];
let PECAS_CARREGANDO = false;
let PECAS_ERRO = '';
let PECAS_TABELA_FALTANDO = false;
let PECAS_INSPECAO_FIXA = '';

document.addEventListener('DOMContentLoaded', async () => {
  if (!await Auth.exigirLogin()) return;

  App.montarLayout('amv-pecas', 'Peças de AMV', 'Peças inspecionadas, classificação e defeitos registrados');
  configurarAcoesTopo();

  PECAS_INSPECAO_FIXA = new URLSearchParams(location.search).get('inspecao') || '';

  Amv.preencherSelect('fFamilia', Amv.FAMILIAS, 'Todas as famílias');
  Amv.preencherSelect('fTrilho', Amv.TRILHOS, 'Todos os trilhos');
  Amv.preencherSelect('fInclinacao', Amv.INCLINACOES, 'Todas as inclinações');
  Amv.preencherSelect('fMao', Amv.MAOS, 'Todas');
  Amv.preencherSelect('fMontagem', Amv.MONTAGENS, 'Todas');

  ['busca', 'fFamilia', 'fTrilho', 'fInclinacao', 'fMao', 'fMontagem', 'fFornecedor', 'fDefeito', 'fDataIni', 'fDataFim'].forEach(id => {
    const el = document.getElementById(id);
    el?.addEventListener(el.tagName === 'INPUT' && el.type === 'text' ? 'input' : 'change', render);
  });

  await carregar();
});

function configurarAcoesTopo() {
  const podeCriar = window.Auth?.pode?.('criar');
  App.acoesTopo(`${podeCriar
    ? `<button class="btn btn-primario btn-sm" type="button" onclick="abrirNovo()">${ICN.add}<span>Nova peça</span></button>`
    : App.avisoModoConsulta()}
    <button class="btn btn-secundario btn-sm" type="button" onclick="carregar()">${ICN.check}<span>Atualizar</span></button>`);
}

async function carregar() {
  PECAS_CARREGANDO = true;
  PECAS_ERRO = '';
  PECAS_TABELA_FALTANDO = false;
  render();

  try {
    const [pecas, inspecoes] = await Promise.all([
      StoreAmv.listarPecas({ limite: 20000 }),
      StoreAmv.listarInspecoes({ limite: 10000, semFilhos: true }),
    ]);
    PECAS_REGISTROS = pecas;
    PECAS_INSPECOES = inspecoes;
    Amv.preencherSelect('fFornecedor', Amv.valoresDe(inspecoes, i => Amv.fornecedor(i)), 'Todos os fornecedores');
    preencherSelectInspecoes();
  } catch (err) {
    console.error('Erro ao carregar peças de AMV:', err);
    PECAS_TABELA_FALTANDO = StoreAmv.tabelaFaltando(err);
    PECAS_ERRO = StoreAmv.mensagemErro(err, 'Não foi possível carregar as peças de AMV.');
  } finally {
    PECAS_CARREGANDO = false;
    configurarAcoesTopo();
    render();
  }
}

function preencherSelectInspecoes() {
  const el = document.getElementById('inspecaoId');
  if (!el) return;
  const atual = el.value;
  const ordenadas = [...PECAS_INSPECOES].sort((a, b) =>
    String(b.data_inspecao || '').localeCompare(String(a.data_inspecao || '')));
  el.innerHTML = `<option value="">Selecione a inspeção</option>${ordenadas.map(i =>
    `<option value="${U.esc(i.id)}">${U.esc(`${U.dataBR(i.data_inspecao)} · ${Amv.fornecedor(i)} · pedido ${i.numero_pedido || '—'}`)}</option>`).join('')}`;
  if (atual) el.value = atual;
}

function inspecaoDe(peca) {
  return peca?.inspecao || PECAS_INSPECOES.find(i => i.id === peca?.inspecao_id) || null;
}

function filtradas() {
  const busca = U.norm(document.getElementById('busca')?.value || '');
  const f = {
    familia: document.getElementById('fFamilia')?.value || '',
    trilho: document.getElementById('fTrilho')?.value || '',
    inclinacao: document.getElementById('fInclinacao')?.value || '',
    mao: document.getElementById('fMao')?.value || '',
    montagem: document.getElementById('fMontagem')?.value || '',
    fornecedor: document.getElementById('fFornecedor')?.value || '',
    defeito: document.getElementById('fDefeito')?.value || '',
    ini: document.getElementById('fDataIni')?.value || '',
    fim: document.getElementById('fDataFim')?.value || '',
  };

  return PECAS_REGISTROS.filter(p => {
    if (PECAS_INSPECAO_FIXA && p.inspecao_id !== PECAS_INSPECAO_FIXA) return false;
    if (f.familia && p.familia !== f.familia) return false;
    if (f.trilho && p.trilho !== f.trilho) return false;
    if (f.inclinacao && p.inclinacao !== f.inclinacao) return false;
    if (f.mao && p.mao !== f.mao) return false;
    if (f.montagem && p.montagem !== f.montagem) return false;
    if (f.defeito === 'com' && p.tem_defeito !== true) return false;
    if (f.defeito === 'sem' && p.tem_defeito === true) return false;

    const insp = inspecaoDe(p);
    if (f.fornecedor && Amv.fornecedor(insp) !== f.fornecedor) return false;
    const d = String(insp?.data_inspecao || '');
    if (f.ini && (!d || d < f.ini)) return false;
    if (f.fim && (!d || d > f.fim)) return false;

    if (busca) {
      const texto = U.norm([
        p.tipo_peca, p.tipo_peca_notas, p.numero_pedido, p.familia, p.trilho, p.inclinacao,
        Amv.fornecedor(insp), insp?.responsavel, insp?.numero_pedido,
        Amv.defeitos(p).map(x => x.descricao).join(' '),
      ].filter(Boolean).join(' '));
      if (!texto.includes(busca)) return false;
    }
    return true;
  }).sort((a, b) => {
    const da = String(inspecaoDe(a)?.data_inspecao || '');
    const dbb = String(inspecaoDe(b)?.data_inspecao || '');
    return dbb.localeCompare(da) || (a.indice || 0) - (b.indice || 0);
  });
}

function render() {
  renderAvisoInspecao();
  const lista = filtradas();
  renderKpis(lista);
  renderTabela(lista, PECAS_REGISTROS.length);
}

function renderAvisoInspecao() {
  const alvo = document.getElementById('avisoInspecao');
  if (!alvo) return;
  if (!PECAS_INSPECAO_FIXA) { alvo.innerHTML = ''; return; }
  const insp = PECAS_INSPECOES.find(i => i.id === PECAS_INSPECAO_FIXA);
  const nome = insp ? `${Amv.fornecedor(insp)} · ${U.dataBR(insp.data_inspecao)}` : 'inspeção selecionada';
  alvo.innerHTML = `<div class="aviso-info">Mostrando apenas as peças de <strong>${U.esc(nome)}</strong>.
    <button class="btn btn-secundario btn-sm" type="button" onclick="limparInspecaoFixa()">Ver todas as peças</button></div>`;
}

function limparInspecaoFixa() {
  PECAS_INSPECAO_FIXA = '';
  history.replaceState(null, '', location.pathname);
  render();
}

function renderKpis(lista) {
  const alvo = document.getElementById('kpis');
  if (!alvo) return;
  const comDefeito = lista.filter(p => p.tem_defeito === true).length;
  const familias = new Set(lista.map(p => p.familia).filter(Boolean)).size;
  const pedidos = new Set(lista.map(p => p.numero_pedido || inspecaoDe(p)?.numero_pedido).filter(Boolean)).size;

  alvo.innerHTML = `
    <div class="kpi escuro"><div class="rotulo">Peças no filtro</div><div class="valor">${lista.length}</div><div class="extra">de ${PECAS_REGISTROS.length} no histórico</div></div>
    <div class="kpi"><div class="rotulo">Famílias</div><div class="valor">${familias}</div><div class="extra">tipos distintos</div></div>
    <div class="kpi"><div class="rotulo">Pedidos</div><div class="valor">${pedidos}</div><div class="extra">ordens envolvidas</div></div>
    <div class="kpi amarelo"><div class="rotulo">Com defeito</div><div class="valor">${comDefeito}</div><div class="extra">peças com defeito descrito</div></div>`;
}

function renderTabela(lista, total) {
  const contador = document.getElementById('contador');
  if (contador) contador.textContent = PECAS_CARREGANDO ? 'Carregando do Supabase...' : `${lista.length} de ${total} peça(s)`;

  const alvo = document.getElementById('lista');
  if (!alvo) return;

  if (PECAS_CARREGANDO) {
    alvo.innerHTML = `<div class="vazio">${ICN.vazioBox}<h3>Carregando peças de AMV</h3><p>Buscando registros no Supabase...</p></div>`;
    return;
  }
  if (PECAS_TABELA_FALTANDO) {
    alvo.innerHTML = `<div class="vazio">${ICN.alerta}<h3>Tabelas da área de AMV ainda não criadas</h3>
      <p>Rode no SQL Editor do Supabase, nesta ordem, <strong>supabase/2026-09-08-area-amv.sql</strong> e <strong>supabase/2026-09-08-area-amv-carga-historico.sql</strong>.</p>
      <button class="btn btn-secundario" type="button" onclick="carregar()">Tentar novamente</button></div>`;
    return;
  }
  if (PECAS_ERRO) {
    alvo.innerHTML = `<div class="vazio">${ICN.alerta}<h3>Erro ao carregar</h3><p>${U.esc(PECAS_ERRO)}</p>
      <button class="btn btn-secundario" type="button" onclick="carregar()">Tentar novamente</button></div>`;
    return;
  }
  if (!lista.length) {
    alvo.innerHTML = `<div class="vazio">${ICN.vazioBox}<h3>Nenhuma peça encontrada</h3>
      <p>${total ? 'Ajuste os filtros para ver as peças já registradas.' : 'Cadastre a primeira peça ou rode a carga do histórico no Supabase.'}</p></div>`;
    return;
  }

  const podeEditar = window.Auth?.pode?.('editar');
  const podeExcluir = window.Auth?.pode?.('excluir');

  alvo.innerHTML = `<div class="tabela-wrap"><table class="tabela">
    <thead><tr>
      <th>Data</th><th>Fornecedor</th><th>#</th><th>Tipo de peça</th><th>Classificação</th>
      <th>Pedido</th><th>Defeito</th><th>Ações</th>
    </tr></thead>
    <tbody>${lista.map(p => {
      const insp = inspecaoDe(p);
      const classificacao = [p.familia, p.montagem, p.inclinacao, p.trilho, p.mao, p.geometria, p.derivacao].filter(Boolean).join(' · ');
      const defeitos = Amv.defeitos(p);
      return `<tr>
        <td>${U.dataBR(insp?.data_inspecao)}</td>
        <td>${U.esc(Amv.fornecedor(insp))}</td>
        <td>${Amv.inteiro(p.indice)}</td>
        <td><strong>${U.esc(p.tipo_peca || '—')}</strong>${p.tipo_peca_notas ? `<br><span class="txt-mini txt-cinza">${Amv.texto(p.tipo_peca_notas, '')}</span>` : ''}</td>
        <td><span class="txt-mini">${U.esc(classificacao || '—')}</span></td>
        <td>${U.esc(p.numero_pedido || insp?.numero_pedido || '—')}</td>
        <td>${Amv.badgeDefeito(p.tem_defeito)}${defeitos.length ? `<div class="txt-mini">${defeitos.map(d => Amv.texto(d.descricao)).join('<br>')}</div>` : ''}</td>
        <td class="acoes-cel">
          ${podeEditar ? `<button class="icone-btn" title="Editar" onclick="editar('${p.id}')">${ICN.edit}</button>` : ''}
          ${podeExcluir ? `<button class="icone-btn del" title="Excluir" onclick="excluir('${p.id}')">${ICN.del}</button>` : ''}
        </td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

/* ---------- cadastro ---------- */
function abrirNovo() {
  limparFormulario();
  document.getElementById('modalTitulo').textContent = 'Nova peça';
  if (PECAS_INSPECAO_FIXA) setValor('inspecaoId', PECAS_INSPECAO_FIXA);
  setValor('indice', proximoIndice(PECAS_INSPECAO_FIXA));
  document.getElementById('modal').classList.add('aberto');
}

function editar(id) {
  const p = PECAS_REGISTROS.find(x => x.id === id);
  if (!p) return;
  limparFormulario();

  document.getElementById('modalTitulo').textContent = 'Editar peça';
  setValor('id', p.id);
  setValor('inspecaoId', p.inspecao_id || '');
  setValor('indice', Amv.inteiro(p.indice) || 1);
  setValor('numeroPedido', p.numero_pedido || '');
  setValor('tipoPeca', p.tipo_peca || '');
  setValor('tipoPecaNotas', p.tipo_peca_notas || '');
  setValor('temDefeito', p.tem_defeito === true ? 'true' : p.tem_defeito === false ? 'false' : '');
  setValor('descricaoDefeito', Amv.defeitos(p).map(d => d.descricao).join('\n'));

  document.getElementById('modal').classList.add('aberto');
}

/** Próximo número livre dentro da inspeção, para não colidir na chave. */
function proximoIndice(inspecaoId) {
  if (!inspecaoId) return 1;
  const usados = PECAS_REGISTROS.filter(p => p.inspecao_id === inspecaoId).map(p => Amv.inteiro(p.indice));
  return usados.length ? Math.max(...usados) + 1 : 1;
}

function limparFormulario() {
  ['id', 'numeroPedido', 'tipoPeca', 'tipoPecaNotas', 'descricaoDefeito'].forEach(id => setValor(id, ''));
  setValor('inspecaoId', '');
  setValor('temDefeito', '');
  setValor('indice', 1);
}

async function salvar() {
  const id = document.getElementById('id')?.value || '';
  const inspecaoId = document.getElementById('inspecaoId')?.value || '';
  const tipoPeca = document.getElementById('tipoPeca')?.value.trim() || '';
  const temDefeitoBruto = document.getElementById('temDefeito')?.value || '';
  const descricao = document.getElementById('descricaoDefeito')?.value.trim() || '';

  if (!inspecaoId) { App.toast('Escolha a inspeção da peça.', 'aviso'); return; }
  if (!tipoPeca) { App.toast('Informe o tipo de peça.', 'aviso'); return; }

  const registro = {
    id: id || undefined,
    inspecao_id: inspecaoId,
    indice: Amv.inteiro(document.getElementById('indice')?.value) || 1,
    tipo_peca: tipoPeca,
    tipo_peca_notas: document.getElementById('tipoPecaNotas')?.value.trim() || null,
    numero_pedido: document.getElementById('numeroPedido')?.value.trim() || null,
    tem_defeito: temDefeitoBruto === 'true' ? true : temDefeitoBruto === 'false' ? false : null,
    // A classificação é refeita pelo gatilho do banco sempre que o texto muda.
    familia: null, trilho: null, inclinacao: null, mao: null, geometria: null, montagem: null, derivacao: null,
  };

  try {
    const salva = await StoreAmv.salvarPeca(registro);
    await sincronizarDefeito(salva, descricao);
    fecharModal();
    App.toast(id ? 'Peça atualizada.' : 'Peça cadastrada.');
    await carregar();
  } catch (err) {
    console.error('Erro ao salvar peça de AMV:', err);
    App.toast(StoreAmv.mensagemErro(err, 'Não foi possível salvar a peça.'), 'erro');
  }
}

/* O formulário trata o defeito como um texto só. Aqui ele vira (ou deixa
   de ser) a primeira linha de amv_defeitos daquela peça. */
async function sincronizarDefeito(peca, descricao) {
  const existentes = await StoreAmv.listarDefeitos({ pecaId: peca.id });
  const primeiro = existentes.find(d => Amv.inteiro(d.indice) === 1) || existentes[0];

  if (!descricao) {
    if (primeiro) await StoreAmv.removerDefeito(primeiro.id);
    return;
  }
  await StoreAmv.salvarDefeito({
    id: primeiro?.id,
    peca_id: peca.id,
    inspecao_id: peca.inspecao_id,
    indice: primeiro ? Amv.inteiro(primeiro.indice) || 1 : 1,
    descricao,
  });
}

async function excluir(id) {
  const p = PECAS_REGISTROS.find(x => x.id === id);
  if (!p) return;
  if (!App.confirmar(`Excluir a peça "${p.tipo_peca || 'sem tipo'}"? O defeito registrado nela também será excluído.`)) return;

  try {
    await StoreAmv.removerPeca(id);
    App.toast('Peça excluída.', 'aviso');
    await carregar();
  } catch (err) {
    console.error('Erro ao excluir peça de AMV:', err);
    App.toast(StoreAmv.mensagemErro(err, 'Não foi possível excluir a peça.'), 'erro');
  }
}

function setValor(id, valor) {
  const el = document.getElementById(id);
  if (el) el.value = valor == null ? '' : valor;
}

function fecharModal() { document.getElementById('modal').classList.remove('aberto'); }

document.addEventListener('keydown', ev => { if (ev.key === 'Escape') fecharModal(); });

window.carregar = carregar;
window.abrirNovo = abrirNovo;
window.editar = editar;
window.excluir = excluir;
window.salvar = salvar;
window.fecharModal = fecharModal;
window.limparInspecaoFixa = limparInspecaoFixa;
