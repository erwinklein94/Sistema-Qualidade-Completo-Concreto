/* =====================================================================
   ENSAIO-ESTATICO-CONCRETO.JS
   Registro independente baseado no formulário de ensaio estático Cavan.
   A integração com Produção de Dormentes será feita em etapa posterior.
   ===================================================================== */
let ENSAIOS_ESTATICOS = [];
let ENSAIO_CARREGANDO = false;
let ENSAIO_ERRO = '';
let ENSAIO_TABELA_FALTANDO = false;

const IDADES_ENSAIO = [7, 14, 28];
const CAMPOS_TEXTO = [
  'cliente', 'projeto', 'lote', 'pista', 'dataMoldagem', 'horaMoldagem',
  'desprotensaoEm', 'responsavel', 'observacoes',
  ...IDADES_ENSAIO.map(d => `ensaio${d}Em`)
];
const CAMPOS_NUMERICOS = [
  ...[1, 2, 3].flatMap(n => [`abatimento${n}`, `espalhamento${n}`, `desprotensaoResistencia${n}`]),
  ...IDADES_ENSAIO.flatMap(d => [1, 2, 3].flatMap(n => [`compressao${d}Cp${n}`, `tracao${d}Cp${n}`]))
];
const FILTROS_IDS = ['busca', 'fCliente', 'fProjeto', 'fPista', 'fPreenchimento', 'fDataIni', 'fDataFim'];

document.addEventListener('DOMContentLoaded', async () => {
  if (!await Auth.exigirLogin()) return;
  document.body.classList.add('pagina-ensaio-estatico');
  App.montarLayout(
    'ensaioEstaticoConcreto',
    'Ensaio Estático Concreto',
    'Slump, desprotensão, compressão axial e tração na flexão por lote'
  );
  App.acoesTopo(
    Auth.pode('criar')
      ? `<button class="btn btn-primario" onclick="abrirNovo()">${ICN.add}Novo ensaio</button>`
      : App.avisoModoConsulta()
  );

  document.getElementById('idadesEnsaio').innerHTML = IDADES_ENSAIO.map(idadeCardHtml).join('');
  preencherSelect('projeto', CFG.listas.projetos, 'Selecione...');
  preencherSelect('fProjeto', CFG.listas.projetos, 'Todos');
  preencherSelect('fPreenchimento', ['Completo', 'Parcial'], 'Todos');

  FILTROS_IDS.forEach(id => {
    const el = document.getElementById(id);
    el?.addEventListener('input', render);
    el?.addEventListener('change', render);
  });

  render();
  await carregar();
});

function idadeCardHtml(idade) {
  return `<article class="ensaio-idade-card">
    <div class="ensaio-idade-cab">
      <strong>${idade} dias</strong>
      <label>Data do ensaio</label>
      <input id="ensaio${idade}Em" type="date">
    </div>
    <div class="ensaio-idade-medidas">
      <div class="cab">CP</div><div class="cab">Compressão axial</div><div class="cab">Tração flexão</div>
      ${[1, 2, 3].map(n => `<label>${String(n).padStart(2, '0')}</label>
        <input id="compressao${idade}Cp${n}" type="text" inputmode="decimal" placeholder="MPa">
        <input id="tracao${idade}Cp${n}" type="text" inputmode="decimal" placeholder="MPa">`).join('')}
    </div>
  </article>`;
}

function preencherSelect(id, valores, placeholder) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = U.opcoes(valores, '', placeholder);
}

async function carregar() {
  ENSAIO_CARREGANDO = true;
  ENSAIO_ERRO = '';
  ENSAIO_TABELA_FALTANDO = false;
  render();
  try {
    const dados = await StoreSupabase.listarEnsaiosEstaticosConcreto({ limite: 5000 });
    ENSAIOS_ESTATICOS = (dados || []).map(mapDoBanco);
  } catch (err) {
    console.error('Erro ao carregar ensaios estáticos de concreto', err);
    if (tabelaInexistente(err)) ENSAIO_TABELA_FALTANDO = true;
    else {
      ENSAIO_ERRO = mensagemErro(err, 'Não foi possível carregar os ensaios estáticos do Supabase.');
      App.toast(ENSAIO_ERRO, 'erro');
    }
  } finally {
    ENSAIO_CARREGANDO = false;
    atualizarFiltrosDinamicos();
    render();
  }
}

