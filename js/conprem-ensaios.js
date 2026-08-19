/* =====================================================================
   CONPREM-ENSAIOS.JS — Ensaio de Dormentes (FR.10/08) da CONPREM

   As 45 colunas do relatório que a CONPREM envia toda semana: um ensaio
   completo por lote, com dimensional, cargas, USP e resultado geral.
   Alimentada pelo Leitor de Recebidos e editável aqui.

   O formulário, a ficha e a exportação saem todos de CAMPOS, abaixo —
   com 45 campos, repetir a lista em quatro lugares seria erro garantido
   na primeira mudança do relatório.
   ===================================================================== */

let ENSAIOS_REGISTROS = [];
let ENSAIOS_CARREGANDO = true;
let ENSAIOS_ERRO = '';

const RESULTADOS = ['Aprovado', 'Reprovado', 'Pendente'];
const TURNOS = ['DIA', 'NOITE'];

/* [id, rótulo, coluna no Supabase, tipo]
   tipo: texto | numero | data | semana | select:<lista> | textarea
   A ordem é a do relatório da CONPREM, e é a ordem do formulário,
   da ficha e do Excel exportado. */
const CAMPOS = [
  { grupo: 'Identificação', itens: [
    ['semanaRef', 'Semana', 'semana', 'semana'],
    ['ordemFabricacao', 'OF', 'ordem_fabricacao', 'texto'],
    ['pedido', 'Pedido', 'pedido', 'texto'],
    ['cliente', 'Cliente', 'cliente', 'texto'],
    ['lote', 'Lote', 'lote_ensaiado', 'texto'],
    ['dataFabricacao', 'Data fabricação', 'data_fabricacao', 'data'],
    ['turno', 'Turno', 'turno', 'select:turnos'],
    ['dataEnsaio', 'Data ensaio', 'data_ensaio', 'data'],
    ['pista', 'Pista', 'pista', 'numero'],
    ['molde', 'Molde', 'molde', 'numero'],
    ['linha', 'Linha', 'linha', 'numero'],
    ['projeto', 'Projeto', 'projeto', 'select:projetos'],
  ]},
  { grupo: 'Gabaritos e geometria', itens: [
    ['medExtPassa', 'Medida externa — passa', 'med_ext_passa', 'texto'],
    ['medExtNaoPassa', 'Medida externa — não passa', 'med_ext_nao_passa', 'texto'],
    ['medIntPassa', 'Medida interna — passa', 'med_int_passa', 'texto'],
    ['medIntNaoPassa', 'Medida interna — não passa', 'med_int_nao_passa', 'texto'],
    ['inclinacao1', 'Inclinação 1', 'inclinacao_1', 'texto'],
    ['inclinacao2', 'Inclinação 2', 'inclinacao_2', 'texto'],
    ['torcaoRelativa', 'Torção relativa', 'torcao_relativa', 'numero'],
    ['alturaOmbreira1', 'Altura ombreira 1', 'altura_ombreira_1', 'texto'],
    ['alturaOmbreira2', 'Altura ombreira 2', 'altura_ombreira_2', 'texto'],
    ['posicaoInsertos', 'Posição insertos', 'posicao_insertos', 'texto'],
    ['montagemFixacoes', 'Montagem fixações', 'montagem_fixacoes', 'texto'],
  ]},
  { grupo: 'Dimensional (mm)', itens: [
    ['comprimento', 'Comprimento mm', 'comprimento_mm', 'numero'],
    ['larguraApoioSup', 'Largura apoio sup. mm', 'largura_apoio_sup_mm', 'numero'],
    ['larguraApoioInf', 'Largura apoio inf. mm', 'largura_apoio_inf_mm', 'numero'],
    ['alturaApoio', 'Altura apoio mm', 'altura_apoio_mm', 'numero'],
    ['larguraCentroSup', 'Largura centro sup. mm', 'largura_centro_sup_mm', 'numero'],
    ['larguraCentroInf', 'Largura centro inf. mm', 'largura_centro_inf_mm', 'numero'],
    ['alturaCentro', 'Altura centro mm', 'altura_centro_mm', 'numero'],
  ]},
  { grupo: 'Cargas, USP e aderência', itens: [
    ['momentoPosApoio', 'Momento + apoio', 'momento_pos_apoio', 'texto'],
    ['momentoNegApoio', 'Momento − apoio', 'momento_neg_apoio', 'texto'],
    ['momentoPosCentro', 'Momento + centro', 'momento_pos_centro', 'texto'],
    ['momentoNegCentro', 'Momento − centro', 'momento_neg_centro', 'texto'],
    ['arrancamentoOmbreiras', 'Arrancamento ombreiras', 'arrancamento_ombreiras', 'texto'],
    ['precargaUsp', 'Pré-carga USP kgf', 'precarga_usp_kgf', 'numero'],
    ['cargaMaxUsp', 'Carga máx. USP kgf', 'carga_max_usp_kgf', 'numero'],
    ['resultadoUsp', 'Resultado USP', 'resultado_usp', 'texto'],
    ['torcaoOmbreiras', 'Torção ombreiras', 'torcao_ombreiras', 'texto'],
    ['aderenciaCargaFinal', 'Aderência/carga final', 'aderencia_carga_final', 'texto'],
  ]},
  { grupo: 'Conclusão', itens: [
    ['bitola', 'Bitola', 'bitola', 'select:bitolas'],
    ['executor', 'Executor', 'executor', 'texto'],
    ['relatorioFotografico', 'Relatório fotográfico', 'relatorio_fotografico', 'texto'],
    ['fiscalizacao', 'Fiscalização', 'fiscalizacao', 'texto'],
    ['resultado', 'Resultado geral', 'resultado', 'select:resultados'],
    ['observacoes', 'Observações', 'observacoes', 'textarea'],
  ]},
];

