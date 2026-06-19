/* =====================================================================
   RASTREABILIDADE.JS — Dormente × Ombreira (Concreto)

   Cruza, por lote de dormente:
   - Produção de Dormentes: fornecedor, projeto, lote do dormente,
     tipo e lote da ombreira utilizada.
   - Inspeção de Pista (mesmo lote do dormente): responsável.
   - Inspeções Subcomponentes (mesmo lote da ombreira): se foi
     inspecionada, data, relatório, responsável, aprovação e NC.

   Regra do subcomponente por projeto:
   - FERRO NORTE  -> Ombreira E-CLIP HFOB02
   - demais       -> Ombreira FAST-CLIP HFOB08

   Tela consultiva (somente leitura) — funciona para qualquer perfil.
   ===================================================================== */

let RT_PRODUCAO = [];
let RT_PISTA = [];
let RT_OMBREIRA = [];
let RT_LINHAS = [];
let RT_CARREGANDO = true;
let RT_ERRO = '';
let RT_AVISO_OMBREIRA = '';

/* ---- helpers locais (sem dependências externas) ---- */
const norm = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
// Mesma normalização de lote usada na área de Subcomponentes, para o cruzamento casar.
function lotKey(v) { return norm(v).replace(/[.\-]/g, '/').replace(/\s+/g, '').replace(/^0+(?=\d)/, '').replace(/\/0+(?=\d)/g, '/') || 'SEM LOTE'; }
function esc(v) { return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function num(v) { const n = Number(v ?? 0); return Number.isFinite(n) ? n : 0; }
function dataBR(iso) { if (!iso) return '—'; const m = String(iso).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[3]}/${m[2]}/${m[1]}` : esc(iso); }
function linkRel(url) { const u = String(url || '').trim(); if (!u) return '—'; const href = /^https?:\/\//i.test(u) ? u : `https://${u}`; return `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">Abrir</a>`; }
function badge(texto, cls) { return `<span class="badge ${cls || ''}">${esc(texto)}</span>`; }
function valor(id) { return (document.getElementById(id)?.value || ''); }

function ehFerroNorte(projeto) { return norm(projeto).includes('FERRO'); }
function ombreiraEsperada(projeto) {
  return ehFerroNorte(projeto)
    ? { tipo: 'E-Clip', codigo: 'HFOB02', nome: 'Ombreira E-CLIP HFOB02' }
    : { tipo: 'Fast Clip', codigo: 'HFOB08', nome: 'Ombreira FAST-CLIP HFOB08' };
}

/* ---- bootstrap ---- */
document.addEventListener('DOMContentLoaded', async () => {
  if (!await Auth.exigirLogin()) return;
  App.montarLayout('rastreabilidade', 'Rastreabilidade', 'Dormente × ombreira — cruzamento com Inspeções Subcomponentes');
  ['busca', 'fFornecedor', 'fProjeto', 'fSituacao'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) { el.addEventListener('input', render); el.addEventListener('change', render); }
  });
  await carregar();
});

/* ---- carregamento ---- */
async function carregar() {
  RT_CARREGANDO = true;
  RT_ERRO = '';
  RT_AVISO_OMBREIRA = '';
  render();
  try {
    await Auth.exigirLogin();
    const [producao, pista] = await Promise.all([
      StoreSupabase.listarProducao({ limite: 5000 }),
      StoreSupabase.listarInspecoesPista({ limite: 5000 }),
    ]);
    RT_PRODUCAO = producao || [];
    RT_PISTA = pista || [];

    // Inspeções de subcomponentes (ombreira) — degrada sem derrubar a tela.
    try {
      RT_OMBREIRA = await StoreSubcomponentesSupabase.listarInspecoes();
    } catch (errOmbreira) {
      console.warn('Não foi possível carregar as inspeções de subcomponentes:', errOmbreira?.message || errOmbreira);
      RT_OMBREIRA = [];
      RT_AVISO_OMBREIRA = 'Não foi possível ler as Inspeções Subcomponentes agora. Os lotes aparecem, mas a situação da ombreira pode estar incompleta.';
    }

    construirLinhas();
    montarFiltros();
    RT_CARREGANDO = false;
    render();
  } catch (err) {
    console.error('Erro ao carregar rastreabilidade', err);
    RT_CARREGANDO = false;
    RT_ERRO = (err && err.message) ? err.message : 'Não foi possível carregar os dados da rastreabilidade.';
    App.toast(RT_ERRO, 'erro');
    render();
  }
}

