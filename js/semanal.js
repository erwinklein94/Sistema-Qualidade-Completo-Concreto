/* =====================================================================
   SEMANAL.JS — Indicador Semanal conectado ao Supabase
   Consolidação automática a partir de Produção, Reprovados e Ensaios.
   Semana operacional: quinta-feira até quarta-feira.
   20260609-custo-nao-qualidade: KPI de Custo da Não Qualidade (refugos
   da semana × custo unitário configurado em Dados do Sistema) e tabelas
   espelho de Dormentes Reprovados e Ensaios de Liberação da semana.
   20260703-acomp-v1: tabela espelho de Ensaios de Acompanhamento
   (14 dias · cura térmica) da semana — apenas documental, não entra na
   consolidação e não libera série.
   ===================================================================== */
const Semanal = {
  prod: [],
  rep: [],
  ens: [],
  acomp: [],
  registros: [],
  custoDormente: 0,
  carregando: true,
  erro: '',
};

document.addEventListener('DOMContentLoaded', async () => {
  document.body.classList.add('pagina-semanal');
  if (!await Auth.exigirLogin()) return;
  App.montarLayout('semanal', 'Indicador Semanal', 'Consolidação automática por semana operacional a partir dos dados lançados no Supabase');
  App.acoesTopo(`<button class="btn btn-secundario" onclick="carregarSemanal()">${ICN.check}Atualizar</button>`);

  preencherSelectBase('fFornecedor', CFG.listas.fornecedores, 'Todos');
  preencherSelectBase('fProjeto', CFG.listas.projetos, 'Todos');
  preencherSelectBase('fBitola', CFG.listas.bitolas, 'Todas');
  atualizarFiltroSemanaSemanal();

  ['fFornecedor', 'fProjeto', 'fBitola'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', render);
    document.getElementById(id)?.addEventListener('change', render);
  });
  document.getElementById('fSemana')?.addEventListener('change', () => {
    U.aplicarSemanaSelecionada('fSemana', 'fPeriodoIni', 'fPeriodoFim');
    render();
  });
  ['fPeriodoIni', 'fPeriodoFim'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
      sincronizarSemanaSemanal();
      render();
    });
  });

  render();
  await carregarSemanal();
});

window.render = render;

function preencherSelectBase(id, arr, placeholder) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = U.opcoes(arr || [], '', placeholder);
}

async function carregarSemanal() {
  Semanal.carregando = true;
  Semanal.erro = '';
  render();

  try {
    await Auth.exigirLogin();
    const [producao, reprovados, ensaios, acompanhamentos, custoDormente] = await Promise.all([
      StoreSupabase.listarProducao({ limite: 10000 }),
      StoreSupabase.listarReprovados({ limite: 10000 }),
      StoreSupabase.listarEnsaiosLiberacao({ limite: 10000 }),
      StoreSupabase.listarEnsaiosAcompanhamento({ limite: 10000 }).catch(err => {
        console.warn('Ensaios de acompanhamento não carregados (rode supabase/2026-07-03-ensaios-acompanhamento.sql se a tabela ainda não existe)', err);
        return [];
      }),
      carregarCustoDormenteSemanal(),
    ]);

    Semanal.prod = (producao || []).map(mapProducao);
    Semanal.rep = (reprovados || []).map(mapReprovado);
    Semanal.ens = (ensaios || []).map(mapEnsaio);
    Semanal.acomp = (acompanhamentos || []).map(mapAcompanhamento);
    Semanal.custoDormente = custoDormente;
    Semanal.registros = consolidarSemanas(Semanal.prod, Semanal.rep, Semanal.ens);
    Semanal.carregando = false;

    atualizarFiltrosComDados();
    const p = periodoUltimaSemanaDisponivel();
    atualizarFiltroSemanaSemanal(U.valorSemana(p));
    if (p) {
      document.getElementById('fPeriodoIni').value = p.ini;
      document.getElementById('fPeriodoFim').value = p.fim;
      sincronizarSemanaSemanal();
    }
    render();
  } catch (err) {
    console.error('Erro ao carregar indicador semanal', err);
    Semanal.carregando = false;
    Semanal.erro = mensagemErroBanco(err, 'Não foi possível carregar o Indicador Semanal do Supabase.');
    App.toast(Semanal.erro, 'erro');
    render();
  }
}

function atualizarFiltrosComDados() {
  preencherSelectComDados('fFornecedor', CFG.listas.fornecedores, Semanal.registros.map(r => r.fornecedor), 'Todos');
  preencherSelectComDados('fProjeto', CFG.listas.projetos, Semanal.registros.map(r => r.projeto), 'Todos');
  preencherSelectComDados('fBitola', CFG.listas.bitolas, Semanal.registros.map(r => r.bitola), 'Todas');
}