const TODOS_CAMPOS = CAMPOS.flatMap(g => g.itens);

const LISTAS = {
  turnos: TURNOS,
  resultados: RESULTADOS,
  get projetos() { return CFG.listas.projetos; },
  get bitolas() { return CFG.listas.bitolas; },
};

document.addEventListener('DOMContentLoaded', async () => {
  if (!await Auth.exigirLogin()) return;
  // A chave vai sem prefixo: montarLayout passa por Area.chaveMenu, que
  // transforma em conprem-ensaios na área da Conprem.
  App.montarLayout('ensaios', 'Ensaios de Dormentes — Conprem',
    'Relatório FR.10/08 da CONPREM: dimensional, cargas, USP e resultado geral por lote');
  App.acoesTopo(`
    <button class="btn btn-secundario" onclick="location.href='conprem-leitor.html'">${ICN.upload}Leitor de Recebidos</button>
    ${Auth.pode('criar') ? `<button class="btn btn-primario" onclick="abrirNovo()">${ICN.add}Novo ensaio</button>` : App.avisoModoConsulta()}
  `);

  montarFormulario();
  preencherSelect('fProjeto', CFG.listas.projetos, 'Todos');
  preencherSelect('fBitola', CFG.listas.bitolas, 'Todas');
  preencherSelect('fResultado', RESULTADOS, 'Todos');

  ['busca', 'fProjeto', 'fBitola', 'fResultado', 'fSemana'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', render);
    el.addEventListener('change', render);
  });

  render();
  await carregar();
});

function preencherSelect(id, arr, placeholder) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = U.opcoes(arr, '', placeholder);
}

/* ---------------------------------------------------------------- dados */

async function carregar() {
  ENSAIOS_CARREGANDO = true;
  ENSAIOS_ERRO = '';
  render();
  try {
    const dados = await StoreSupabase.listarEnsaiosDormentesConprem({ limite: 5000 });
    ENSAIOS_REGISTROS = (dados || []).map(mapDoBanco);
    atualizarFiltroSemana();
    ENSAIOS_CARREGANDO = false;
    render();
  } catch (err) {
    console.error('Erro ao carregar ensaios da Conprem', err);
    ENSAIOS_CARREGANDO = false;
    ENSAIOS_ERRO = mensagemErro(err);
    App.toast(ENSAIOS_ERRO, 'erro');
    render();
  }
}

function mensagemErro(err) {
  const msg = String(err?.message || err || '');
  if (/relation .* does not exist|could not find the table|schema cache/i.test(msg)) {
    return 'Tabela ainda não criada no Supabase. Rode supabase/2026-08-19-conprem-ensaios-dormentes.sql.';
  }
  if (/permission denied/i.test(msg)) return 'Sem permissão de leitura na tabela de ensaios da Conprem.';
  return msg || 'Não foi possível carregar os ensaios da Conprem.';
}

