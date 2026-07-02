/* =====================================================================
   DADOS.JS — Administração sem importação de massa
   20260609-custo-nao-qualidade: configuração do custo unitário do
   dormente (tabela configuracoes_sistema), usado pelo Indicador Semanal
   para calcular o Custo da Não Qualidade.
   ===================================================================== */
document.addEventListener('DOMContentLoaded', async () => {
  if (!await Auth.exigirLogin()) return;
  App.montarLayout('dados', 'Dados do Sistema', 'Administração, resumo e limpeza de dados locais legados');

  const perfil = window.USUARIO_ATUAL?.perfil || await Auth.perfilAtual().catch(() => null);
  if (!Auth.pode('gerenciarSistema', perfil)) {
    document.querySelector('.pagina').innerHTML = `
      <div class="card aviso-erro">
        <div class="card-titulo"><span class="acento">Acesso restrito</span></div>
        <p>Somente usuários com perfil <strong>admin</strong> podem acessar Dados do Sistema.</p>
      </div>`;
    const topoAcoes = document.getElementById('topoAcoes');
    if (topoAcoes) topoAcoes.innerHTML = '';
    return;
  }

  const bxProducao = document.getElementById('bxProducao');
  const bxReprovados = document.getElementById('bxReprovados');
  const bxEnsaios = document.getElementById('bxEnsaios');
  if (bxProducao) bxProducao.innerHTML = ICN.producao;
  if (bxReprovados) bxReprovados.innerHTML = ICN.reprova;
  if (bxEnsaios) bxEnsaios.innerHTML = ICN.check;

  if (!Auth.pode('criar')) {
    document.querySelectorAll("button[onclick*=\"producao.html\"], button[onclick*=\"reprovados.html\"], button[onclick*=\"ensaios-liberacao.html\"]").forEach(btn => btn.hidden = true);
    const blocoEntrada = document.querySelector('.card .flex.gap12');
    if (blocoEntrada) blocoEntrada.insertAdjacentHTML('afterbegin', App.avisoModoConsulta());
  }
  if (!Auth.pode('excluir')) document.querySelector('button[onclick="limparDadosLocaisLegados()"]')?.setAttribute('hidden', 'hidden');

  atualizarFiltroSemanaDados();
  document.getElementById('fSemanaDados')?.addEventListener('change', renderResumoSemanaDados);
  atualizarKpis();
  renderResumoSemanaDados();
  carregarCustoDormente();
  atualizarBotaoFestaHexa();
  window.FestaHexa?.sincronizar().then(atualizarBotaoFestaHexa);
  atualizarBotaoTremFujao();
  sincronizarTremFujao();
});

/* ---------- Comemoração da Copa (Rumo ao Hexa) — configuração global ---------- */
async function alternarFestaHexa() {
  if (!window.FestaHexa) return;
  const btn = document.getElementById('btnFestaHexa');
  const ligar = !FestaHexa.ativa();
  if (btn) btn.disabled = true;
  try {
    await FestaHexa.definir(ligar);
    atualizarBotaoFestaHexa();
    App.toast(ligar
      ? 'Comemoração da Copa ativada para todos os usuários. Rumo ao Hexa!'
      : 'Comemoração da Copa desativada para todos os usuários.', ligar ? 'sucesso' : 'aviso');
    if (ligar) FestaHexa.celebrar();
  } catch (err) {
    console.error('Erro ao salvar configuração da comemoração', err);
    const msg = /configuracoes_sistema|Could not find the table|schema cache/i.test(err?.message || '')
      ? 'A tabela configuracoes_sistema ainda não existe no Supabase. Rode o arquivo supabase/2026-06-09-configuracoes-sistema.sql no SQL Editor.'
      : (err?.message || 'Não foi possível salvar a configuração no Supabase.');
    App.toast(msg, 'erro');
    FestaHexa.sincronizar().then(atualizarBotaoFestaHexa); // desfaz o cache local
  } finally {
    if (btn) btn.disabled = false;
  }
}

