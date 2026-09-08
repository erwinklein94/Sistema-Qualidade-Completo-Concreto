/* =====================================================================
   AMV-INSPECOES.JS — Histórico de relatórios de inspeção de peças de AMV

   Esta tela cuida do cabeçalho do relatório. As peças de cada inspeção
   aparecem aqui só para leitura, no detalhe; quem inclui, edita e exclui
   peça é a tela Peças de AMV (amv-pecas.html).
   ===================================================================== */
'use strict';

let INSP_REGISTROS = [];
let INSP_CARREGANDO = false;
let INSP_ERRO = '';
let INSP_TABELA_FALTANDO = false;

document.addEventListener('DOMContentLoaded', async () => {
  if (!await Auth.exigirLogin()) return;

  App.montarLayout('amv-inspecoes', 'Inspeções de AMV', 'Relatórios de inspeção de peças de aparelho de mudança de via');
  configurarAcoesTopo();

  Amv.preencherSelect('fornecedor', Amv.FORNECEDORES, 'Selecione');
  Amv.preencherSelect('tipagemLegivel', Amv.SIM_NAO_NA, 'Não informado');
  montarProjetos();

  ['busca', 'fFornecedor', 'fProjeto', 'fResponsavel', 'fDefeito', 'fDataIni', 'fDataFim'].forEach(id => {
    const el = document.getElementById(id);
    el?.addEventListener(el.tagName === 'INPUT' && el.type === 'text' ? 'input' : 'change', render);
  });

  await carregar();
});

function configurarAcoesTopo() {
  const podeCriar = window.Auth?.pode?.('criar');
  App.acoesTopo(`${podeCriar
    ? `<button class="btn btn-primario btn-sm" type="button" onclick="abrirNovo()">${ICN.add}<span>Nova inspeção</span></button>`
    : App.avisoModoConsulta()}
    <button class="btn btn-secundario btn-sm" type="button" onclick="carregar()">${ICN.check}<span>Atualizar</span></button>`);
}

function montarProjetos() {
  const alvo = document.getElementById('projetos');
  if (!alvo) return;
  alvo.innerHTML = Amv.PROJETOS.map(p =>
    `<label class="opcao-check"><input type="checkbox" name="projeto" value="${U.esc(p)}"> <span>${U.esc(p)}</span></label>`).join('');
}

async function carregar() {
  INSP_CARREGANDO = true;
  INSP_ERRO = '';
  INSP_TABELA_FALTANDO = false;
  render();

  try {
    INSP_REGISTROS = await StoreAmv.listarInspecoes({ limite: 10000 });
    Amv.preencherSelect('fFornecedor', Amv.valoresDe(INSP_REGISTROS, i => Amv.fornecedor(i)), 'Todos os fornecedores');
    Amv.preencherSelect('fProjeto', Amv.valoresDe(INSP_REGISTROS, i => Amv.projetos(i)), 'Todos os projetos');
    Amv.preencherSelect('fResponsavel', Amv.valoresDe(INSP_REGISTROS, i => i.responsavel), 'Todos os responsáveis');
  } catch (err) {
    console.error('Erro ao carregar inspeções de AMV:', err);
    INSP_TABELA_FALTANDO = StoreAmv.tabelaFaltando(err);
    INSP_ERRO = StoreAmv.mensagemErro(err, 'Não foi possível carregar as inspeções de AMV.');
  } finally {
    INSP_CARREGANDO = false;
    configurarAcoesTopo();
    render();
  }
}

