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
let RT_EDIT_ID = null;

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
function gv(id) { return (document.getElementById(id)?.value || '').trim(); }

// Mapeia o status armazenado do lote para um dos 6 valores canônicos da Produção.
function statusCanon(s) {
  const n = norm(s);
  if (!n) return '';
  const exato = (CFG.listas.status || []).find((v) => norm(v) === n);
  if (exato) return exato;
  if (n.includes('LIBERAD')) return 'Liberado para transporte';
  if (n.includes('28')) return 'Em processo de cura (28 dias)';
  if (n.includes('CURA')) return 'Em processo de cura (14 dias)';
  if (n.includes('AGUARDANDO')) return 'Aguardando ensaio de liberação';
  if (n.includes('REPROVAD')) return 'Reprovado';
  if (n.includes('ANALISE')) return 'Em análise';
  return s;
}
function badgeStatusDormente(s) {
  const c = statusCanon(s);
  if (!c) return '—';
  const cls = (CFG.statusBadge || {})[c] || 'badge-entregue';
  return `<span class="badge ${cls}">${esc(c)}</span>`;
}

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
    const esperada = ombreiraEsperada(projeto);

    // Responsável pela inspeção do lote do dormente -> Inspeção de Pista (mesmo lote).
    const keyDorm = lotKey(loteDormente);
    const pistas = RT_PISTA
      .filter((x) => loteDormente && lotKey(x.lote) === keyDorm)
      .sort((a, b) => String(b.data_inspecao || '').localeCompare(String(a.data_inspecao || '')));
    const pista = pistas[0] || null;

    // Um lote de dormente pode ter usado mais de um lote de ombreira.
    // Lê a coluna nova (lotes_ombreira) e, no histórico, separa o texto antigo.
    const lotesOmbreira = (Array.isArray(p.lotes_ombreira) && p.lotes_ombreira.length)
      ? U.parseLotesOmbreira(p.lotes_ombreira)
      : U.parseLotesOmbreira(p.lote_ombreira);

    // Para CADA lote de ombreira, cruza com as Inspeções Subcomponentes
    // (mesmo lote da ombreira + subcomponente do projeto).
    const ombreiras = lotesOmbreira.map((loteOmb) => {
      const keyOmb = lotKey(loteOmb);
      const candidatos = RT_OMBREIRA
        .filter((i) => lotKey(i.lote) === keyOmb && norm(i.subcomponente).includes(esperada.codigo))
        .sort((a, b) => String(b.diaInspecao || '').localeCompare(String(a.diaInspecao || '')));
      const insp = candidatos[0] || null;
      const statusOmb = insp ? (insp.status || '') : '';
      let aprovada = null; // true / false / null (pendente ou sem inspeção)
      if (insp) {
        const s = norm(statusOmb);
        if (s.startsWith('APROVADO')) aprovada = true;
        else if (s.startsWith('REPROVADO')) aprovada = false;
      }
      return {
        lote: loteOmb,
        insp,
        situacao: insp ? 'inspecionada' : 'nao-inspecionada',
        statusOmb,
        aprovada,
        temNc: insp ? num(insp.qtdNc) > 0 : null,
        respOmbreira: insp ? (insp.responsavel || '') : '',
      };
    });

    return {
      id: p.id,
      dataFabricacao: p.data_fabricacao || '',
      fornecedor: p.fornecedor || '',
      projeto,
      loteDormente,
      statusDormente: p.status || '',
      tipoOmbreiraProd: p.tipo_ombreira || '',
      loteOmbreira: U.juntarLotesOmbreira(lotesOmbreira), // texto juntado p/ busca/exibição
      esperada,
      respDormente: pista ? (pista.responsavel || '') : '',
      pista,
      ombreiras, // lista: um item por lote de ombreira (vazia = sem lote)
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
    if (fSit) {
      if (fSit === 'sem-lote') { if (r.ombreiras.length) return false; }
      else if (!r.ombreiras.some((o) => o.situacao === fSit)) return false;
    }
    if (q) {
      const resp = r.ombreiras.map((o) => o.respOmbreira).join(' ');
      const blob = `${r.loteDormente} ${r.loteOmbreira} ${r.fornecedor} ${r.projeto} ${r.respDormente} ${resp} ${r.esperada.nome} ${r.tipoOmbreiraProd}`.toLowerCase();
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
  const podeEditar = (Auth.pode('criar') || Auth.pode('editar'));
  if (contador) contador.textContent = `${linhas.length} de ${RT_LINHAS.length} lote(s)`;

  // KPIs (contam lotes de ombreira, somando todos os lotes de cada dormente)
  const todasOmbreiras = linhas.flatMap((r) => r.ombreiras);
  const inspecionadas = todasOmbreiras.filter((o) => o.situacao === 'inspecionada').length;
  const naoInspecionadas = todasOmbreiras.filter((o) => o.situacao === 'nao-inspecionada').length;
  const comNc = todasOmbreiras.filter((o) => o.temNc === true).length;
  if (kpis) {
    kpis.innerHTML = `
      <div class="kpi escuro"><div class="rotulo">Lotes no filtro</div><div class="valor">${linhas.length}</div><div class="extra">dormentes produzidos</div></div>
      <div class="kpi"><div class="rotulo">Ombreira inspecionada</div><div class="valor">${inspecionadas}</div><div class="extra">lotes de ombreira com inspeção</div></div>
      <div class="kpi amarelo"><div class="rotulo">Ombreira não inspecionada</div><div class="valor">${naoInspecionadas}</div><div class="extra">lotes de ombreira sem inspeção</div></div>
      <div class="kpi"><div class="rotulo">Com não conformidade</div><div class="valor">${comNc}</div><div class="extra">NC na inspeção da ombreira</div></div>`;
  }

  const aviso = RT_AVISO_OMBREIRA ? `<div class="badge badge-amarelo" style="display:inline-flex;margin-bottom:12px">${esc(RT_AVISO_OMBREIRA)}</div>` : '';

  if (!linhas.length) {
    lista.innerHTML = `${aviso}<div class="vazio">${ICN.alerta}<h3>Nenhum lote encontrado</h3><p>Ajuste os filtros ou cadastre a produção de dormentes.</p></div>`;
    return;
  }

  const linhasHtml = linhas.map((r) => {
    // Uma linha por lote de dormente; cada coluna de ombreira empilha um
    // sub-bloco por lote de ombreira (alinhados entre as colunas).
    const obs = r.ombreiras.length ? r.ombreiras : [null]; // null = sem lote de ombreira
    const col = (fn) => obs.map((o) => `<div class="rt-sub">${fn(o)}</div>`).join('');
    return `<tr>
      <td>${esc(r.fornecedor || '—')}</td>
      <td>${esc(r.projeto || '—')}</td>
      <td><strong>${esc(r.loteDormente || '—')}</strong></td>
      <td>${badgeStatusDormente(r.statusDormente)}</td>
      <td>${esc(r.respDormente || '—')}</td>
      <td class="rt-multi">${col((o) => o ? `<strong>${esc(o.lote)}</strong>` : '—')}</td>
      <td class="rt-multi">${col(() => `${esc(r.esperada.tipo)} <span class="txt-mini txt-cinza">${esc(r.esperada.codigo)}</span>`)}</td>
      <td class="rt-multi">${col((o) => o ? badgeSituacao(o.situacao) : badgeSituacao('sem-lote'))}</td>
      <td class="rt-multi">${col((o) => o && o.insp ? dataBR(o.insp.diaInspecao) : '—')}</td>
      <td class="rt-multi">${col((o) => o && o.situacao === 'inspecionada' ? esc(o.respOmbreira || '—') : '—')}</td>
      <td class="rt-multi">${col((o) => badgeAprovada(o))}</td>
      <td class="rt-multi">${col((o) => badgeNc(o))}</td>
      <td class="rt-multi">${col((o) => o && o.insp ? linkRel(o.insp.linkIauditor) : '—')}</td>
      <td><button class="icone-btn" title="Ver rastreabilidade do lote" onclick="abrirVer('${esc(r.id)}')">${ICN.olho}</button>${podeEditar ? `<button class="icone-btn" title="Editar lote de dormente" onclick="abrirEditar('${esc(r.id)}')">${ICN.edit}</button>` : ''}</td>
    </tr>`;
  }).join('');

  lista.innerHTML = `${aviso}
    <div class="tabela-wrap">
      <table class="tabela">
        <thead><tr>
          <th>Fornecedor</th><th>Projeto</th><th>Lote dormente</th><th>Status</th><th>Resp. dormente</th>
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
function badgeAprovada(o) {
  if (!o || !o.insp) return '—';
  if (o.aprovada === true) return badge('Aprovada', 'badge-ok');
  if (o.aprovada === false) return badge('Reprovada', 'badge-reprovado');
  return badge(o.statusOmb || 'Pendente', 'badge-amarelo');
}
function badgeNc(o) {
  if (!o || !o.insp) return '—';
  return o.temNc ? badge('Com NC', 'badge-reprovado') : badge('Sem NC', 'badge-ok');
}

/* ---- detalhe ---- */
function itemVer(rot, val) {
  return `<div class="detalhe-item"><div class="rot txt-mini txt-cinza">${esc(rot)}</div><div class="val">${esc(val ?? '') || '—'}</div></div>`;
}
function abrirVer(id) {
  const r = RT_LINHAS.find((x) => x.id === id);
  if (!r) return;
  const pistaHref = r.pista && r.pista.link_relatorio ? (/^https?:\/\//i.test(r.pista.link_relatorio) ? r.pista.link_relatorio : `https://${r.pista.link_relatorio}`) : '';

  const ombreirasHtml = r.ombreiras.map((o, idx) => {
    const i = o.insp;
    const ombHref = i && i.linkIauditor ? (/^https?:\/\//i.test(i.linkIauditor) ? i.linkIauditor : `https://${i.linkIauditor}`) : '';
    const titulo = r.ombreiras.length > 1 ? `Ombreira #${idx + 1} — lote ${esc(o.lote)}` : `Ombreira — lote ${esc(o.lote)}`;
    return `
    <div class="detalhe-secao"><strong>${titulo}</strong></div>
    <div class="detalhe-grid">
      ${itemVer('Lote da ombreira', o.lote)}
      ${itemVer('Subcomponente esperado', r.esperada.nome)}
      ${itemVer('Situação', SITUACAO_LABEL[o.situacao])}
      ${itemVer('Inspecionada', i ? 'Sim' : 'Não')}
      ${itemVer('Data da inspeção', i ? dataBR(i.diaInspecao) : '—')}
      ${itemVer('Responsável pela inspeção da ombreira', i ? o.respOmbreira : '—')}
      ${itemVer('Empresa / fábrica', i ? i.empresaNome : '—')}
      ${itemVer('Status', i ? o.statusOmb : '—')}
      ${itemVer('Aprovada', i ? (o.aprovada === true ? 'Sim' : (o.aprovada === false ? 'Não' : 'Pendente')) : '—')}
      ${itemVer('Não conformidade', i ? (o.temNc ? `Sim (${num(i.qtdNc)})` : 'Não') : '—')}
    </div>
    ${i && i.observacao ? `<div class="detalhe-secao"><strong>Observação da inspeção</strong><p style="white-space:pre-wrap">${esc(i.observacao)}</p></div>` : ''}
    <div class="form-acoes" style="justify-content:flex-start">
      ${ombHref ? `<a class="btn btn-primario" href="${esc(ombHref)}" target="_blank" rel="noopener">${ICN.olho}Abrir relatório da ombreira (${esc(o.lote)})</a>` : (i ? '<span class="badge badge-amarelo">Inspeção sem link de relatório</span>' : '<span class="badge badge-amarelo">Ombreira ainda não inspecionada</span>')}
    </div>`;
  }).join('');
  const ombreirasBloco = r.ombreiras.length ? ombreirasHtml
    : `<div class="detalhe-secao"><strong>Ombreira</strong></div><div class="form-acoes" style="justify-content:flex-start"><span class="badge badge-entregue">Sem lote de ombreira na produção</span></div>`;

  document.getElementById('verTitulo').textContent = `Rastreabilidade — lote ${r.loteDormente || '—'}`;
  document.getElementById('verCorpo').innerHTML = `
    <div class="detalhe-secao"><strong>Dormente</strong></div>
    <div class="detalhe-grid">
      ${itemVer('Fornecedor', r.fornecedor)}
      ${itemVer('Projeto', r.projeto)}
      ${itemVer('Lote do dormente', r.loteDormente)}
      ${itemVer('Status do lote', statusCanon(r.statusDormente))}
      ${itemVer('Tipo de ombreira (produção)', r.tipoOmbreiraProd)}
      ${itemVer('Lotes de ombreira', r.loteOmbreira)}
      ${itemVer('Responsável pela inspeção do dormente', r.respDormente)}
      ${itemVer('Data da inspeção de pista', r.pista ? dataBR(r.pista.data_inspecao) : '—')}
    </div>
    ${pistaHref ? `<div class="form-acoes" style="justify-content:flex-start"><a class="btn btn-secundario" href="${esc(pistaHref)}" target="_blank" rel="noopener">${ICN.olho}Relatório da inspeção de pista</a></div>` : ''}

    ${ombreirasBloco}`;
  document.getElementById('modalVer').classList.add('aberto');
}
function fecharVer() { document.getElementById('modalVer').classList.remove('aberto'); }

/* ---- edição do lote de dormente (grava em producao_lotes) ---- */
function opcoes(lista, selecionado) {
  return (lista || []).map((o) => `<option value="${esc(o)}" ${o === selecionado ? 'selected' : ''}>${esc(o)}</option>`).join('');
}

/* ---- Lotes de ombreira no modal de edição (várias caixas) ---- */
function linhaLoteOmbreiraEdit(valor = '') {
  return `<div class="lote-ombreira-linha">
    <input type="text" class="ed-lote-ombreira-input" value="${esc(valor)}" placeholder="Lote da ombreira">
    <button type="button" class="icone-btn" title="Remover este lote de ombreira" onclick="removerLoteOmbreiraEdit(this)">${ICN.del}</button>
  </div>`;
}
function preencherLotesOmbreiraEdit(valor) {
  const wrap = document.getElementById('edLotesOmbreiraWrap');
  if (!wrap) return;
  const lotes = U.parseLotesOmbreira(valor);
  const linhas = lotes.length >= 2 ? lotes : [...lotes, ...Array(2 - lotes.length).fill('')];
  wrap.innerHTML = linhas.map(linhaLoteOmbreiraEdit).join('');
}
function adicionarLoteOmbreiraEdit() {
  const wrap = document.getElementById('edLotesOmbreiraWrap');
  if (wrap) wrap.insertAdjacentHTML('beforeend', linhaLoteOmbreiraEdit(''));
}
function removerLoteOmbreiraEdit(btn) {
  const wrap = document.getElementById('edLotesOmbreiraWrap');
  if (!wrap) return;
  const linhas = wrap.querySelectorAll('.lote-ombreira-linha');
  if (linhas.length <= 2) { const inp = btn.closest('.lote-ombreira-linha')?.querySelector('input'); if (inp) inp.value = ''; return; }
  btn.closest('.lote-ombreira-linha')?.remove();
}
function coletarLotesOmbreiraEdit() {
  const wrap = document.getElementById('edLotesOmbreiraWrap');
  if (!wrap) return [];
  return [...wrap.querySelectorAll('.ed-lote-ombreira-input')].map((i) => i.value.trim()).filter(Boolean);
}
function abrirEditar(id) {
  if (!(Auth.pode('criar') || Auth.pode('editar'))) { App.toast(Auth.mensagemSemPermissao('editar registros'), 'aviso'); return; }
  const r = RT_LINHAS.find((x) => x.id === id);
  if (!r) return;
  RT_EDIT_ID = id;
  document.getElementById('editarTitulo').textContent = `Editar lote ${r.loteDormente || ''}`.trim();
  document.getElementById('editarCorpo').innerHTML = `
    <div class="form-grid">
      <div class="form-secao">Lote de dormente</div>
      <div class="campo"><label>Fornecedor</label><select id="edFornecedor"><option value="">Selecione...</option>${opcoes(CFG.listas.fornecedores, r.fornecedor)}</select></div>
      <div class="campo"><label>Projeto</label><select id="edProjeto"><option value="">Selecione...</option>${opcoes(CFG.listas.projetos, r.projeto)}</select></div>
      <div class="campo"><label>Lote do dormente</label><input id="edLote" type="text" value="${esc(r.loteDormente)}"></div>
      <div class="campo"><label>Status</label><select id="edStatus"><option value="">Selecione...</option>${opcoes(CFG.listas.status, statusCanon(r.statusDormente))}</select></div>
      <div class="campo full"><label class="txt-mini txt-cinza">O status também é calculado automaticamente na tela de Produção a partir dos ensaios de liberação e da cura. Uma alteração manual aqui pode ser recalculada quando o lote for editado na Produção.</label></div>

      <div class="form-secao">Ombreira</div>
      <div class="campo"><label>Tipo de ombreira</label><select id="edTipoOmbreira"><option value="">Selecione...</option>${opcoes(CFG.listas.ombreiras, r.tipoOmbreiraProd)}</select></div>
      <div class="campo full">
        <label>Lotes da ombreira <span class="txt-mini txt-cinza">(um campo por lote de ombreira usado)</span></label>
        <div id="edLotesOmbreiraWrap" class="lotes-ombreira-grupo"></div>
        <button type="button" class="btn btn-secundario btn-sm" onclick="adicionarLoteOmbreiraEdit()">+ Adicionar lote de ombreira</button>
      </div>
      <div class="campo full"><label class="txt-mini txt-cinza">A inspeção da ombreira (data, relatório, responsável, aprovação e NC) é editada na tela Inspeções Subcomponentes.</label></div>
    </div>
    <div class="form-acoes">
      <button type="button" class="btn btn-secundario" onclick="fecharEditar()">Cancelar</button>
      <button type="button" class="btn btn-primario" onclick="salvarEditar()">Salvar</button>
    </div>`;
  preencherLotesOmbreiraEdit(r.ombreiras.map((o) => o.lote));
  document.getElementById('modalEditar').classList.add('aberto');
}
async function salvarEditar() {
  if (!(Auth.pode('criar') || Auth.pode('editar'))) { App.toast(Auth.mensagemSemPermissao('salvar registros'), 'aviso'); return; }
  const id = RT_EDIT_ID;
  if (!id) return;
  const lotesOmbreira = coletarLotesOmbreiraEdit();
  const payload = {
    id,
    fornecedor: gv('edFornecedor') || null,
    projeto: gv('edProjeto') || null,
    lote: gv('edLote') || null,
    status: gv('edStatus') || null,
    tipo_ombreira: gv('edTipoOmbreira') || null,
    lote_ombreira: U.juntarLotesOmbreira(lotesOmbreira) || null,
    lotes_ombreira: lotesOmbreira,
  };
  try {
    await StoreSupabase.salvarProducao(payload);
    fecharEditar();
    App.toast('Lote de dormente atualizado.');
    await carregar();
  } catch (err) {
    console.error('Erro ao salvar lote de dormente', err);
    App.toast((err && err.message) ? err.message : 'Não foi possível salvar o lote.', 'erro');
  }
}
function fecharEditar() { RT_EDIT_ID = null; document.getElementById('modalEditar').classList.remove('aberto'); }

window.carregar = carregar;
window.abrirVer = abrirVer;
window.fecharVer = fecharVer;
window.abrirEditar = abrirEditar;
window.salvarEditar = salvarEditar;
window.fecharEditar = fecharEditar;
window.adicionarLoteOmbreiraEdit = adicionarLoteOmbreiraEdit;
window.removerLoteOmbreiraEdit = removerLoteOmbreiraEdit;