function preencherSelectComDados(id, base, valores, placeholder) {
  const el = document.getElementById(id);
  if (!el) return;
  const atual = el.value;
  const vistos = new Set();
  const lista = [];
  [...(base || []), ...(valores || [])].forEach(v => {
    const txt = String(v || '').trim();
    if (!txt) return;
    const k = U.norm(txt);
    if (vistos.has(k)) return;
    vistos.add(k);
    lista.push(txt);
  });
  el.innerHTML = U.opcoes(lista, atual, placeholder);
  if (atual && Array.from(el.options).some(o => o.value === atual)) el.value = atual;
}

function filtros() {
  return {
    fornecedor: document.getElementById('fFornecedor')?.value || '',
    projeto: document.getElementById('fProjeto')?.value || '',
    bitola: document.getElementById('fBitola')?.value || '',
    ini: document.getElementById('fPeriodoIni')?.value || '',
    fim: document.getElementById('fPeriodoFim')?.value || '',
  };
}

function render() {
  const alvoKpis = document.getElementById('kpis');
  const alvoLista = document.getElementById('lista');
  const contador = document.getElementById('contador');
  if (!alvoKpis || !alvoLista) return;

  if (Semanal.carregando) {
    alvoKpis.innerHTML = '';
    if (contador) contador.textContent = 'Carregando do Supabase...';
    alvoLista.innerHTML = `<div class="vazio">${ICN.vazioBox}<h3>Carregando indicador</h3><p>Consolidando Produção, Reprovados e Ensaios de Liberação...</p></div>`;
    definirEspelhoSemanal('listaReprovados', 'contadorReprovados', `<div class="vazio compacto">${ICN.vazioBox}<h3>Carregando reprovas da semana</h3><p>Buscando registros no Supabase...</p></div>`);
    definirEspelhoSemanal('listaEnsaios', 'contadorEnsaios', `<div class="vazio compacto">${ICN.vazioBox}<h3>Carregando ensaios da semana</h3><p>Buscando registros no Supabase...</p></div>`);
    definirEspelhoSemanal('listaAcompanhamentos', 'contadorAcompanhamentos', `<div class="vazio compacto">${ICN.vazioBox}<h3>Carregando acompanhamentos da semana</h3><p>Buscando registros no Supabase...</p></div>`);
    return;
  }

  if (Semanal.erro) {
    alvoKpis.innerHTML = '';
    if (contador) contador.textContent = 'Erro';
    alvoLista.innerHTML = `<div class="vazio">${ICN.alerta}<h3>Erro ao carregar</h3><p>${U.esc(Semanal.erro)}</p><button class="btn btn-secundario" onclick="carregarSemanal()">Tentar novamente</button></div>`;
    definirEspelhoSemanal('listaReprovados', 'contadorReprovados', '');
    definirEspelhoSemanal('listaEnsaios', 'contadorEnsaios', '');
    definirEspelhoSemanal('listaAcompanhamentos', 'contadorAcompanhamentos', '');
    return;
  }

  const f = filtros();
  const todos = Semanal.registros;
  const lista = todos.filter(r => {
    if (f.fornecedor && r.fornecedor !== f.fornecedor) return false;
    if (f.projeto && !mesmoTexto(r.projeto, f.projeto)) return false;
    if (f.bitola && U.bitolaDe(r) !== f.bitola) return false;
    if (!dentroPeriodoIntervalo(r.periodoIni, r.periodoFim, r.data, f.ini, f.fim)) return false;
    return true;
  }).sort((a, b) =>
    compararData(dataFimRegistro(b), dataFimRegistro(a)) ||
    (U.int(b.semana) - U.int(a.semana)) ||
    (a.fornecedor || '').localeCompare(b.fornecedor || '') ||
    (a.projeto || '').localeCompare(b.projeto || '') ||
    U.bitolaDe(a).localeCompare(U.bitolaDe(b))
  );

  const listaReps = filtrarReprovadosSemana(f);
  const listaEns = filtrarEnsaiosSemana(f);
  const listaAcomp = filtrarAcompanhamentosSemana(f);
  registrarExportacaoSemanal(lista, listaReps, listaEns, listaAcomp);
  const ag = lista.reduce((s, r) => {
    s.prod += U.int(r.produzidos);
    s.ref += U.int(r.dormRecusados);
    s.ens += U.int(r.ensaiosReal);
    s.aprov += U.int(r.ensaiosAprov);
    s.rec += U.int(r.ensaiosRec);
    s.pend += U.int(r.ensaiosPend);
    return s;
  }, { prod: 0, ref: 0, ens: 0, aprov: 0, rec: 0, pend: 0 });

  const taxaReprova = ag.prod ? ((ag.ref / ag.prod) * 100).toFixed(1).replace('.', ',') : '0,0';
  const taxaAprov = ag.ens ? Math.round((ag.aprov / ag.ens) * 100) : 0;
  const custo = Semanal.custoDormente;
  const custoNaoQualidade = custo > 0 ? ag.ref * custo : null;

  alvoKpis.innerHTML = `
    <div class="kpi escuro"><div class="rotulo">Produzidos</div><div class="valor">${ag.prod.toLocaleString('pt-BR')}</div><div class="extra">lançados em Produção</div></div>
    <div class="kpi vermelho"><div class="rotulo">Dormentes recusados</div><div class="valor">${ag.ref.toLocaleString('pt-BR')}</div><div class="extra">${taxaReprova}% sobre produção</div></div>
    <div class="kpi vermelho"><div class="rotulo">Custo da não qualidade</div><div class="valor">${custoNaoQualidade == null ? '—' : moedaBRSemanal(custoNaoQualidade)}</div><div class="extra">${custo > 0 ? `${ag.ref.toLocaleString('pt-BR')} refugo(s) × ${moedaBRSemanal(custo)}` : 'configure o custo do dormente em Dados do Sistema'}</div></div>
    <div class="kpi verde"><div class="rotulo">Ensaios aprovados</div><div class="valor">${taxaAprov}%</div><div class="extra">${ag.aprov} de ${ag.ens} ensaio(s)</div></div>
    <div class="kpi amarelo"><div class="rotulo">Ensaios pendentes</div><div class="valor">${ag.pend}</div><div class="extra">aguardando conclusão</div></div>`;

  if (contador) contador.textContent = `${lista.length} de ${todos.length} semana(s) consolidada(s) do Supabase`;

  renderReprovadosSemana(listaReps);
  renderEnsaiosSemana(listaEns);
  renderAcompanhamentosSemana(listaAcomp);

  if (!lista.length) {
    alvoLista.innerHTML = `<div class="vazio">${ICN.vazioBox}<h3>Sem indicador no filtro atual</h3>
      <p>${todos.length ? 'Ajuste os filtros.' : 'Cadastre Produção, Reprovados e Ensaios de Liberação para gerar o indicador automaticamente.'}</p></div>`;
    return;
  }

  alvoLista.innerHTML = `<div class="tabela-wrap"><table class="tabela">
    <thead><tr>
      <th>Sem.</th><th>Fornecedor</th><th>Projeto</th><th>Bitola</th><th>Período</th>
      <th class="right">Produz.</th><th class="right">Refugos</th><th class="right">% Reprova</th>
      <th class="right">Ens. Real.</th><th class="right">Aprov.</th><th class="right">Reprov.</th><th class="right">Pend.</th>
    </tr></thead><tbody>${lista.map(linhaIndicador).join('')}</tbody></table></div>`;
}