function atualizarBotaoFestaHexa() {
  const btn = document.getElementById('btnFestaHexa');
  const status = document.getElementById('festaHexaStatus');
  if (!btn || !window.FestaHexa) return;
  const ligada = FestaHexa.ativa();
  btn.textContent = ligada ? '⚽ Desativar comemoração' : '⚽ Ativar comemoração';
  btn.className = ligada ? 'btn btn-perigo' : 'btn btn-primario';
  if (status) status.textContent = ligada
    ? 'Status: ativada para todos os usuários (admin, fiscalização e consulta).'
    : 'Status: desativada para todos os usuários (admin, fiscalização e consulta).';
}

/* ---------- Trem fujão da tela de login — configuração global ---------- */
const TREM_FUJAO_CHAVE = 'trem_fujao_login';
let tremFujaoLigado = true; // padrão: ativado (mesmo comportamento do login)

async function sincronizarTremFujao() {
  try {
    const cfg = await StoreSupabase.obterConfiguracaoSistema(TREM_FUJAO_CHAVE);
    tremFujaoLigado = String(cfg?.valor ?? '1').trim() !== '0';
  } catch (e) { /* sem conexão/tabela: mantém o padrão */ }
  atualizarBotaoTremFujao();
}

async function alternarTremFujao() {
  const btn = document.getElementById('btnTremFujao');
  const ligar = !tremFujaoLigado;
  if (btn) btn.disabled = true;
  try {
    await StoreSupabase.salvarConfiguracaoSistema({ chave: TREM_FUJAO_CHAVE, valor: ligar ? '1' : '0' });
    tremFujaoLigado = ligar;
    atualizarBotaoTremFujao();
    App.toast(ligar
      ? 'Trem fujão ativado na tela de login para todos os visitantes.'
      : 'Trem fujão desativado na tela de login para todos os visitantes.', ligar ? 'sucesso' : 'aviso');
  } catch (err) {
    console.error('Erro ao salvar configuração do trem fujão', err);
    const msg = /configuracoes_sistema|Could not find the table|schema cache/i.test(err?.message || '')
      ? 'A tabela configuracoes_sistema ainda não existe no Supabase. Rode os arquivos supabase/2026-06-09-configuracoes-sistema.sql e supabase/2026-07-02-trem-fujao-login.sql no SQL Editor.'
      : (err?.message || 'Não foi possível salvar a configuração no Supabase.');
    App.toast(msg, 'erro');
    sincronizarTremFujao(); // desfaz o estado local
  } finally {
    if (btn) btn.disabled = false;
  }
}

function atualizarBotaoTremFujao() {
  const btn = document.getElementById('btnTremFujao');
  const status = document.getElementById('tremFujaoStatus');
  if (!btn) return;
  btn.textContent = tremFujaoLigado ? '🚂 Desativar trem fujão' : '🚂 Ativar trem fujão';
  btn.className = tremFujaoLigado ? 'btn btn-perigo' : 'btn btn-primario';
  if (status) status.textContent = tremFujaoLigado
    ? 'Status: ativado na tela de login para todos os visitantes.'
    : 'Status: desativado na tela de login para todos os visitantes.';
}

function atualizarKpis() {
  const d = Store.tudo();
  const fmt = d.atualizadoEm ? new Date(d.atualizadoEm).toLocaleString('pt-BR') : '—';
  document.getElementById('kpis').innerHTML = `
    <div class="kpi escuro"><div class="rotulo">Produção</div><div class="valor">${d.producao.length}</div><div class="extra">registros locais legados</div></div>
    <div class="kpi vermelho"><div class="rotulo">Reprovados</div><div class="valor">${d.reprovados.length}</div><div class="extra">registros locais legados</div></div>
    <div class="kpi"><div class="rotulo">Indicador semanal</div><div class="valor">${d.semanal.length}</div><div class="extra">registros locais legados</div></div>
    <div class="kpi verde"><div class="rotulo">Ensaios de liberação</div><div class="valor">${(d.ensaiosLiberacao || []).length}</div><div class="extra">registros locais legados</div></div>
    <div class="kpi amarelo"><div class="rotulo">Último dado local</div><div class="valor" style="font-size:15px;font-weight:600;line-height:1.4;margin-top:10px">${fmt}</div><div class="extra">apenas armazenamento do navegador</div></div>`;
}