function mapDoBanco(row) {
  const r = {
    id: row.id,
    cliente: row.cliente || '', projeto: row.projeto || '', lote: row.lote || '', pista: row.pista || '',
    dataMoldagem: row.data_moldagem || '', horaMoldagem: horaCurta(row.hora_moldagem),
    desprotensaoEm: paraDatetimeLocal(row.desprotensao_em), responsavel: row.responsavel || '',
    observacoes: row.observacoes || '', criadoEm: row.criado_em || '', atualizadoEm: row.atualizado_em || ''
  };
  [1, 2, 3].forEach(n => {
    r[`abatimento${n}`] = row[`slump_abatimento_${n}`];
    r[`espalhamento${n}`] = row[`slump_espalhamento_${n}`];
    r[`desprotensaoResistencia${n}`] = row[`desprotensao_resistencia_${n}`];
  });
  IDADES_ENSAIO.forEach(d => {
    r[`ensaio${d}Em`] = row[`ensaio_${d}_em`] || '';
    [1, 2, 3].forEach(n => {
      r[`compressao${d}Cp${n}`] = row[`compressao_${d}_cp${n}`];
      r[`tracao${d}Cp${n}`] = row[`tracao_${d}_cp${n}`];
    });
  });
  return r;
}

function mapParaBanco(registro) {
  const p = {
    cliente: vazioParaNull(registro.cliente), projeto: vazioParaNull(registro.projeto),
    lote: vazioParaNull(registro.lote), pista: vazioParaNull(registro.pista),
    data_moldagem: vazioParaNull(registro.dataMoldagem), hora_moldagem: vazioParaNull(registro.horaMoldagem),
    desprotensao_em: registro.desprotensaoEm ? new Date(registro.desprotensaoEm).toISOString() : null,
    responsavel: vazioParaNull(registro.responsavel), observacoes: vazioParaNull(registro.observacoes)
  };
  [1, 2, 3].forEach(n => {
    p[`slump_abatimento_${n}`] = numeroOuNull(registro[`abatimento${n}`]);
    p[`slump_espalhamento_${n}`] = numeroOuNull(registro[`espalhamento${n}`]);
    p[`desprotensao_resistencia_${n}`] = numeroOuNull(registro[`desprotensaoResistencia${n}`]);
  });
  IDADES_ENSAIO.forEach(d => {
    p[`ensaio_${d}_em`] = vazioParaNull(registro[`ensaio${d}Em`]);
    [1, 2, 3].forEach(n => {
      p[`compressao_${d}_cp${n}`] = numeroOuNull(registro[`compressao${d}Cp${n}`]);
      p[`tracao_${d}_cp${n}`] = numeroOuNull(registro[`tracao${d}Cp${n}`]);
    });
  });
  if (registro.id) p.id = registro.id;
  return p;
}

function filtros() {
  return {
    busca: valor('busca').toLowerCase(), cliente: valor('fCliente'), projeto: valor('fProjeto'),
    pista: valor('fPista'), preenchimento: valor('fPreenchimento'), dataIni: valor('fDataIni'), dataFim: valor('fDataFim')
  };
}