function linhaIndicador(r) {
  const pct = U.int(r.produzidos) ? ((U.int(r.dormRecusados) / U.int(r.produzidos)) * 100).toFixed(1).replace('.', ',') : '0,0';
  const classePct = Number(String(pct).replace(',', '.')) <= 2 ? 'badge-ok' : Number(String(pct).replace(',', '.')) <= 5 ? 'badge-amarelo' : 'badge-reprovado';
  return `<tr>
    <td><strong>${U.esc(r.semana)}/${U.esc(r.ano)}</strong></td>
    <td>${U.esc(r.fornecedor)}</td>
    <td>${r.projeto ? U.badgeProjeto(r.projeto) : '<span class="badge badge-entregue">Geral</span>'}</td>
    <td>${r.bitola ? U.badgeBitola(r) : '<span class="badge badge-entregue">Todas</span>'}</td>
    <td>${U.dataBR(r.periodoIni)} – ${U.dataBR(r.periodoFim)}</td>
    <td class="right">${U.int(r.produzidos).toLocaleString('pt-BR')}</td>
    <td class="right">${U.int(r.dormRecusados).toLocaleString('pt-BR')}</td>
    <td class="right"><span class="badge ${classePct}">${pct}%</span></td>
    <td class="right">${U.int(r.ensaiosReal)}</td>
    <td class="right">${U.int(r.ensaiosAprov)}</td>
    <td class="right">${U.int(r.ensaiosRec)}</td>
    <td class="right">${U.int(r.ensaiosPend)}</td>
  </tr>`;
}

/* ---------------------------------------------------------------------
   Espelho da semana — Dormentes Reprovados e Ensaios de Liberação
   --------------------------------------------------------------------- */
function definirEspelhoSemanal(idLista, idContador, html) {
  const alvo = document.getElementById(idLista);
  const contador = document.getElementById(idContador);
  if (alvo) alvo.innerHTML = html;
  if (contador) contador.textContent = '';
}

function filtrarReprovadosSemana(f) {
  return Semanal.rep.filter(r => {
    if (f.fornecedor && r.fornecedor !== f.fornecedor) return false;
    if (f.projeto && !mesmoTexto(r.projeto, f.projeto)) return false;
    if (f.bitola && U.bitolaDe(r) !== f.bitola) return false;
    if (!dentroPeriodoIntervalo(r.periodoIni, r.periodoFim, r.dataProducao, f.ini, f.fim)) return false;
    return true;
  }).sort((a, b) =>
    compararData(b.dataProducao || b.periodoFim, a.dataProducao || a.periodoFim) ||
    String(a.lote || '').localeCompare(String(b.lote || ''), 'pt-BR', { numeric: true })
  );
}