function limparDadosLocaisLegados() {
  if (!Auth.pode('excluir')) { App.toast(Auth.mensagemSemPermissao('limpar dados locais legados'), 'aviso'); return; }
  if (!App.confirmar('Isto apaga apenas dados antigos salvos neste navegador. Dados do Supabase não serão apagados. Continuar?')) return;
  if (!App.confirmar('Última confirmação: limpar armazenamento local legado?')) return;
  Store.limpar();
  atualizarFiltroSemanaDados();
  atualizarKpis();
  renderResumoSemanaDados();
  App.toast('Dados locais legados foram limpos.');
}

function atualizarFiltroSemanaDados() {
  U.preencherFiltroSemana('fSemanaDados', datasSemanaDados(), document.getElementById('fSemanaDados')?.value, 'Todas as semanas');
}

function datasSemanaDados() {
  const d = Store.tudo();
  const datas = [];
  (d.producao || []).forEach(r => { if (r.dataFabricacao) datas.push(r.dataFabricacao); });
  (d.reprovados || []).forEach(r => { [r.dataProducao, r.periodoFim, r.periodoIni].forEach(x => { if (x) datas.push(x); }); });
  (d.semanal || []).forEach(r => { [r.periodoFim, r.data, r.periodoIni].forEach(x => { if (x) datas.push(x); }); });
  (d.ensaiosLiberacao || []).forEach(r => { [r.dataEnsaio, r.periodoFim, r.periodoIni].forEach(x => { if (x) datas.push(x); }); });
  return datas;
}

function renderResumoSemanaDados() {
  const alvo = document.getElementById('resumoSemanaDados');
  if (!alvo) return;
  const d = Store.tudo();
  const periodo = U.periodoDeValorSemana(document.getElementById('fSemanaDados')?.value);
  const prod = (d.producao || []).filter(r => !periodo || dentroPeriodoData(r.dataFabricacao, periodo.ini, periodo.fim));
  const reps = (d.reprovados || []).filter(r => !periodo || dentroPeriodoIntervalo(r.periodoIni, r.periodoFim, r.dataProducao, periodo.ini, periodo.fim));
  const sem = (d.semanal || []).filter(r => !periodo || dentroPeriodoIntervalo(r.periodoIni, r.periodoFim, r.data, periodo.ini, periodo.fim));
  const ens = (d.ensaiosLiberacao || []).filter(r => !periodo || dentroPeriodoIntervalo(r.periodoIni, r.periodoFim, r.dataEnsaio, periodo.ini, periodo.fim));
  const totalProd = prod.reduce((s, r) => s + U.int(r.total), 0);
  const totalRef = reps.reduce((s, r) => s + (U.int(r.totalRefugos) || 1), 0);
  const rotulo = periodo ? `${U.dataBR(periodo.ini)} a ${U.dataBR(periodo.fim)}` : 'todas as semanas';
  registrarExportacaoDadosResumo(periodo, totalProd, prod, totalRef, reps, sem, ens);
  alvo.innerHTML = `
    <div class="kpi escuro"><div class="rotulo">Período</div><div class="valor" style="font-size:15px">${rotulo}</div><div class="extra">semana operacional selecionada</div></div>
    <div class="kpi"><div class="rotulo">Produção local</div><div class="valor">${totalProd.toLocaleString('pt-BR')}</div><div class="extra">${prod.length} lote(s) locais</div></div>
    <div class="kpi vermelho"><div class="rotulo">Reprovados locais</div><div class="valor">${totalRef.toLocaleString('pt-BR')}</div><div class="extra">${reps.length} registro(s) locais</div></div>
    <div class="kpi verde"><div class="rotulo">Indicador local</div><div class="valor">${sem.length}</div><div class="extra">linha(s) locais</div></div>
    <div class="kpi amarelo"><div class="rotulo">Ensaios locais</div><div class="valor">${ens.length}</div><div class="extra">registro(s) locais</div></div>`;
}