function registrosFiltrados() {
  const f = filtros();
  return ENSAIOS_ESTATICOS.filter(r => {
    if (f.cliente && r.cliente !== f.cliente) return false;
    if (f.projeto && r.projeto !== f.projeto) return false;
    if (f.pista && r.pista !== f.pista) return false;
    if (f.dataIni && (r.dataMoldagem || '') < f.dataIni) return false;
    if (f.dataFim && (r.dataMoldagem || '') > f.dataFim) return false;
    if (f.preenchimento === 'Completo' && !registroCompleto(r)) return false;
    if (f.preenchimento === 'Parcial' && registroCompleto(r)) return false;
    if (f.busca) {
      const texto = `${r.cliente} ${r.projeto} ${r.lote} ${r.pista} ${r.responsavel} ${r.observacoes}`.toLowerCase();
      if (!texto.includes(f.busca)) return false;
    }
    return true;
  }).sort(ordenarRecentes);
}

function ordenarRecentes(a, b) {
  return String(b.dataMoldagem || '').localeCompare(String(a.dataMoldagem || ''))
    || String(b.horaMoldagem || '').localeCompare(String(a.horaMoldagem || ''))
    || String(b.criadoEm || '').localeCompare(String(a.criadoEm || ''));
}

function render() {
  const lista = registrosFiltrados();
  renderKpis(lista);
  renderTabela(lista);
}

function renderKpis(lista) {
  const completos = lista.filter(registroCompleto).length;
  const com28 = lista.filter(r => idadePreenchida(r, 28)).length;
  const desproOk = lista.filter(r => [1, 2, 3].some(n => numeroValido(r[`desprotensaoResistencia${n}`]) && Number(r[`desprotensaoResistencia${n}`]) >= 25)).length;
  const alvo = document.getElementById('kpis');
  if (!alvo) return;
  alvo.innerHTML = `
    <div class="kpi escuro"><div class="rotulo">Registros no filtro</div><div class="valor">${lista.length}</div><div class="extra">mais recentes primeiro</div></div>
    <div class="kpi verde"><div class="rotulo">Completos</div><div class="valor">${completos}</div><div class="extra">7, 14 e 28 dias preenchidos</div></div>
    <div class="kpi"><div class="rotulo">Com resultado de 28 dias</div><div class="valor">${com28}</div><div class="extra">ao menos um corpo de prova</div></div>
    <div class="kpi amarelo"><div class="rotulo">Desprotensão ≥ 25 MPa</div><div class="valor">${desproOk}</div><div class="extra">ao menos uma medição conforme</div></div>`;
}

function renderTabela(lista) {
  const contador = document.getElementById('contador');
  if (contador) contador.textContent = ENSAIO_CARREGANDO ? 'Carregando do Supabase...' : `${lista.length} de ${ENSAIOS_ESTATICOS.length} registro(s)`;
  const alvo = document.getElementById('lista');
  if (!alvo) return;

  if (ENSAIO_CARREGANDO) {
    alvo.innerHTML = `<div class="vazio">${ICN.vazioBox}<h3>Carregando ensaios</h3><p>Buscando os registros no Supabase...</p></div>`;
    return;
  }
  if (ENSAIO_TABELA_FALTANDO) {
    alvo.innerHTML = `<div class="vazio">${ICN.alerta}<h3>Tabela ainda não criada</h3><p>Aplique a migração <strong>criar_ensaios_estaticos_concreto</strong> no Supabase e tente novamente.</p><button class="btn btn-secundario" onclick="carregar()">Tentar novamente</button></div>`;
    return;
  }
  if (ENSAIO_ERRO) {
    alvo.innerHTML = `<div class="vazio">${ICN.alerta}<h3>Erro ao carregar</h3><p>${U.esc(ENSAIO_ERRO)}</p><button class="btn btn-secundario" onclick="carregar()">Tentar novamente</button></div>`;
    return;
  }
  if (!lista.length) {
    alvo.innerHTML = `<div class="vazio">${ICN.vazioBox}<h3>Nenhum ensaio encontrado</h3><p>${ENSAIOS_ESTATICOS.length ? 'Ajuste ou limpe os filtros.' : 'Use o botão Novo ensaio para criar o primeiro registro.'}</p></div>`;
    return;
  }

  alvo.innerHTML = `<div class="tabela-wrap"><table class="tabela ensaio-tabela">
    <thead>
      <tr><th rowspan="2">Moldagem</th><th rowspan="2">Lote / pista</th><th rowspan="2">Projeto</th><th colspan="2">Slump Test</th><th colspan="2">Desprotensão</th><th class="grupo-idade" colspan="2">7 dias</th><th class="grupo-idade" colspan="2">14 dias</th><th class="grupo-idade" colspan="2">28 dias</th><th rowspan="2">Preenchimento</th><th rowspan="2">Ações</th></tr>
      <tr><th>Abatimento</th><th>Espalhamento</th><th>Data / hora</th><th>Resistência</th><th>Comp.</th><th>Tração</th><th>Comp.</th><th>Tração</th><th>Comp.</th><th>Tração</th></tr>
    </thead>
    <tbody>${lista.map(linhaTabela).join('')}</tbody>
  </table></div>`;
}