function filtrarEnsaiosSemana(f) {
  return Semanal.ens.filter(r => {
    if (f.fornecedor && r.fornecedor !== f.fornecedor) return false;
    if (f.projeto && !mesmoTexto(r.projeto, f.projeto)) return false;
    if (f.bitola && U.bitolaDe(r) !== f.bitola) return false;
    if (!dentroPeriodoIntervalo('', '', r.dataEnsaio, f.ini, f.fim)) return false;
    return true;
  }).sort((a, b) =>
    compararData(b.dataEnsaio, a.dataEnsaio) ||
    String(a.lote || '').localeCompare(String(b.lote || ''), 'pt-BR', { numeric: true })
  );
}

function renderReprovadosSemana(lista) {
  const alvo = document.getElementById('listaReprovados');
  const contador = document.getElementById('contadorReprovados');
  if (!alvo) return;

  const refugos = lista.reduce((s, r) => s + (U.int(r.totalRefugos) || 1), 0);
  const custo = Semanal.custoDormente;
  if (contador) {
    contador.textContent = `${lista.length} registro(s) · ${refugos.toLocaleString('pt-BR')} refugo(s)` +
      (custo > 0 ? ` · ${moedaBRSemanal(refugos * custo)} de não qualidade` : '');
  }

  if (!lista.length) {
    alvo.innerHTML = `<div class="vazio compacto">${ICN.check}<h3>Sem reprovas no recorte</h3><p>Nenhum dormente reprovado na semana e filtros selecionados.</p></div>`;
    return;
  }

  alvo.innerHTML = `<div class="tabela-wrap"><table class="tabela">
    <thead><tr>
      <th>Sem.</th><th>Período operacional</th><th>Data</th><th>Lote</th><th>Projeto</th><th>Bitola</th><th>Molde</th><th>Cavidade</th>
      <th>Motivo</th><th>Detalhe</th><th class="right">Refugos</th>
    </tr></thead><tbody>${lista.map(linhaReprovadoSemana).join('')}</tbody></table></div>`;
}

function linhaReprovadoSemana(r) {
  const p = periodoReprovaSemanal(r);
  const vinculado = r.producaoLoteId ? '<span class="badge badge-ok">Vinculado</span>' : '<span class="badge badge-amarelo">Manual</span>';
  return `<tr>
    <td><strong>${U.esc(p.semana || '—')}/${U.esc(p.ano || '')}</strong></td>
    <td>${p.ini || p.fim ? `${U.dataBR(p.ini)} – ${U.dataBR(p.fim)}` : '—'}</td>
    <td>${U.dataBR(r.dataProducao)}</td>
    <td><strong>${U.esc(r.lote)}</strong><div class="txt-mini txt-cinza">${vinculado}</div></td>
    <td>${U.badgeProjeto(r.projeto)}</td>
    <td>${U.badgeBitola(r)}</td>
    <td>${U.esc(r.molde || '—')}</td>
    <td>${U.esc(r.cavidade || '—')}</td>
    <td><span class="badge badge-reprovado">${U.esc(r.motivoIndicador || '—')}</span></td>
    <td>${U.esc(r.motivoDetalhado || '—')}</td>
    <td class="right">${(U.int(r.totalRefugos) || 1).toLocaleString('pt-BR')}</td>
  </tr>`;
}

function periodoReprovaSemanal(r) {
  const data = r.dataProducao || r.periodoIni || r.periodoFim;
  const info = U.semanaOperacionalInfo(data);
  return {
    ini: r.periodoIni || info.ini || data || '',
    fim: r.periodoFim || info.fim || data || '',
    semana: r.semana || info.semana || '',
    ano: r.ano || info.ano || '',
  };
}

function renderEnsaiosSemana(lista) {
  const alvo = document.getElementById('listaEnsaios');
  const contador = document.getElementById('contadorEnsaios');
  if (!alvo) return;

  const aprovados = lista.filter(r => r.resultado === 'Aprovado').length;
  const reprovados = lista.filter(r => r.resultado === 'Reprovado').length;
  const pendentes = lista.length - aprovados - reprovados;
  if (contador) {
    contador.textContent = `${lista.length} ensaio(s) · ${aprovados} aprovado(s) · ${reprovados} reprovado(s) · ${pendentes} pendente(s)`;
  }

  if (!lista.length) {
    alvo.innerHTML = `<div class="vazio compacto">${ICN.vazioBox}<h3>Sem ensaios no recorte</h3><p>Nenhum ensaio de liberação registrado na semana e filtros selecionados.</p></div>`;
    return;
  }

  alvo.innerHTML = `<div class="tabela-wrap"><table class="tabela">
    <thead><tr>
      <th>Data</th><th>Semana</th><th>Fornecedor</th><th>Projeto</th><th>Bitola</th><th>Lote ensaiado</th>
      <th>Série liberada</th><th>Resultado</th><th class="right">Qtd.</th><th>Responsável</th><th>Relatório</th>
    </tr></thead><tbody>${lista.map(linhaEnsaioSemana).join('')}</tbody></table></div>`;
}