function mapDoBanco(r) {
  const reg = { id: r.id, criadoEm: r.criado_em || '' };
  TODOS_CAMPOS.forEach(([campo, , coluna, tipo]) => {
    if (tipo === 'semana') reg[campo] = rotuloSemana(r.semana, r.ano);
    else if (tipo === 'data') reg[campo] = String(r[coluna] || '').slice(0, 10);
    else reg[campo] = r[coluna] == null ? '' : String(r[coluna]);
  });
  reg.semana = r.semana || '';
  reg.ano = r.ano || '';
  return reg;
}

function mapParaBanco(reg) {
  const payload = {};
  TODOS_CAMPOS.forEach(([campo, , coluna, tipo]) => {
    const bruto = reg[campo];
    if (tipo === 'semana') return; // tratado abaixo, vira semana + ano
    if (tipo === 'numero') payload[coluna] = numeroOuNull(bruto);
    else if (tipo === 'data') payload[coluna] = String(bruto || '').trim() || null;
    else payload[coluna] = String(bruto == null ? '' : bruto).trim() || null;
  });
  const { semana, ano } = partesSemana(reg.semanaRef);
  payload.semana = semana;
  payload.ano = ano;
  payload.fornecedor = Area.fornecedor();
  payload.resultado = RESULTADOS.includes(reg.resultado) ? reg.resultado : 'Pendente';
  if (reg.id) payload.id = reg.id;
  return payload;
}

/* A semana aparece como "2026-S33" no relatório e na tela; no banco fica
   separada em semana e ano, como nas demais tabelas do sistema. */
function rotuloSemana(semana, ano) {
  if (!semana || !ano) return '';
  return `${ano}-S${String(semana).padStart(2, '0')}`;
}

function partesSemana(valor) {
  const m = String(valor || '').match(/(\d{4})\D+(\d{1,2})/);
  return m ? { ano: Number(m[1]), semana: Number(m[2]) } : { ano: null, semana: null };
}