function linhaTabela(r) {
  return `<tr>
    <td><strong>${U.dataBR(r.dataMoldagem)}</strong><small class="txt-mini txt-cinza">${U.esc(r.horaMoldagem || '—')}</small></td>
    <td><strong>${U.esc(r.lote)}</strong><small class="txt-mini txt-cinza">${U.esc(r.pista || '—')} · ${U.esc(r.cliente || '—')}</small></td>
    <td>${U.badgeProjeto(r.projeto)}</td>
    <td class="medidas">${tripla(r, 'abatimento')}</td><td class="medidas">${tripla(r, 'espalhamento')}</td>
    <td>${r.desprotensaoEm ? `${U.dataBR(r.desprotensaoEm.slice(0, 10))}<small class="txt-mini txt-cinza">${U.esc(r.desprotensaoEm.slice(11, 16))}</small>` : '—'}</td>
    <td class="medidas">${tripla(r, 'desprotensaoResistencia')}</td>
    ${IDADES_ENSAIO.map(d => `<td class="medidas">${tripla(r, `compressao${d}Cp`)}</td><td class="medidas">${tripla(r, `tracao${d}Cp`)}</td>`).join('')}
    <td>${badgePreenchimento(r)}</td>
    <td class="acoes-cel">
      <button class="icone-btn" title="Ver" onclick="ver('${r.id}')">${ICN.olho}</button>
      ${Auth.pode('editar') ? `<button class="icone-btn" title="Editar" onclick="editar('${r.id}')">${ICN.edit}</button>` : ''}
      ${Auth.pode('excluir') ? `<button class="icone-btn del" title="Excluir" onclick="excluir('${r.id}')">${ICN.del}</button>` : ''}
    </td>
  </tr>`;
}

function tripla(r, prefixo) {
  const valores = [1, 2, 3].map(n => fmtNumero(r[`${prefixo}${n}`]));
  return valores.every(v => v === '—') ? '—' : valores.join(' / ');
}

function badgePreenchimento(r) {
  const qtd = IDADES_ENSAIO.filter(d => idadePreenchida(r, d)).length;
  const completo = qtd === IDADES_ENSAIO.length;
  return `<span class="ensaio-progresso ${completo ? 'completo' : 'parcial'}">${completo ? '✓ Completo' : `${qtd}/3 idades`}</span>`;
}

function registroCompleto(r) { return IDADES_ENSAIO.every(d => idadePreenchida(r, d)); }
function idadePreenchida(r, d) {
  return [1, 2, 3].some(n => numeroValido(r[`compressao${d}Cp${n}`]) || numeroValido(r[`tracao${d}Cp${n}`]));
}

function atualizarFiltrosDinamicos() {
  preencherFiltroMantendo('fCliente', unicos(ENSAIOS_ESTATICOS.map(r => r.cliente)), 'Todos');
  preencherFiltroMantendo('fPista', unicos(ENSAIOS_ESTATICOS.map(r => r.pista)), 'Todas');
}

function preencherFiltroMantendo(id, valores, placeholder) {
  const el = document.getElementById(id);
  if (!el) return;
  const atual = el.value;
  el.innerHTML = U.opcoes(valores, atual, placeholder);
}