function linhaEnsaioSemana(r) {
  return `<tr>
    <td>${U.dataBR(r.dataEnsaio)}</td>
    <td><strong>${rotuloSemanaEnsaioSemanal(r)}</strong></td>
    <td>${U.esc(r.fornecedor || '—')}</td>
    <td>${U.badgeProjeto(r.projeto)}</td>
    <td>${U.badgeBitola(r)}</td>
    <td><strong>${U.esc(r.lote || '—')}</strong><div class="txt-mini txt-cinza">${r.producaoLoteId ? 'Vinculado à produção' : 'Manual'}</div></td>
    <td>${U.esc(r.serieLiberada || '—')}</td>
    <td>${badgeResultadoSemanal(r.resultado)}</td>
    <td class="right">${U.esc(r.quantidadeEnsaiada || '—')}</td>
    <td>${U.esc(r.responsavel || '—')}</td>
    <td>${linkRelatorioSemanal(r)}</td>
  </tr>`;
}

function rotuloSemanaEnsaioSemanal(r) {
  if (r.semana && r.ano) return `${U.esc(r.semana)}/${U.esc(r.ano)}`;
  const info = U.semanaOperacionalInfo(r.dataEnsaio);
  return info.semana ? `${info.semana}/${info.ano}` : '—';
}

/* ---------------------------------------------------------------------
   Espelho da semana — Ensaios de Acompanhamento (14 dias · cura térmica)
   Registro documental: não entra na consolidação nem libera série.
   --------------------------------------------------------------------- */
function filtrarAcompanhamentosSemana(f) {
  return Semanal.acomp.filter(r => {
    if (f.fornecedor && r.fornecedor !== f.fornecedor) return false;
    if (f.projeto && !mesmoTexto(r.projeto, f.projeto)) return false;
    if (f.bitola && U.bitolaDe(r) !== f.bitola) return false;
    if (!dentroPeriodoIntervalo('', '', r.dataEnsaio, f.ini, f.fim)) return false;
    return true;
  }).sort((a, b) =>
    compararData(b.dataEnsaio, a.dataEnsaio) ||
    String(a.lote || '').localeCompare(String(b.lote || ''), 'pt-BR', { numeric: true })
  );
}

function renderAcompanhamentosSemana(lista) {
  const alvo = document.getElementById('listaAcompanhamentos');
  const contador = document.getElementById('contadorAcompanhamentos');
  if (!alvo) return;

  const aprovados = lista.filter(r => r.resultado === 'Aprovado').length;
  const reprovados = lista.filter(r => r.resultado === 'Reprovado').length;
  const pendentes = lista.length - aprovados - reprovados;
  if (contador) {
    contador.textContent = `${lista.length} acompanhamento(s) · ${aprovados} aprovado(s) · ${reprovados} reprovado(s) · ${pendentes} pendente(s) · não liberam série`;
  }

  if (!lista.length) {
    alvo.innerHTML = `<div class="vazio compacto">${ICN.vazioBox}<h3>Sem acompanhamentos no recorte</h3><p>Nenhum ensaio de acompanhamento (14 dias, lotes de cura térmica) registrado na semana e filtros selecionados.</p></div>`;
    return;
  }

  alvo.innerHTML = `<div class="tabela-wrap"><table class="tabela">
    <thead><tr>
      <th>Data</th><th>Semana</th><th>Fornecedor</th><th>Projeto</th><th>Bitola</th><th>Lote</th>
      <th>Produção / prazo</th><th>Série</th><th>Resultado</th><th class="right">Qtd.</th><th>Responsável</th><th>Relatório</th>
    </tr></thead><tbody>${lista.map(linhaAcompanhamentoSemana).join('')}</tbody></table></div>`;
}

function linhaAcompanhamentoSemana(r) {
  return `<tr>
    <td>${U.dataBR(r.dataEnsaio)}</td>
    <td><strong>${rotuloSemanaEnsaioSemanal(r)}</strong></td>
    <td>${U.esc(r.fornecedor || '—')}</td>
    <td>${U.badgeProjeto(r.projeto)}</td>
    <td>${U.badgeBitola(r)}</td>
    <td><strong>${U.esc(r.lote || '—')}</strong><div class="txt-mini txt-cinza">${r.producaoLoteId ? 'Vinculado à produção' : 'Manual'}</div></td>
    <td>${celulaPrazoAcompanhamentoSemanal(r)}</td>
    <td>${U.esc(r.serie || '—')}</td>
    <td>${badgeResultadoSemanal(r.resultado)}</td>
    <td class="right">${U.esc(r.quantidadeEnsaiada || '—')}</td>
    <td>${U.esc(r.responsavel || '—')}</td>
    <td>${linkRelatorioSemanal(r)}</td>
  </tr>`;
}

function celulaPrazoAcompanhamentoSemanal(r) {
  if (!r.dataProducao) return '<span class="txt-mini txt-cinza">Sem data de produção</span>';
  const dias = diasEntreDatasSemanal(r.dataProducao, r.dataEnsaio);
  const rotulo = dias == null ? '' : `<div class="txt-mini ${dias === 14 ? 'txt-cinza' : ''}" style="${dias === 14 ? '' : 'color:#b45309'}">${dias} dia(s) após a produção</div>`;
  return `${U.dataBR(r.dataProducao)}${rotulo}`;
}