function filtradas() {
  const busca = U.norm(document.getElementById('busca')?.value || '');
  const fFornecedor = document.getElementById('fFornecedor')?.value || '';
  const fProjeto = document.getElementById('fProjeto')?.value || '';
  const fResponsavel = document.getElementById('fResponsavel')?.value || '';
  const fDefeito = document.getElementById('fDefeito')?.value || '';
  const ini = document.getElementById('fDataIni')?.value || '';
  const fim = document.getElementById('fDataFim')?.value || '';

  return INSP_REGISTROS.filter(i => {
    if (fFornecedor && Amv.fornecedor(i) !== fFornecedor) return false;
    if (fProjeto && !Amv.projetos(i).includes(fProjeto)) return false;
    if (fResponsavel && String(i.responsavel || '') !== fResponsavel) return false;

    const comDefeito = Amv.totalPecasComDefeito(i) > 0;
    if (fDefeito === 'com' && !comDefeito) return false;
    if (fDefeito === 'sem' && comDefeito) return false;

    const d = String(i.data_inspecao || '');
    if (ini && (!d || d < ini)) return false;
    if (fim && (!d || d > fim)) return false;

    if (busca) {
      const texto = U.norm([
        Amv.fornecedor(i), i.responsavel, i.numero_pedido, i.localizacao,
        Amv.projetos(i).join(' '), i.informacoes_adicionais, i.audit_nome,
        Amv.pecas(i).map(p => p.tipo_peca).join(' '),
      ].filter(Boolean).join(' '));
      if (!texto.includes(busca)) return false;
    }
    return true;
  });
}

function render() {
  const lista = filtradas();
  renderKpis(lista);
  renderTabela(lista, INSP_REGISTROS.length);
}

function renderKpis(lista) {
  const alvo = document.getElementById('kpis');
  if (!alvo) return;
  const pecas = lista.flatMap(i => Amv.pecas(i));
  alvo.innerHTML = `
    <div class="kpi escuro"><div class="rotulo">Inspeções no filtro</div><div class="valor">${lista.length}</div><div class="extra">de ${INSP_REGISTROS.length} no histórico</div></div>
    <div class="kpi"><div class="rotulo">Peças detalhadas</div><div class="valor">${pecas.length}</div><div class="extra">itens descritos</div></div>
    <div class="kpi amarelo"><div class="rotulo">Ajustes</div><div class="valor">${Amv.soma(lista, 'qtd_ajustes')}</div><div class="extra">peças ajustadas</div></div>
    <div class="kpi"><div class="rotulo">Com defeito</div><div class="valor">${pecas.filter(p => p.tem_defeito === true).length}</div><div class="extra">peças com defeito</div></div>`;
}