function limparFiltros() {
  FILTROS_IDS.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  render();
}

function abrirNovo() {
  if (!Auth.pode('criar')) { App.toast(Auth.mensagemSemPermissao('criar registros'), 'aviso'); return; }
  document.getElementById('form').reset();
  setValor('id', ''); setValor('cliente', 'RUMO'); setValor('projeto', 'FERRO NORTE'); setValor('dataMoldagem', hojeISO());
  document.getElementById('modalTitulo').textContent = 'Novo ensaio estático concreto';
  document.getElementById('modal').classList.add('aberto');
}

function editar(id) {
  if (!Auth.pode('editar')) { App.toast(Auth.mensagemSemPermissao('editar registros'), 'aviso'); return; }
  const r = ENSAIOS_ESTATICOS.find(x => x.id === id);
  if (!r) return;
  document.getElementById('form').reset();
  setValor('id', r.id);
  [...CAMPOS_TEXTO, ...CAMPOS_NUMERICOS].forEach(c => setValor(c, valorParaInput(r[c])));
  document.getElementById('modalTitulo').textContent = `Editar ensaio — ${r.lote}`;
  document.getElementById('modal').classList.add('aberto');
}

function lerFormulario() {
  const r = { id: valor('id') };
  CAMPOS_TEXTO.forEach(c => { r[c] = valor(c); });
  CAMPOS_NUMERICOS.forEach(c => { r[c] = valor(c); });
  return r;
}

async function salvar() {
  const reg = lerFormulario();
  const acao = reg.id ? 'editar' : 'criar';
  if (!Auth.pode(acao)) { App.toast(Auth.mensagemSemPermissao(`${acao} registros`), 'aviso'); return; }
  if (!reg.cliente || !reg.projeto || !reg.lote || !reg.pista || !reg.dataMoldagem) {
    App.toast('Preencha cliente, projeto, lote, pista e data da moldagem.', 'aviso');
    return;
  }
  const invalido = CAMPOS_NUMERICOS.find(c => reg[c] && numeroOuNull(reg[c]) === null);
  if (invalido) { App.toast('Confira os campos numéricos. Use somente números, vírgula ou ponto decimal.', 'aviso'); return; }

  const btn = document.getElementById('btnSalvar');
  if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }
  try {
    const salvo = await StoreSupabase.salvarEnsaioEstaticoConcreto(mapParaBanco(reg));
    const convertido = mapDoBanco(salvo);
    const idx = ENSAIOS_ESTATICOS.findIndex(x => x.id === convertido.id);
    if (idx >= 0) ENSAIOS_ESTATICOS[idx] = convertido;
    else ENSAIOS_ESTATICOS.unshift(convertido);
    atualizarFiltrosDinamicos();
    fecharModal();
    render();
    App.toast('Ensaio estático salvo.');
  } catch (err) {
    console.error('Erro ao salvar ensaio estático', err);
    App.toast(mensagemErro(err, 'Não foi possível salvar o ensaio estático.'), 'erro');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Salvar ensaio'; }
  }
}

async function excluir(id) {
  if (!Auth.pode('excluir')) { App.toast(Auth.mensagemSemPermissao('excluir registros'), 'aviso'); return; }
  const r = ENSAIOS_ESTATICOS.find(x => x.id === id);
  if (!r || !App.confirmar(`Excluir o ensaio do lote ${r.lote}?`)) return;
  try {
    await StoreSupabase.removerEnsaioEstaticoConcreto(id);
    ENSAIOS_ESTATICOS = ENSAIOS_ESTATICOS.filter(x => x.id !== id);
    atualizarFiltrosDinamicos();
    render();
    App.toast('Ensaio estático excluído.');
  } catch (err) {
    console.error('Erro ao excluir ensaio estático', err);
    App.toast(mensagemErro(err, 'Não foi possível excluir o ensaio.'), 'erro');
  }
}