function construirLinhas() {
  RT_LINHAS = RT_PRODUCAO.map((p) => {
    const projeto = p.projeto || '';
    const loteDormente = p.lote || '';
    const loteOmbreira = p.lote_ombreira || '';
    const esperada = ombreiraEsperada(projeto);

    // Responsável pela inspeção do lote do dormente -> Inspeção de Pista (mesmo lote).
    const keyDorm = lotKey(loteDormente);
    const pistas = RT_PISTA
      .filter((x) => loteDormente && lotKey(x.lote) === keyDorm)
      .sort((a, b) => String(b.data_inspecao || '').localeCompare(String(a.data_inspecao || '')));
    const pista = pistas[0] || null;

    // Inspeção da ombreira -> Inspeções Subcomponentes (mesmo lote da ombreira + subcomponente do projeto).
    let insp = null;
    let situacao = 'sem-lote';
    if (loteOmbreira) {
      const keyOmb = lotKey(loteOmbreira);
      const candidatos = RT_OMBREIRA
        .filter((i) => lotKey(i.lote) === keyOmb && norm(i.subcomponente).includes(esperada.codigo))
        .sort((a, b) => String(b.diaInspecao || '').localeCompare(String(a.diaInspecao || '')));
      insp = candidatos[0] || null;
      situacao = insp ? 'inspecionada' : 'nao-inspecionada';
    }

    const statusOmb = insp ? (insp.status || '') : '';
    let aprovada = null; // true / false / null (pendente ou sem inspeção)
    if (insp) {
      const s = norm(statusOmb);
      if (s.startsWith('APROVADO')) aprovada = true;
      else if (s.startsWith('REPROVADO')) aprovada = false;
    }
    const temNc = insp ? num(insp.qtdNc) > 0 : null;

    return {
      id: p.id,
      dataFabricacao: p.data_fabricacao || '',
      fornecedor: p.fornecedor || '',
      projeto,
      loteDormente,
      tipoOmbreiraProd: p.tipo_ombreira || '',
      loteOmbreira,
      esperada,
      respDormente: pista ? (pista.responsavel || '') : '',
      pista,
      insp,
      situacao,
      statusOmb,
      aprovada,
      temNc,
      respOmbreira: insp ? (insp.responsavel || '') : '',
    };
  });
}

/* ---- filtros ---- */
const SITUACAO_LABEL = { 'inspecionada': 'Inspecionada', 'nao-inspecionada': 'Não inspecionada', 'sem-lote': 'Sem lote de ombreira' };
const SITUACAO_VALOR = { 'Inspecionada': 'inspecionada', 'Não inspecionada': 'nao-inspecionada', 'Sem lote de ombreira': 'sem-lote' };