function numeroOuNull(v) {
  const s = String(v == null ? '' : v).trim().replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/* --------------------------------------------------------------- filtros */

function filtros() {
  return {
    busca: (document.getElementById('busca')?.value || '').toLowerCase().trim(),
    projeto: document.getElementById('fProjeto')?.value || '',
    bitola: document.getElementById('fBitola')?.value || '',
    resultado: document.getElementById('fResultado')?.value || '',
    semana: document.getElementById('fSemana')?.value || '',
  };
}

function atualizarFiltroSemana() {
  const el = document.getElementById('fSemana');
  if (!el) return;
  const atual = el.value;
  const semanas = [...new Set(ENSAIOS_REGISTROS.map(r => r.semanaRef).filter(Boolean))]
    .sort((a, b) => b.localeCompare(a));
  el.innerHTML = U.opcoes(semanas, atual, 'Todas as semanas');
  el.value = atual;
}

function listaFiltrada() {
  const f = filtros();
  return ENSAIOS_REGISTROS.filter(r => {
    if (f.projeto && r.projeto !== f.projeto) return false;
    if (f.bitola && r.bitola !== f.bitola) return false;
    if (f.resultado && r.resultado !== f.resultado) return false;
    if (f.semana && r.semanaRef !== f.semana) return false;
    if (f.busca) {
      const blob = TODOS_CAMPOS.map(([campo]) => r[campo]).join(' ').toLowerCase();
      if (!blob.includes(f.busca)) return false;
    }
    return true;
  }).sort((a, b) =>
    String(b.dataEnsaio).localeCompare(String(a.dataEnsaio)) ||
    String(a.lote).localeCompare(String(b.lote), 'pt-BR', { numeric: true })
  );
}

/* ----------------------------------------------------------------- render */

function render() {
  const lista = listaFiltrada();
  renderKpis(lista);
  registrarExportacao(lista);
  renderTabela(lista);
}

function renderKpis(lista) {
  const alvo = document.getElementById('kpis');
  if (!alvo) return;
  const aprovados = lista.filter(r => r.resultado === 'Aprovado').length;
  const reprovados = lista.filter(r => r.resultado === 'Reprovado').length;
  const pendentes = lista.filter(r => r.resultado === 'Pendente').length;
  const lotes = new Set(lista.map(r => r.lote).filter(Boolean)).size;
  const pct = lista.length ? Math.round((aprovados / lista.length) * 100) : 0;
  alvo.innerHTML = `
    <div class="kpi escuro"><div class="rotulo">Ensaios no filtro</div><div class="valor">${lista.length}</div><div class="extra">${lotes} lote(s) distinto(s)</div></div>
    <div class="kpi verde"><div class="rotulo">Aprovados</div><div class="valor">${aprovados}</div><div class="extra">${pct}% do recorte</div></div>
    <div class="kpi vermelho"><div class="rotulo">Reprovados</div><div class="valor">${reprovados}</div><div class="extra">resultado geral do relatório</div></div>
    <div class="kpi amarelo"><div class="rotulo">Pendentes</div><div class="valor">${pendentes}</div><div class="extra">aguardando conclusão</div></div>`;
}

function renderTabela(lista) {
  const contador = document.getElementById('contador');
  if (contador) contador.textContent = ENSAIOS_CARREGANDO
    ? 'Carregando do Supabase...'
    : `${lista.length} de ${ENSAIOS_REGISTROS.length} ensaio(s)`;

  const alvo = document.getElementById('lista');
  if (!alvo) return;

  if (ENSAIOS_CARREGANDO) {
    alvo.innerHTML = `<div class="vazio">${ICN.vazioBox}<h3>Carregando ensaios</h3><p>Buscando o relatório de ensaios da Conprem no Supabase...</p></div>`;
    return;
  }
  if (ENSAIOS_ERRO) {
    alvo.innerHTML = `<div class="vazio">${ICN.alerta}<h3>Ensaios indisponíveis</h3><p>${U.esc(ENSAIOS_ERRO)}</p><button class="btn btn-secundario" onclick="carregar()">Tentar novamente</button></div>`;
    return;
  }
  if (!lista.length) {
    alvo.innerHTML = `<div class="vazio">${ICN.vazioBox}<h3>Nenhum ensaio encontrado</h3><p>${ENSAIOS_REGISTROS.length
      ? 'Ajuste os filtros para ver outros ensaios.'
      : 'Importe o PDF de Ensaio de Dormentes no Leitor de Recebidos, ou lance um ensaio manualmente.'}</p></div>`;
    return;
  }

  const linhas = lista.map(r => `<tr>
    <td>${U.dataBR(r.dataEnsaio)}</td>
    <td><strong>${U.esc(r.semanaRef || '—')}</strong></td>
    <td><strong>${U.esc(r.lote)}</strong></td>
    <td>${U.badgeProjeto(r.projeto)}</td>
    <td>${U.esc(r.bitola || '—')}</td>
    <td>${U.dataBR(r.dataFabricacao)}</td>
    <td>${U.esc(r.turno || '—')}</td>
    <td class="right">${U.esc(r.molde || '—')}</td>
    <td class="right">${U.esc(r.comprimento || '—')}</td>
    <td>${badgeResultado(r.resultado)}</td>
    <td>${U.esc(r.executor || '—')}</td>
    <td class="acoes-cel">
      <button class="icone-btn" title="Ver" onclick="ver('${r.id}')">${ICN.olho}</button>
      ${Auth.pode('editar') ? `<button class="icone-btn" title="Editar" onclick="editar('${r.id}')">${ICN.edit}</button>` : ''}
      ${Auth.pode('excluir') ? `<button class="icone-btn" title="Excluir" onclick="excluir('${r.id}')">${ICN.del}</button>` : ''}
    </td>
  </tr>`).join('');

  alvo.innerHTML = `<div class="tabela-wrap"><table class="tabela">
    <thead><tr>
      <th>Data ensaio</th><th>Semana</th><th>Lote</th><th>Projeto</th><th>Bitola</th>
      <th>Fabricação</th><th>Turno</th><th class="right">Molde</th><th class="right">Compr. mm</th>
      <th>Resultado</th><th>Executor</th><th></th>
    </tr></thead>
    <tbody>${linhas}</tbody>
  </table></div>`;
}

function badgeResultado(v) {
  const cls = v === 'Aprovado' ? 'badge-ok' : v === 'Reprovado' ? 'badge-reprovado' : 'badge-amarelo';
  return `<span class="badge ${cls}">${U.esc(v || 'Pendente')}</span>`;
}

function registrarExportacao(lista) {
  if (!window.Exportacoes) return;
  Exportacoes.registrar({
    titulo: 'Ensaios de Dormentes — Conprem',
    nomeArquivo: 'conprem-ensaios-dormentes',
    filtros: Exportacoes.filtrosDaTela ? Exportacoes.filtrosDaTela() : undefined,
    secoes: [{
      titulo: 'Ensaios filtrados',
      columns: TODOS_CAMPOS.map(([campo, rotulo]) => ({ key: campo, label: rotulo })),
      rows: lista,
    }],
  });
}

/* -------------------------------------------------------------- formulário */

function montarFormulario() {
  const alvo = document.getElementById('formCampos');
  if (!alvo) return;
  alvo.innerHTML = CAMPOS.map(g => `
    <div class="form-secao">${U.esc(g.grupo)}</div>
    ${g.itens.map(([campo, rotulo, , tipo]) => campoHtml(campo, rotulo, tipo)).join('')}
  `).join('');
  CAMPOS.flatMap(g => g.itens)
    .filter(([, , , tipo]) => tipo.startsWith('select:'))
    .forEach(([campo, , , tipo]) => {
      const lista = LISTAS[tipo.slice('select:'.length)] || [];
      preencherSelect(campo, lista, 'Selecione...');
    });
}

function campoHtml(campo, rotulo, tipo) {
  const id = U.esc(campo);
  if (tipo === 'textarea') return `<div class="campo full"><label>${U.esc(rotulo)}</label><textarea id="${id}"></textarea></div>`;
  if (tipo.startsWith('select:')) return `<div class="campo"><label>${U.esc(rotulo)}</label><select id="${id}"></select></div>`;
  if (tipo === 'data') return `<div class="campo"><label>${U.esc(rotulo)}</label><input id="${id}" type="date"></div>`;
  if (tipo === 'numero') return `<div class="campo"><label>${U.esc(rotulo)}</label><input id="${id}" type="number" step="any"></div>`;
  if (tipo === 'semana') return `<div class="campo"><label>${U.esc(rotulo)} <span class="dica">(2026-S33)</span></label><input id="${id}" type="text" placeholder="2026-S33"></div>`;
  return `<div class="campo"><label>${U.esc(rotulo)}</label><input id="${id}" type="text"></div>`;
}

function registroDoFormulario() {
  const reg = { id: document.getElementById('id')?.value || undefined };
  TODOS_CAMPOS.forEach(([campo]) => {
    const el = document.getElementById(campo);
    if (el) reg[campo] = el.value;
  });
  return reg;
}

function abrirNovo() {
  if (!Auth.pode('criar')) { App.toast(Auth.mensagemSemPermissao('criar registros'), 'aviso'); return; }
  document.getElementById('id').value = '';
  TODOS_CAMPOS.forEach(([campo]) => { const el = document.getElementById(campo); if (el) el.value = ''; });
  const hoje = U.isoLocal(new Date());
  document.getElementById('dataEnsaio').value = hoje;
  document.getElementById('resultado').value = 'Pendente';
  document.getElementById('modalTitulo').textContent = 'Novo ensaio de dormente';
  document.getElementById('modal').classList.add('aberto');
}

function obterRegistro(id) {
  return ENSAIOS_REGISTROS.find(r => String(r.id) === String(id)) || null;
}

function editar(id) {
  if (!Auth.pode('editar')) { App.toast(Auth.mensagemSemPermissao('editar registros'), 'aviso'); return; }
  const r = obterRegistro(id);
  if (!r) return;
  document.getElementById('id').value = r.id;
  TODOS_CAMPOS.forEach(([campo]) => { const el = document.getElementById(campo); if (el) el.value = r[campo] || ''; });
  document.getElementById('modalTitulo').textContent = `Editar ensaio do lote ${r.lote}`;
  document.getElementById('modal').classList.add('aberto');
}

async function salvar() {
  const editando = !!document.getElementById('id')?.value;
  if (!Auth.pode(editando ? 'editar' : 'criar')) {
    App.toast(Auth.mensagemSemPermissao(editando ? 'editar registros' : 'criar registros'), 'aviso');
    return;
  }
  const reg = registroDoFormulario();
  if (!String(reg.lote || '').trim()) { App.toast('Informe o lote ensaiado.', 'aviso'); return; }
  if (!String(reg.dataEnsaio || '').trim()) { App.toast('Informe a data do ensaio.', 'aviso'); return; }

  const btn = document.querySelector('#modal .form-acoes .btn-primario');
  const texto = btn?.innerHTML;
  if (btn) { btn.disabled = true; btn.innerHTML = 'Salvando...'; }
  try {
    const salvo = await StoreSupabase.salvarEnsaioDormenteConprem(mapParaBanco(reg));
    const convertido = mapDoBanco(salvo);
    const idx = ENSAIOS_REGISTROS.findIndex(x => x.id === convertido.id);
    if (idx >= 0) ENSAIOS_REGISTROS[idx] = convertido;
    else ENSAIOS_REGISTROS.unshift(convertido);
    atualizarFiltroSemana();
    App.toast('Ensaio salvo no Supabase.');
    fecharModal();
    render();
  } catch (err) {
    console.error('Erro ao salvar ensaio da Conprem', err);
    App.toast(mensagemErro(err), 'erro');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = texto || 'Salvar ensaio'; }
  }
}