function ver(id) {
  const r = ENSAIOS_ESTATICOS.find(x => x.id === id);
  if (!r) return;
  document.getElementById('verTitulo').textContent = `Ensaio estático — ${r.lote}`;
  document.getElementById('verCorpo').innerHTML = `<div class="ensaio-detalhe-grid">
    ${secaoDetalhe('Rastreabilidade')}
    ${itemDetalhe('Cliente', r.cliente)}${itemDetalhe('Projeto', r.projeto)}${itemDetalhe('Lote', r.lote)}${itemDetalhe('Pista', r.pista)}
    ${itemDetalhe('Data da moldagem', U.dataBR(r.dataMoldagem))}${itemDetalhe('Horário', r.horaMoldagem)}${itemDetalhe('Responsável', r.responsavel)}${itemDetalhe('Preenchimento', registroCompleto(r) ? 'Completo' : 'Parcial')}
    ${secaoDetalhe('Slump Test')}
    ${itemDetalhe('Abatimento (mm)', tripla(r, 'abatimento'))}${itemDetalhe('Espalhamento (mm)', tripla(r, 'espalhamento'))}
    ${secaoDetalhe('Desprotensão')}
    ${itemDetalhe('Data / hora', fmtDataHora(r.desprotensaoEm))}${itemDetalhe('Resistências (MPa)', tripla(r, 'desprotensaoResistencia'))}
    ${IDADES_ENSAIO.map(d => `${secaoDetalhe(`${d} dias${r[`ensaio${d}Em`] ? ` · ${U.dataBR(r[`ensaio${d}Em`])}` : ''}`)}${itemDetalhe('Compressão axial (MPa)', tripla(r, `compressao${d}Cp`))}${itemDetalhe('Tração na flexão (MPa)', tripla(r, `tracao${d}Cp`))}`).join('')}
    ${secaoDetalhe('Observações')}${itemDetalhe('Registro', r.observacoes, 'full')}
  </div>`;
  document.getElementById('modalVer').classList.add('aberto');
}

function secaoDetalhe(titulo) { return `<h3 class="ensaio-detalhe-secao">${U.esc(titulo)}</h3>`; }
function itemDetalhe(rotulo, conteudo, classe = '') { return `<div class="ensaio-detalhe-item ${classe}"><span>${U.esc(rotulo)}</span><strong>${U.esc(conteudo || '—')}</strong></div>`; }

function fecharModal() { document.getElementById('modal').classList.remove('aberto'); }
function fecharVer() { document.getElementById('modalVer').classList.remove('aberto'); }
function valor(id) { return String(document.getElementById(id)?.value || '').trim(); }
function setValor(id, v) { const el = document.getElementById(id); if (el) el.value = v == null ? '' : v; }
function vazioParaNull(v) { return String(v || '').trim() || null; }
function valorParaInput(v) { return v == null ? '' : String(v).replace('.', ','); }
function numeroValido(v) { return v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)); }
function numeroOuNull(v) {
  const texto = String(v ?? '').trim();
  if (!texto) return null;
  const normalizado = texto.replace(/\s/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.');
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : null;
}
function fmtNumero(v) { return numeroValido(v) ? Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '—'; }
function horaCurta(v) { return String(v || '').slice(0, 5); }
function paraDatetimeLocal(v) {
  if (!v) return '';
  const d = new Date(v);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function fmtDataHora(v) { return v ? `${U.dataBR(v.slice(0, 10))} ${v.slice(11, 16)}` : '—'; }
function hojeISO() { return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
function unicos(valores) { return [...new Set(valores.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')); }
function tabelaInexistente(err) { return ['42P01', 'PGRST205'].includes(err?.code) || /does not exist|not found|schema cache/i.test(err?.message || ''); }
function mensagemErro(err, fallback) {
  if (/permission denied|row-level security|42501/i.test(`${err?.code || ''} ${err?.message || ''}`)) return 'Seu perfil não tem permissão para esta operação.';
  return err?.message || fallback;
}

window.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  fecharModal();
  fecharVer();
});