function renderTabela(lista, total) {
  const contador = document.getElementById('contador');
  if (contador) contador.textContent = INSP_CARREGANDO ? 'Carregando do Supabase...' : `${lista.length} de ${total} registro(s)`;

  const alvo = document.getElementById('lista');
  if (!alvo) return;

  if (INSP_CARREGANDO) {
    alvo.innerHTML = `<div class="vazio">${ICN.vazioBox}<h3>Carregando inspeções de AMV</h3><p>Buscando registros no Supabase...</p></div>`;
    return;
  }
  if (INSP_TABELA_FALTANDO) {
    alvo.innerHTML = `<div class="vazio">${ICN.alerta}<h3>Tabelas da área de AMV ainda não criadas</h3>
      <p>Rode no SQL Editor do Supabase, nesta ordem, <strong>supabase/2026-09-08-area-amv.sql</strong> e <strong>supabase/2026-09-08-area-amv-carga-historico.sql</strong>.</p>
      <button class="btn btn-secundario" type="button" onclick="carregar()">Tentar novamente</button></div>`;
    return;
  }
  if (INSP_ERRO) {
    alvo.innerHTML = `<div class="vazio">${ICN.alerta}<h3>Erro ao carregar</h3><p>${U.esc(INSP_ERRO)}</p>
      <button class="btn btn-secundario" type="button" onclick="carregar()">Tentar novamente</button></div>`;
    return;
  }
  if (!lista.length) {
    alvo.innerHTML = `<div class="vazio">${ICN.vazioBox}<h3>Nenhuma inspeção encontrada</h3>
      <p>${total ? 'Ajuste os filtros para ver os relatórios já registrados.' : 'Cadastre a primeira inspeção ou rode a carga do histórico no Supabase.'}</p></div>`;
    return;
  }

  const podeEditar = window.Auth?.pode?.('editar');
  const podeExcluir = window.Auth?.pode?.('excluir');

  alvo.innerHTML = `<div class="tabela-wrap"><table class="tabela">
    <thead><tr>
      <th>Data</th><th>Fornecedor</th><th>Projeto</th><th>Pedido</th>
      <th>Programadas</th><th>Disponíveis</th><th>Ajustes</th><th>Peças</th>
      <th>Responsável</th><th>Origem</th><th>Ações</th>
    </tr></thead>
    <tbody>${lista.map(i => {
      const comDefeito = Amv.totalPecasComDefeito(i);
      return `<tr>
        <td>${U.dataBR(i.data_inspecao)}</td>
        <td><strong>${U.esc(Amv.fornecedor(i))}</strong></td>
        <td>${Amv.badgesProjeto(i)}</td>
        <td>${U.esc(i.numero_pedido || '—')}</td>
        <td>${Amv.inteiro(i.qtd_programadas)}</td>
        <td>${Amv.inteiro(i.qtd_disponiveis)}</td>
        <td>${Amv.inteiro(i.qtd_ajustes)}</td>
        <td>${Amv.pecas(i).length}${comDefeito ? ` <span class="badge badge-reprovado">${comDefeito} com defeito</span>` : ''}</td>
        <td>${U.esc(i.responsavel || '—')}</td>
        <td>${Amv.badgeOrigem(i)}</td>
        <td class="acoes-cel">
          <button class="icone-btn" title="Ver" onclick="ver('${i.id}')">${ICN.olho}</button>
          ${podeEditar ? `<button class="icone-btn" title="Editar" onclick="editar('${i.id}')">${ICN.edit}</button>` : ''}
          ${podeExcluir ? `<button class="icone-btn del" title="Excluir" onclick="excluir('${i.id}')">${ICN.del}</button>` : ''}
        </td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

/* ---------- detalhe ---------- */
function ver(id) {
  const i = INSP_REGISTROS.find(x => x.id === id);
  if (!i) return;

  document.getElementById('verTitulo').textContent = `${Amv.fornecedor(i)} · ${U.dataBR(i.data_inspecao)}`;
  const pecas = Amv.pecas(i);

  const tabelaPecas = pecas.length
    ? `<div class="tabela-wrap"><table class="tabela">
        <thead><tr><th>#</th><th>Tipo de peça</th><th>Classificação</th><th>Pedido</th><th>Defeito</th></tr></thead>
        <tbody>${pecas.map(p => `<tr>
          <td>${Amv.inteiro(p.indice)}</td>
          <td><strong>${U.esc(p.tipo_peca || '—')}</strong>${p.tipo_peca_notas ? `<br><span class="txt-mini txt-cinza">${Amv.texto(p.tipo_peca_notas, '')}</span>` : ''}</td>
          <td>${U.esc([p.familia, p.montagem, p.inclinacao, p.trilho, p.mao, p.geometria, p.derivacao].filter(Boolean).join(' · ') || '—')}</td>
          <td>${U.esc(p.numero_pedido || '—')}</td>
          <td>${Amv.badgeDefeito(p.tem_defeito)}${Amv.defeitos(p).length ? `<div class="txt-mini">${Amv.defeitos(p).map(d => Amv.texto(d.descricao)).join('<br>')}</div>` : ''}</td>
        </tr>`).join('')}</tbody>
      </table></div>`
    : '<p class="txt-cinza">Nenhuma peça detalhada neste relatório.</p>';

  document.getElementById('verCorpo').innerHTML = `
    <div class="detalhe-grid">
      ${item('Data da inspeção', U.dataBR(i.data_inspecao))}
      ${item('Hora de início', dataHora(i.hora_inicio))}
      ${item('Fornecedor', U.esc(Amv.fornecedor(i)))}
      ${item('Projeto', Amv.projetosTexto(i))}
      ${item('Número do pedido', U.esc(i.numero_pedido || '—'))}
      ${item('Responsável', U.esc(i.responsavel || '—'))}
      ${item('Localização', Amv.texto(i.localizacao))}
      ${item('Tipagem legível', U.esc(i.tipagem_legivel || '—'))}
      ${item('Programadas', Amv.inteiro(i.qtd_programadas))}
      ${item('Disponíveis', Amv.inteiro(i.qtd_disponiveis))}
      ${item('Ajustes', Amv.inteiro(i.qtd_ajustes))}
      ${item('Reprovadas', Amv.inteiro(i.qtd_reprovadas))}
      ${item('Informações adicionais', Amv.texto(i.informacoes_adicionais))}
      ${item('Observações internas', Amv.texto(i.observacoes))}
      ${item('Origem', Amv.badgeOrigem(i))}
      ${i.audit_id ? item('Relatório de origem', `${U.esc(i.audit_nome || i.audit_id)}<br><span class="txt-mini txt-cinza">${U.esc(i.audit_id)}</span>`) : ''}
    </div>
    <div class="card-titulo" style="margin-top:14px"><span class="acento">Peças inspecionadas</span></div>
    ${tabelaPecas}
    <p class="txt-mini txt-cinza">Para incluir, editar ou excluir peças deste relatório, use a tela <a href="amv-pecas.html?inspecao=${encodeURIComponent(i.id)}">Peças de AMV</a>.</p>`;

  document.getElementById('modalVer').classList.add('aberto');
}

function item(rotulo, valor) {
  return `<div class="detalhe-item"><div class="rot">${U.esc(rotulo)}</div><div class="val">${valor}</div></div>`;
}

function dataHora(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? U.esc(String(iso)) : d.toLocaleString('pt-BR');
}

function fecharVer() { document.getElementById('modalVer').classList.remove('aberto'); }

/* ---------- cadastro ---------- */
function abrirNovo() {
  limparFormulario();
  document.getElementById('modalTitulo').textContent = 'Nova inspeção de AMV';
  alternarFornecedorOutro();
  document.getElementById('modal').classList.add('aberto');
}

function editar(id) {
  const i = INSP_REGISTROS.find(x => x.id === id);
  if (!i) return;
  limparFormulario();

  document.getElementById('modalTitulo').textContent = 'Editar inspeção de AMV';
  setValor('id', i.id);
  setValor('dataInspecao', String(i.data_inspecao || '').slice(0, 10));
  setValor('horaInicio', paraDatetimeLocal(i.hora_inicio));
  setValor('fornecedor', i.fornecedor || '');
  setValor('fornecedorOutro', i.fornecedor_outro || '');
  setValor('responsavel', i.responsavel || '');
  setValor('numeroPedido', i.numero_pedido || '');
  setValor('localizacao', i.localizacao || '');
  setValor('qtdProgramadas', Amv.inteiro(i.qtd_programadas));
  setValor('qtdDisponiveis', Amv.inteiro(i.qtd_disponiveis));
  setValor('qtdAjustes', Amv.inteiro(i.qtd_ajustes));
  setValor('qtdReprovadas', Amv.inteiro(i.qtd_reprovadas));
  setValor('tipagemLegivel', i.tipagem_legivel || '');
  setValor('informacoesAdicionais', i.informacoes_adicionais || '');
  setValor('observacoes', i.observacoes || '');

  const marcados = Amv.projetos(i);
  document.querySelectorAll('#projetos input[name="projeto"]').forEach(el => { el.checked = marcados.includes(el.value); });

  alternarFornecedorOutro();
  document.getElementById('modal').classList.add('aberto');
}

function limparFormulario() {
  ['id', 'dataInspecao', 'horaInicio', 'fornecedorOutro', 'responsavel', 'numeroPedido',
    'localizacao', 'informacoesAdicionais', 'observacoes'].forEach(id => setValor(id, ''));
  ['qtdProgramadas', 'qtdDisponiveis', 'qtdAjustes', 'qtdReprovadas'].forEach(id => setValor(id, 0));
  setValor('fornecedor', '');
  setValor('tipagemLegivel', '');
  document.querySelectorAll('#projetos input[name="projeto"]').forEach(el => { el.checked = false; });
}

/* O campo livre só faz sentido quando o fornecedor escolhido é "Outro" —
   é assim que o relatório de origem funciona. */
function alternarFornecedorOutro() {
  const ehOutro = (document.getElementById('fornecedor')?.value || '').toLowerCase() === 'outro';
  const campo = document.getElementById('fornecedorOutro');
  if (!campo) return;
  campo.disabled = !ehOutro;
  if (!ehOutro) campo.value = '';
}

function lerFormulario() {
  const projetos = Array.from(document.querySelectorAll('#projetos input[name="projeto"]:checked')).map(el => el.value);
  const horaInicio = document.getElementById('horaInicio')?.value || '';
  return {
    id: document.getElementById('id')?.value || undefined,
    data_inspecao: document.getElementById('dataInspecao')?.value || null,
    hora_inicio: horaInicio ? new Date(horaInicio).toISOString() : null,
    fornecedor: document.getElementById('fornecedor')?.value || '',
    fornecedor_outro: document.getElementById('fornecedorOutro')?.value.trim() || null,
    responsavel: document.getElementById('responsavel')?.value.trim() || null,
    numero_pedido: document.getElementById('numeroPedido')?.value.trim() || null,
    localizacao: document.getElementById('localizacao')?.value.trim() || null,
    projetos,
    qtd_programadas: Amv.inteiro(document.getElementById('qtdProgramadas')?.value),
    qtd_disponiveis: Amv.inteiro(document.getElementById('qtdDisponiveis')?.value),
    qtd_ajustes: Amv.inteiro(document.getElementById('qtdAjustes')?.value),
    qtd_reprovadas: Amv.inteiro(document.getElementById('qtdReprovadas')?.value),
    tipagem_legivel: document.getElementById('tipagemLegivel')?.value || null,
    informacoes_adicionais: document.getElementById('informacoesAdicionais')?.value.trim() || null,
    observacoes: document.getElementById('observacoes')?.value.trim() || null,
  };
}

async function salvar() {
  const registro = lerFormulario();
  if (!registro.data_inspecao) { App.toast('Informe a data da inspeção.', 'aviso'); return; }
  if (!registro.fornecedor) { App.toast('Escolha o fornecedor.', 'aviso'); return; }
  if (registro.fornecedor.toLowerCase() === 'outro' && !registro.fornecedor_outro) {
    App.toast('Informe qual é o fornecedor.', 'aviso');
    return;
  }

  try {
    await StoreAmv.salvarInspecao(registro);
    fecharModal();
    App.toast(registro.id ? 'Inspeção atualizada.' : 'Inspeção cadastrada.');
    await carregar();
  } catch (err) {
    console.error('Erro ao salvar inspeção de AMV:', err);
    App.toast(StoreAmv.mensagemErro(err, 'Não foi possível salvar a inspeção.'), 'erro');
  }
}

async function excluir(id) {
  const i = INSP_REGISTROS.find(x => x.id === id);
  if (!i) return;
  const pecas = Amv.pecas(i).length;
  const aviso = pecas ? ` As ${pecas} peça(s) e os defeitos ligados a ela também serão excluídos.` : '';
  if (!App.confirmar(`Excluir a inspeção de ${Amv.fornecedor(i)} em ${U.dataBR(i.data_inspecao)}?${aviso}`)) return;

  try {
    await StoreAmv.removerInspecao(id);
    App.toast('Inspeção excluída.', 'aviso');
    await carregar();
  } catch (err) {
    console.error('Erro ao excluir inspeção de AMV:', err);
    App.toast(StoreAmv.mensagemErro(err, 'Não foi possível excluir a inspeção.'), 'erro');
  }
}

function paraDatetimeLocal(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function setValor(id, valor) {
  const el = document.getElementById(id);
  if (el) el.value = valor == null ? '' : valor;
}

function fecharModal() { document.getElementById('modal').classList.remove('aberto'); }

document.addEventListener('keydown', ev => {
  if (ev.key === 'Escape') { fecharModal(); fecharVer(); }
});

window.carregar = carregar;
window.abrirNovo = abrirNovo;
window.editar = editar;
window.excluir = excluir;
window.salvar = salvar;
window.ver = ver;
window.fecharModal = fecharModal;
window.fecharVer = fecharVer;
window.alternarFornecedorOutro = alternarFornecedorOutro;