function diasEntreDatasSemanal(iniIso, fimIso) {
  if (!iniIso || !fimIso) return null;
  const ini = new Date(iniIso + 'T00:00:00');
  const fim = new Date(fimIso + 'T00:00:00');
  if (isNaN(ini) || isNaN(fim)) return null;
  return Math.round((fim - ini) / 86400000);
}

function badgeResultadoSemanal(resultado) {
  const cls = resultado === 'Aprovado' ? 'badge-ok' : resultado === 'Reprovado' ? 'badge-reprovado' : 'badge-amarelo';
  return `<span class="badge ${cls}">${U.esc(resultado || '—')}</span>`;
}

function linkRelatorioSemanal(r) {
  const link = String(r.linkRelatorio || '').trim();
  if (!link) return '—';
  const href = /^https?:\/\//i.test(link) ? link : `https://${link}`;
  return `<a class="link-relatorio" href="${U.esc(href)}" target="_blank" rel="noopener">Abrir relatório</a>`;
}

async function carregarCustoDormenteSemanal() {
  try {
    const cfg = await StoreSupabase.obterConfiguracaoSistema('custo_dormente');
    return numeroCustoSemanal(cfg?.valor);
  } catch (err) {
    console.warn('Custo do dormente não carregado (configure em Dados do Sistema)', err);
    return 0;
  }
}