async function excluir(id) {
  if (!Auth.pode('excluir')) { App.toast(Auth.mensagemSemPermissao('excluir registros'), 'aviso'); return; }
  const r = obterRegistro(id);
  if (!r) return;
  if (!confirm(`Excluir o ensaio do lote ${r.lote} de ${U.dataBR(r.dataEnsaio)}?`)) return;
  try {
    await StoreSupabase.removerEnsaioDormenteConprem(id);
    ENSAIOS_REGISTROS = ENSAIOS_REGISTROS.filter(x => String(x.id) !== String(id));
    atualizarFiltroSemana();
    App.toast('Ensaio excluído.');
    render();
  } catch (err) {
    console.error('Erro ao excluir ensaio da Conprem', err);
    App.toast(mensagemErro(err), 'erro');
  }
}

/* -------------------------------------------------------------------- ficha */

function ver(id) {
  const r = obterRegistro(id);
  if (!r) return;
  const item = (rot, val) => `<div class="detalhe-item"><div class="rot">${U.esc(rot)}</div><div class="val">${U.esc(val || '—')}</div></div>`;
  const html = CAMPOS.map(g => `
    <div class="detalhe-secao">${U.esc(g.grupo)}</div>
    <div class="detalhe-grid">
      ${g.itens.filter(([, , , tipo]) => tipo !== 'textarea')
        .map(([campo, rotulo, , tipo]) => item(rotulo, tipo === 'data' ? U.dataBR(r[campo]) : r[campo]))
        .join('')}
    </div>
  `).join('') + (r.observacoes
    ? `<div class="detalhe-secao">Observações</div><p style="font-size:13.5px;color:var(--cinza-texto)">${U.esc(r.observacoes)}</p>`
    : '');

  document.getElementById('verTitulo').textContent = `Ensaio do lote ${r.lote} — ${U.dataBR(r.dataEnsaio)}`;
  document.getElementById('verCorpo').innerHTML = html +
    `<div class="form-acoes">
      <button class="btn btn-secundario" onclick="exportarFichaPDF('${r.id}')">Exportar PDF</button>
      <button class="btn btn-secundario" onclick="fecharVer()">Fechar</button>
      ${Auth.pode('editar') ? `<button class="btn btn-primario" onclick="fecharVer(); editar('${r.id}')">Editar</button>` : ''}
    </div>`;
  document.getElementById('modalVer').classList.add('aberto');
}

function exportarFichaPDF(id) {
  const r = obterRegistro(id);
  if (!r || !window.Exportacoes?.exportarFichaPDF) return;
  Exportacoes.exportarFichaPDF({
    titulo: `Ensaio do lote ${r.lote || '—'} — ${U.dataBR(r.dataEnsaio)}`,
    nomeArquivo: `conprem-ensaio-${r.lote || id}`,
    secoes: CAMPOS.map(g => ({
      titulo: g.grupo,
      itens: g.itens.map(([campo, rotulo, , tipo]) => ({
        rot: rotulo,
        val: tipo === 'data' ? U.dataBR(r[campo]) : r[campo],
      })),
    })),
  });
}

function fecharModal() { document.getElementById('modal').classList.remove('aberto'); }
function fecharVer() { document.getElementById('modalVer').classList.remove('aberto'); }