function dentroPeriodoData(iso, ini, fim) {
  if (!ini && !fim) return true;
  if (!iso) return false;
  if (ini && iso < ini) return false;
  if (fim && iso > fim) return false;
  return true;
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

function registrarExportacaoDadosResumo(periodo, totalProd, prod, totalRef, reps, sem, ens) {
  if (!window.Exportacoes) return;
  const rotulo = periodo ? `${U.dataBR(periodo.ini)} a ${U.dataBR(periodo.fim)}` : 'Todas as semanas';
  Exportacoes.registrar({
    titulo: 'Dados do Sistema',
    nomeArquivo: 'dados-sistema-resumo',
    filtros: Exportacoes.filtrosDaTela(),
    secoes: [{
      titulo: 'Resumo administrativo',
      columns: [{ key: 'indicador', label: 'Indicador' }, { key: 'valor', label: 'Valor' }],
      rows: [
        { indicador: 'Período', valor: rotulo },
        { indicador: 'Produção local legada', valor: totalProd },
        { indicador: 'Lotes locais legados', valor: prod.length },
        { indicador: 'Reprovados locais legados', valor: totalRef },
        { indicador: 'Registros locais de reprovados', valor: reps.length },
        { indicador: 'Indicadores locais legados', valor: sem.length },
        { indicador: 'Ensaios locais legados', valor: ens.length },
        { indicador: 'Observação', valor: 'Esta tela é administrativa. Os dados oficiais de produção, reprovas, ensaios, dashboard e indicador vêm do Supabase.' }
      ]
    }]
  });
}

/* ---------------------------------------------------------------------
   Custo da Não Qualidade — custo unitário do dormente (admin)
   --------------------------------------------------------------------- */
async function carregarCustoDormente() {
  const campo = document.getElementById('custoDormente');
  const status = document.getElementById('custoDormenteStatus');
  if (!campo) return;
  if (status) status.textContent = 'Carregando valor configurado...';
  try {
    const cfg = await StoreSupabase.obterConfiguracaoSistema('custo_dormente');
    const custo = numeroCustoDormente(cfg?.valor);
    campo.value = custo > 0 ? String(cfg.valor) : '';
    if (status) {
      status.textContent = custo > 0
        ? `Valor atual: ${moedaBRDados(custo)}${cfg?.atualizado_em ? ` · atualizado em ${new Date(cfg.atualizado_em).toLocaleString('pt-BR')}` : ''}`
        : 'Nenhum custo configurado. O Indicador Semanal passa a exibir o custo da não qualidade após o cadastro.';
    }
  } catch (err) {
    console.error('Erro ao carregar custo do dormente', err);
    if (status) {
      status.textContent = /configuracoes_sistema|Could not find the table|schema cache/i.test(err?.message || '')
        ? 'A tabela configuracoes_sistema ainda não existe no Supabase. Rode o arquivo supabase/2026-06-09-configuracoes-sistema.sql no SQL Editor.'
        : (err?.message || 'Não foi possível carregar o custo configurado.');
    }
  }
}

async function salvarCustoDormente() {
  if (!Auth.pode('gerenciarSistema')) { App.toast(Auth.mensagemSemPermissao('configurar o custo do dormente'), 'aviso'); return; }
  const campo = document.getElementById('custoDormente');
  const custo = numeroCustoDormente(campo?.value);
  if (!(custo > 0)) { App.toast('Informe um custo unitário válido, maior que zero. Ex.: 850,00', 'aviso'); return; }
  const btn = document.getElementById('btnSalvarCusto');
  if (btn) btn.disabled = true;
  try {
    await StoreSupabase.salvarConfiguracaoSistema({ chave: 'custo_dormente', valor: custo.toFixed(2).replace('.', ',') });
    App.toast('Custo unitário do dormente salvo. O Indicador Semanal já usa o novo valor.');
    await carregarCustoDormente();
  } catch (err) {
    console.error('Erro ao salvar custo do dormente', err);
    App.toast(err?.message || 'Não foi possível salvar o custo do dormente.', 'erro');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function numeroCustoDormente(txt) {
  let s = String(txt ?? '').trim().replace(/[R$\s]/g, '');
  if (!s) return 0;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function moedaBRDados(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