function montarFiltros() {
  const fornecedores = [...new Set(RT_LINHAS.map((r) => r.fornecedor).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const projetos = [...new Set(RT_LINHAS.map((r) => r.projeto).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  preencherSelect('fFornecedor', fornecedores, 'Todos');
  preencherSelect('fProjeto', projetos, 'Todos');
  preencherSelect('fSituacao', ['Inspecionada', 'Não inspecionada', 'Sem lote de ombreira'], 'Todas');
}
function preencherSelect(id, valores, rotuloTodos) {
  const el = document.getElementById(id);
  if (!el) return;
  const atual = el.value;
  el.innerHTML = `<option value="">${esc(rotuloTodos)}</option>` + valores.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
  if (atual) el.value = atual;
}

function linhasFiltradas() {
  const fForn = valor('fFornecedor');
  const fProj = valor('fProjeto');
  const fSit = SITUACAO_VALOR[valor('fSituacao')] || '';
  const q = valor('busca').trim().toLowerCase();
  return RT_LINHAS.filter((r) => {
    if (fForn && r.fornecedor !== fForn) return false;
    if (fProj && r.projeto !== fProj) return false;
    if (fSit && r.situacao !== fSit) return false;
    if (q) {
      const blob = `${r.loteDormente} ${r.loteOmbreira} ${r.fornecedor} ${r.projeto} ${r.respDormente} ${r.respOmbreira} ${r.esperada.nome} ${r.tipoOmbreiraProd}`.toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  });
}

/* ---- render ---- */
function render() {
  const lista = document.getElementById('lista');
  const kpis = document.getElementById('kpis');
  const contador = document.getElementById('contador');
  if (!lista) return;

  if (RT_CARREGANDO) {
    if (kpis) kpis.innerHTML = '';
    if (contador) contador.textContent = 'carregando...';
    lista.innerHTML = `<div class="vazio"><h3>Carregando rastreabilidade...</h3><p>Lendo produção, inspeções de pista e inspeções de subcomponentes.</p></div>`;
    return;
  }
  if (RT_ERRO) {
    if (kpis) kpis.innerHTML = '';
    if (contador) contador.textContent = '—';
    lista.innerHTML = `<div class="vazio">${ICN.alerta}<h3>Erro ao carregar</h3><p>${esc(RT_ERRO)}</p><button class="btn btn-secundario" onclick="carregar()">Tentar novamente</button></div>`;
    return;
  }

  const linhas = linhasFiltradas();
  if (contador) contador.textContent = `${linhas.length} de ${RT_LINHAS.length} lote(s)`;

  // KPIs
  const inspecionadas = linhas.filter((r) => r.situacao === 'inspecionada').length;
  const naoInspecionadas = linhas.filter((r) => r.situacao === 'nao-inspecionada').length;
  const comNc = linhas.filter((r) => r.temNc === true).length;
  if (kpis) {
    kpis.innerHTML = `
      <div class="kpi escuro"><div class="rotulo">Lotes no filtro</div><div class="valor">${linhas.length}</div><div class="extra">dormentes produzidos</div></div>
      <div class="kpi"><div class="rotulo">Ombreira inspecionada</div><div class="valor">${inspecionadas}</div><div class="extra">com inspeção encontrada</div></div>
      <div class="kpi amarelo"><div class="rotulo">Ombreira não inspecionada</div><div class="valor">${naoInspecionadas}</div><div class="extra">lote sem inspeção</div></div>
      <div class="kpi"><div class="rotulo">Com não conformidade</div><div class="valor">${comNc}</div><div class="extra">NC na inspeção da ombreira</div></div>`;
  }

  const aviso = RT_AVISO_OMBREIRA ? `<div class="badge badge-amarelo" style="display:inline-flex;margin-bottom:12px">${esc(RT_AVISO_OMBREIRA)}</div>` : '';

  if (!linhas.length) {
    lista.innerHTML = `${aviso}<div class="vazio">${ICN.alerta}<h3>Nenhum lote encontrado</h3><p>Ajuste os filtros ou cadastre a produção de dormentes.</p></div>`;
    return;
  }

  const linhasHtml = linhas.map((r) => {
    return `<tr>
      <td>${esc(r.fornecedor || '—')}</td>
      <td>${esc(r.projeto || '—')}</td>
      <td><strong>${esc(r.loteDormente || '—')}</strong></td>
      <td>${esc(r.respDormente || '—')}</td>
      <td><strong>${esc(r.loteOmbreira || '—')}</strong></td>
      <td>${esc(r.esperada.tipo)} <span class="txt-mini txt-cinza">${esc(r.esperada.codigo)}</span></td>
      <td>${badgeSituacao(r.situacao)}</td>
      <td>${r.insp ? dataBR(r.insp.diaInspecao) : '—'}</td>
      <td>${r.situacao === 'inspecionada' ? esc(r.respOmbreira || '—') : '—'}</td>
      <td>${badgeAprovada(r)}</td>
      <td>${badgeNc(r)}</td>
      <td>${r.insp ? linkRel(r.insp.linkIauditor) : '—'}</td>
      <td><button class="icone-btn" title="Ver rastreabilidade do lote" onclick="abrirVer('${esc(r.id)}')">${ICN.olho}</button></td>
    </tr>`;
  }).join('');

  lista.innerHTML = `${aviso}
    <div class="tabela-wrap">
      <table class="tabela">
        <thead><tr>
          <th>Fornecedor</th><th>Projeto</th><th>Lote dormente</th><th>Resp. dormente</th>
          <th>Lote ombreira</th><th>Ombreira</th><th>Inspeção ombreira</th><th>Data insp.</th>
          <th>Resp. ombreira</th><th>Aprovada</th><th>NC</th><th>Relatório</th><th></th>
        </tr></thead>
        <tbody>${linhasHtml}</tbody>
      </table>
    </div>`;
}

function badgeSituacao(situacao) {
  if (situacao === 'inspecionada') return badge('Inspecionada', 'badge-ok');
  if (situacao === 'nao-inspecionada') return badge('Não inspecionada', 'badge-amarelo');
  return badge('Sem lote de ombreira', 'badge-entregue');
}
function badgeAprovada(r) {
  if (!r.insp) return '—';
  if (r.aprovada === true) return badge('Aprovada', 'badge-ok');
  if (r.aprovada === false) return badge('Reprovada', 'badge-reprovado');
  return badge(r.statusOmb || 'Pendente', 'badge-amarelo');
}
function badgeNc(r) {
  if (!r.insp) return '—';
  return r.temNc ? badge('Com NC', 'badge-reprovado') : badge('Sem NC', 'badge-ok');
}

/* ---- detalhe ---- */
function itemVer(rot, val) {
  return `<div class="detalhe-item"><div class="rot txt-mini txt-cinza">${esc(rot)}</div><div class="val">${esc(val ?? '') || '—'}</div></div>`;
}
function abrirVer(id) {
  const r = RT_LINHAS.find((x) => x.id === id);
  if (!r) return;
  const i = r.insp;
  const pistaHref = r.pista && r.pista.link_relatorio ? (/^https?:\/\//i.test(r.pista.link_relatorio) ? r.pista.link_relatorio : `https://${r.pista.link_relatorio}`) : '';
  const ombHref = i && i.linkIauditor ? (/^https?:\/\//i.test(i.linkIauditor) ? i.linkIauditor : `https://${i.linkIauditor}`) : '';

  document.getElementById('verTitulo').textContent = `Rastreabilidade — lote ${r.loteDormente || '—'}`;
  document.getElementById('verCorpo').innerHTML = `
    <div class="detalhe-secao"><strong>Dormente</strong></div>
    <div class="detalhe-grid">
      ${itemVer('Fornecedor', r.fornecedor)}
      ${itemVer('Projeto', r.projeto)}
      ${itemVer('Lote do dormente', r.loteDormente)}
      ${itemVer('Tipo de ombreira (produção)', r.tipoOmbreiraProd)}
      ${itemVer('Responsável pela inspeção do dormente', r.respDormente)}
      ${itemVer('Data da inspeção de pista', r.pista ? dataBR(r.pista.data_inspecao) : '—')}
    </div>
    ${pistaHref ? `<div class="form-acoes" style="justify-content:flex-start"><a class="btn btn-secundario" href="${esc(pistaHref)}" target="_blank" rel="noopener">${ICN.olho}Relatório da inspeção de pista</a></div>` : ''}

    <div class="detalhe-secao"><strong>Ombreira</strong></div>
    <div class="detalhe-grid">
      ${itemVer('Lote da ombreira', r.loteOmbreira)}
      ${itemVer('Subcomponente esperado', r.esperada.nome)}
      ${itemVer('Situação', SITUACAO_LABEL[r.situacao])}
      ${itemVer('Inspecionada', r.situacao === 'sem-lote' ? '—' : (i ? 'Sim' : 'Não'))}
      ${itemVer('Data da inspeção', i ? dataBR(i.diaInspecao) : '—')}
      ${itemVer('Responsável pela inspeção da ombreira', i ? r.respOmbreira : '—')}
      ${itemVer('Empresa / fábrica', i ? i.empresaNome : '—')}
      ${itemVer('Status', i ? r.statusOmb : '—')}
      ${itemVer('Aprovada', i ? (r.aprovada === true ? 'Sim' : (r.aprovada === false ? 'Não' : 'Pendente')) : '—')}
      ${itemVer('Não conformidade', i ? (r.temNc ? `Sim (${num(i.qtdNc)})` : 'Não') : '—')}
    </div>
    ${i && i.observacao ? `<div class="detalhe-secao"><strong>Observação da inspeção</strong><p style="white-space:pre-wrap">${esc(i.observacao)}</p></div>` : ''}
    <div class="form-acoes">
      ${ombHref ? `<a class="btn btn-primario" href="${esc(ombHref)}" target="_blank" rel="noopener">${ICN.olho}Abrir relatório da ombreira</a>` : (r.situacao === 'sem-lote' ? '<span class="badge badge-entregue">Sem lote de ombreira na produção</span>' : (i ? '<span class="badge badge-amarelo">Inspeção sem link de relatório</span>' : '<span class="badge badge-amarelo">Ombreira ainda não inspecionada</span>'))}
    </div>`;
  document.getElementById('modalVer').classList.add('aberto');
}
function fecharVer() { document.getElementById('modalVer').classList.remove('aberto'); }

window.carregar = carregar;
window.abrirVer = abrirVer;
window.fecharVer = fecharVer;