function numeroCustoSemanal(txt) {
  let s = String(txt ?? '').trim().replace(/[R$\s]/g, '');
  if (!s) return 0;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function moedaBRSemanal(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function consolidarSemanas(prod, rep, ens) {
  const mapa = {};
  const chave = (info, r) => `${info.ano}|${info.semana}|${r.fornecedor || '—'}|${r.projeto || ''}|${U.bitolaDe(r)}`;
  const novo = (info, r, data) => ({
    id: `${info.ano}-${info.semana}-${r.fornecedor || '—'}-${r.projeto || ''}-${U.bitolaDe(r)}`,
    semana: info.semana,
    ano: info.ano,
    fornecedor: r.fornecedor || '—',
    projeto: r.projeto || '',
    bitola: U.bitolaDe(r),
    data,
    periodoIni: info.ini,
    periodoFim: info.fim,
    produzidos: 0,
    dormRecusados: 0,
    ensaiosReal: 0,
    ensaiosAprov: 0,
    ensaiosRec: 0,
    ensaiosPend: 0,
  });

  prod.forEach(r => {
    if (!r.dataFabricacao) return;
    const info = U.semanaOperacionalInfo(r.dataFabricacao);
    const k = chave(info, r);
    if (!mapa[k]) mapa[k] = novo(info, r, r.dataFabricacao);
    mapa[k].produzidos += U.int(r.total);
  });

  rep.forEach(r => {
    const data = r.dataProducao || r.periodoIni || r.periodoFim;
    if (!data) return;
    const info = U.semanaOperacionalInfo(data);
    const k = chave(info, r);
    if (!mapa[k]) mapa[k] = novo(info, r, data);
    mapa[k].dormRecusados += U.int(r.totalRefugos || 1);
  });

  ens.forEach(r => {
    if (!r.dataEnsaio) return;
    const info = U.semanaOperacionalInfo(r.dataEnsaio);
    const k = chave(info, r);
    if (!mapa[k]) mapa[k] = novo(info, r, r.dataEnsaio);
    mapa[k].ensaiosReal += 1;
    if (r.resultado === 'Aprovado') mapa[k].ensaiosAprov += 1;
    else if (r.resultado === 'Reprovado') mapa[k].ensaiosRec += 1;
    else mapa[k].ensaiosPend += 1;
  });

  return Object.values(mapa);
}

function atualizarFiltroSemanaSemanal(selecionado) {
  U.preencherFiltroSemana('fSemana', datasSemanaSemanal(), selecionado ?? document.getElementById('fSemana')?.value, 'Todas as semanas');
}

function sincronizarSemanaSemanal() {
  U.sincronizarFiltroSemana('fSemana', document.getElementById('fPeriodoIni')?.value || '', document.getElementById('fPeriodoFim')?.value || '');
}

function datasSemanaSemanal() {
  const datas = [];
  Semanal.prod.forEach(r => { if (r.dataFabricacao) datas.push(r.dataFabricacao); });
  Semanal.rep.forEach(r => { [r.dataProducao, r.periodoIni, r.periodoFim].forEach(d => { if (d) datas.push(d); }); });
  Semanal.ens.forEach(r => { if (r.dataEnsaio) datas.push(r.dataEnsaio); });
  Semanal.acomp.forEach(r => { if (r.dataEnsaio) datas.push(r.dataEnsaio); });
  return datas;
}

function periodoUltimaSemanaDisponivel() {
  const datas = datasSemanaSemanal();
  const ultima = datas.sort(compararData).pop();
  return ultima ? U.periodoSemanaOperacional(ultima) : null;
}

function dentroPeriodoIntervalo(regIni, regFim, dataUnica, filtroIni, filtroFim) {
  if (!filtroIni && !filtroFim) return true;
  const a = regIni || dataUnica || regFim;
  const b = regFim || dataUnica || regIni;
  if (!a && !b) return false;
  if (filtroIni && b && b < filtroIni) return false;
  if (filtroFim && a && a > filtroFim) return false;
  return true;
}

function mapProducao(r) {
  return {
    id: r.id,
    fornecedor: r.fornecedor || '',
    lote: r.lote || '',
    projeto: r.projeto || '',
    bitola: r.bitola || '',
    tipo: r.tipo_dormente || '',
    total: valorBanco(r.total_produzido),
    dataFabricacao: dataBanco(r.data_fabricacao),
  };
}

function mapReprovado(r) {
  return {
    id: r.id,
    producaoLoteId: r.producao_lote_id || '',
    fornecedor: r.fornecedor || '',
    lote: r.lote || '',
    projeto: r.projeto || '',
    bitola: r.bitola || '',
    tipo: r.tipo || '',
    molde: r.molde || '',
    cavidade: r.cavidade || '',
    motivoDetalhado: r.motivo_detalhado || '',
    motivoIndicador: r.motivo_indicador || '',
    semana: r.semana || '',
    ano: r.ano || '',
    totalRefugos: valorBanco(r.total_refugos || 1),
    dataProducao: dataBanco(r.data_producao),
    periodoIni: dataBanco(r.periodo_inicio),
    periodoFim: dataBanco(r.periodo_fim),
  };
}

function mapEnsaio(r) {
  return {
    id: r.id,
    producaoLoteId: r.producao_lote_id || '',
    fornecedor: r.fornecedor || '',
    projeto: r.projeto || '',
    bitola: r.bitola || '',
    lote: r.lote_ensaiado || '',
    serieLiberada: r.serie_liberada || '',
    resultado: r.resultado || '',
    quantidadeEnsaiada: valorBanco(r.quantidade_ensaiada),
    responsavel: r.responsavel || '',
    linkRelatorio: r.link_relatorio_iauditor || '',
    semana: r.semana || '',
    ano: r.ano || '',
    dataEnsaio: dataBanco(r.data_ensaio),
  };
}

function mapAcompanhamento(r) {
  return {
    id: r.id,
    producaoLoteId: r.producao_lote_id || '',
    fornecedor: r.fornecedor || '',
    projeto: r.projeto || '',
    bitola: r.bitola || '',
    lote: r.lote_ensaiado || '',
    serie: r.serie || '',
    resultado: r.resultado || '',
    quantidadeEnsaiada: valorBanco(r.quantidade_ensaiada),
    responsavel: r.responsavel || '',
    linkRelatorio: r.link_relatorio_iauditor || '',
    semana: r.semana || '',
    ano: r.ano || '',
    dataEnsaio: dataBanco(r.data_ensaio),
    dataProducao: dataBanco(r.data_producao),
  };
}

function valorBanco(v) { return v == null ? '' : String(v); }
function dataBanco(v) { return v ? String(v).slice(0, 10) : ''; }
function dataFimRegistro(r) { return r.periodoFim || r.data || r.periodoIni || ''; }
function compararData(a, b) { return String(a || '').localeCompare(String(b || '')); }
function mesmoTexto(a, b) { return U.norm(a) === U.norm(b); }
function mensagemErroBanco(err, padrao) {
  const msg = err?.message || err?.details || '';
  if (!msg) return padrao;
  if (/row-level security|violates row-level security/i.test(msg)) return 'Acesso bloqueado pelas regras de segurança do Supabase. Confira seu perfil em usuarios_app.';
  if (/JWT|token|auth/i.test(msg)) return 'Sessão expirada ou inválida. Saia e faça login novamente.';
  return msg;
}

function registrarExportacaoSemanal(lista, reps = [], ens = [], acomp = []) {
  if (!window.Exportacoes) return;
  const custo = Semanal.custoDormente;
  Exportacoes.registrar({
    titulo: 'Indicador Semanal',
    nomeArquivo: 'indicador-semanal',
    filtros: Exportacoes.filtrosDaTela(),
    secoes: [{
      titulo: 'Indicador semanal filtrado',
      columns: [
        { key: 'semanaExport', label: 'Semana' },
        { key: 'fornecedor', label: 'Fornecedor' },
        { key: 'projetoExport', label: 'Projeto' },
        { key: 'bitolaExport', label: 'Bitola' },
        { key: 'periodoExport', label: 'Período' },
        { key: 'produzidos', label: 'Produzidos' },
        { key: 'dormRecusados', label: 'Refugos' },
        { key: 'pctReprovaExport', label: '% Reprova' },
        { key: 'custoNaoQualidadeExport', label: 'Custo da não qualidade' },
        { key: 'ensaiosReal', label: 'Ensaios realizados' },
        { key: 'ensaiosAprov', label: 'Ensaios aprovados' },
        { key: 'ensaiosRec', label: 'Ensaios reprovados' },
        { key: 'ensaiosPend', label: 'Ensaios pendentes' }
      ],
      rows: lista.map(r => ({
        ...r,
        semanaExport: `${r.semana}/${r.ano}`,
        projetoExport: r.projeto || 'Geral',
        bitolaExport: r.bitola || U.bitolaDe(r),
        periodoExport: `${U.dataBR(r.periodoIni)} a ${U.dataBR(r.periodoFim)}`,
        pctReprovaExport: U.int(r.produzidos) ? `${((U.int(r.dormRecusados) / U.int(r.produzidos)) * 100).toFixed(1).replace('.', ',')}%` : '0,0%',
        custoNaoQualidadeExport: custo > 0 ? moedaBRSemanal(U.int(r.dormRecusados) * custo) : 'Custo não configurado'
      }))
    }, {
      titulo: 'Dormentes reprovados na semana',
      columns: [
        { key: 'semanaExport', label: 'Semana' },
        { key: 'periodoExport', label: 'Período operacional' },
        { key: 'dataExport', label: 'Data de produção' },
        { key: 'lote', label: 'Lote' },
        { key: 'projeto', label: 'Projeto' },
        { key: 'bitolaExport', label: 'Bitola' },
        { key: 'molde', label: 'Molde' },
        { key: 'cavidade', label: 'Cavidade' },
        { key: 'motivoIndicador', label: 'Motivo' },
        { key: 'motivoDetalhado', label: 'Motivo detalhado' },
        { key: 'totalRefugosExport', label: 'Refugos' }
      ],
      rows: reps.map(r => {
        const p = periodoReprovaSemanal(r);
        return {
          ...r,
          semanaExport: p.semana ? `${p.semana}/${p.ano}` : '—',
          periodoExport: p.ini || p.fim ? `${U.dataBR(p.ini)} a ${U.dataBR(p.fim)}` : '—',
          dataExport: U.dataBR(r.dataProducao),
          bitolaExport: U.bitolaDe(r),
          totalRefugosExport: U.int(r.totalRefugos) || 1
        };
      })
    }, {
      titulo: 'Ensaios de liberação na semana',
      columns: [
        { key: 'dataExport', label: 'Data' },
        { key: 'semanaExport', label: 'Semana' },
        { key: 'fornecedor', label: 'Fornecedor' },
        { key: 'projeto', label: 'Projeto' },
        { key: 'bitolaExport', label: 'Bitola' },
        { key: 'lote', label: 'Lote ensaiado' },
        { key: 'serieLiberada', label: 'Série liberada' },
        { key: 'resultado', label: 'Resultado' },
        { key: 'quantidadeEnsaiada', label: 'Quantidade ensaiada' },
        { key: 'responsavel', label: 'Responsável' },
        { key: 'linkRelatorio', label: 'Relatório' }
      ],
      rows: ens.map(r => ({
        ...r,
        dataExport: U.dataBR(r.dataEnsaio),
        semanaExport: r.semana && r.ano ? `${r.semana}/${r.ano}` : (U.semanaOperacionalInfo(r.dataEnsaio).semana ? `${U.semanaOperacionalInfo(r.dataEnsaio).semana}/${U.semanaOperacionalInfo(r.dataEnsaio).ano}` : '—'),
        bitolaExport: U.bitolaDe(r)
      }))
    }, {
      titulo: 'Ensaios de acompanhamento na semana (14 dias · cura térmica)',
      columns: [
        { key: 'dataExport', label: 'Data do ensaio' },
        { key: 'dataProducaoExport', label: 'Data de produção' },
        { key: 'diasExport', label: 'Dias após produção' },
        { key: 'semanaExport', label: 'Semana' },
        { key: 'fornecedor', label: 'Fornecedor' },
        { key: 'projeto', label: 'Projeto' },
        { key: 'bitolaExport', label: 'Bitola' },
        { key: 'lote', label: 'Lote ensaiado' },
        { key: 'serie', label: 'Série (referência)' },
        { key: 'resultado', label: 'Resultado' },
        { key: 'quantidadeEnsaiada', label: 'Quantidade ensaiada' },
        { key: 'responsavel', label: 'Responsável' },
        { key: 'linkRelatorio', label: 'Relatório' }
      ],
      rows: acomp.map(r => {
        const dias = diasEntreDatasSemanal(r.dataProducao, r.dataEnsaio);
        return {
          ...r,
          dataExport: U.dataBR(r.dataEnsaio),
          dataProducaoExport: U.dataBR(r.dataProducao),
          diasExport: dias == null ? '' : dias,
          semanaExport: r.semana && r.ano ? `${r.semana}/${r.ano}` : (U.semanaOperacionalInfo(r.dataEnsaio).semana ? `${U.semanaOperacionalInfo(r.dataEnsaio).semana}/${U.semanaOperacionalInfo(r.dataEnsaio).ano}` : '—'),
          bitolaExport: U.bitolaDe(r)
        };
      })
    }]
  });
}
