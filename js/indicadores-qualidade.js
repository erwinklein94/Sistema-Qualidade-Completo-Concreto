/* =====================================================================
   INDICADORES-QUALIDADE.JS — Indicadores compartilhados
   1) Capabilidade do processo (Cp / Cpk) sobre as resistências do
      concreto, usando os corpos de prova individuais (CP 1 / CP 2).
   2) Ranking de moldes e cavidades com mais reprovas, por projeto e
      por tipo de problema (motivo indicador).
   Usado em: producao.html, reprovados.html e index.html (Dashboard).
   Não grava nada no Supabase — apenas calcula sobre os dados lidos.
   ===================================================================== */

(function () {
  'use strict';

  /* ---------------- Capabilidade (Cpk) ---------------- */

  // Indicador focado nos ensaios com limite normativo (EM-SPE-035 rev.10):
  // compressao axial 28 dias (fck >= 65 MPa) e tracao na flexao 28 dias
  // (>= 7,5 MPa). Como a norma define apenas limite inferior (LIE), o
  // indice exibido e o Cpk pelo lado inferior: (media - LIE) / (3*sigma).
  const ENSAIOS_CAPABILIDADE = [
    { chave: 'comp28', rotulo: 'Compressão axial — 28 dias', unidade: 'MPa', lie: 65 },
    { chave: 'tracao28', rotulo: 'Tração na flexão — 28 dias', unidade: 'MPa', lie: 7.5 },
  ];

  const META_CPK = 1.33;              // meta ideal / referência de excelência do processo
  const META_CPK_BOA = 1.00;         // alvo operacional bom: processo sob controle razoável
  const META_CPK_ATENCAO = 0.67;     // atenção: risco relevante, reduzir variação
  const META_CPK_BAIXA = 0.50;       // capabilidade baixa: investigar causas principais

  const ROTULO_META_CPK = `ideal ≥ ${fmt(META_CPK)}`;

  function numeroDe(v) {
    const s = String(v == null ? '' : v).trim();
    if (!s) return null;
    const m = s.replace(',', '.').match(/-?\d+(?:\.\d+)?/);
    if (!m) return null;
    const n = Number(m[0]);
    return Number.isFinite(n) ? n : null;
  }

  // Divide um valor antigo "a / b" em CP 1 e CP 2 (rede de segurança
  // quando a migração SQL ainda não rodou). Mesmo critério da Produção.
  function separarCps(v1, v2) {
    let cp1 = String(v1 == null ? '' : v1).trim();
    let cp2 = String(v2 == null ? '' : v2).trim();
    if (!cp2 && cp1.includes('/')) {
      const i = cp1.indexOf('/');
      cp2 = cp1.slice(i + 1).trim();
      cp1 = cp1.slice(0, i).trim();
    }
    return [cp1, cp2];
  }

  // Coleta todos os corpos de prova numéricos de um ensaio nos registros
  // (formato da Produção/Dashboard: comp28Cp1, comp28Cp2, ...), passando
  // pela divisão de segurança para cobrir valores antigos "a / b".
  function valoresEnsaio(registros, chave) {
    const valores = [];
    (registros || []).forEach(r => {
      separarCps(r[`${chave}Cp1`], r[`${chave}Cp2`]).forEach(v => {
        const n = numeroDe(v);
        if (n != null) valores.push(n);
      });
    });
    return valores;
  }

  function estatisticaCapabilidade(valores, lie) {
    const n = valores.length;
    if (!n) return { n: 0, lie };
    const media = valores.reduce((s, v) => s + v, 0) / n;
    const desvio = n > 1
      ? Math.sqrt(valores.reduce((s, v) => s + (v - media) ** 2, 0) / (n - 1))
      : 0;
    const min = Math.min(...valores);
    const max = Math.max(...valores);
    const cpk = desvio > 0 && lie != null ? (media - lie) / (3 * desvio) : null;
    const abaixoLie = lie != null ? valores.filter(v => v < lie).length : 0;
    return { n, media, desvio, min, max, cpk, lie, abaixoLie, valores };
  }

  function calcularCapabilidade(registros) {
    return ENSAIOS_CAPABILIDADE.map(e => ({
      ...e,
      ...estatisticaCapabilidade(valoresEnsaio(registros, e.chave), e.lie),
    }));
  }

  // CDF da normal padrão (aproximação de Abramowitz & Stegun, erro < 1e-7).
  function phiNormal(z) {
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989422804 * Math.exp(-z * z / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return z > 0 ? 1 - p : p;
  }

  function statusCpk(i) {
    if (!i.n || i.n < 2 || !(i.desvio > 0) || i.cpk == null) return { classe: 'neutro', rotulo: 'Dados insuficientes' };
    if (i.cpk >= META_CPK) return { classe: 'ok', rotulo: 'Ideal do processo' };
    if (i.cpk >= META_CPK_BOA) return { classe: 'bom', rotulo: 'Bom controle — evoluir' };
    if (i.cpk >= META_CPK_ATENCAO) return { classe: 'aviso', rotulo: 'Atenção — reduzir variação' };
    if (i.cpk >= META_CPK_BAIXA) return { classe: 'baixo', rotulo: 'Baixa capabilidade — investigar' };
    return { classe: 'critico', rotulo: 'Crítico — agir na variação' };
  }

  function classeCpk(cpk) {
    if (cpk == null || !Number.isFinite(cpk)) return 'neutro';
    if (cpk >= META_CPK) return 'ok';
    if (cpk >= META_CPK_BOA) return 'bom';
    if (cpk >= META_CPK_ATENCAO) return 'aviso';
    if (cpk >= META_CPK_BAIXA) return 'baixo';
    return 'critico';
  }

  function fmt(v, casas = 2) {
    return v == null || !Number.isFinite(v) ? '—' : v.toFixed(casas).replace('.', ',');
  }

  function fmtPctNc(cpk) {
    if (cpk == null) return '—';
    const pct = phiNormal(-3 * cpk) * 100;
    if (pct < 0.01) return '<0,01%';
    return `${pct < 1 ? pct.toFixed(2) : pct.toFixed(1)}%`.replace('.', ',');
  }

  // Gauge horizontal de 0 a 2,0 com zonas progressivas.
  // O 1,33 continua como ideal de processo, mas a leitura não trata todo
  // valor abaixo dele como reprovação automática.
  function htmlGaugeCpk(cpk) {
    const escala = v => Math.max(0, Math.min(100, (v / 2) * 100));
    const ponteiro = cpk == null ? '' : `<span class="cap-gauge-ponteiro" style="left:${escala(cpk).toFixed(1)}%" title="Cpk ${fmt(cpk)}"></span>`;
    return `<div class="cap-gauge">
      <div class="cap-gauge-trilho">
        <span class="cap-zona critico" style="width:25%" title="Crítico: Cpk < ${fmt(META_CPK_BAIXA)}"></span><span class="cap-zona baixo" style="width:8.5%" title="Baixa capabilidade: ${fmt(META_CPK_BAIXA)} a ${fmt(META_CPK_ATENCAO)}"></span><span class="cap-zona aviso" style="width:16.5%" title="Atenção: ${fmt(META_CPK_ATENCAO)} a ${fmt(META_CPK_BOA)}"></span><span class="cap-zona bom" style="width:16.5%" title="Bom controle: ${fmt(META_CPK_BOA)} a ${fmt(META_CPK)}"></span><span class="cap-zona ok" style="width:33.5%" title="Ideal: Cpk ≥ ${fmt(META_CPK)}"></span>
        <span class="cap-gauge-meta" style="left:${escala(META_CPK).toFixed(1)}%" title="Meta ideal ${fmt(META_CPK)}"></span>
        ${ponteiro}
      </div>
      <div class="cap-gauge-escala"><span>0</span><span style="left:25%">0,50</span><span style="left:33.5%">0,67</span><span style="left:50%">1,00</span><span style="left:66.5%">1,33 ideal</span><span class="fim">2,0</span></div>
    </div>`;
  }

  // Histograma compacto dos CPs com a linha vermelha do LIE.
  function htmlHistogramaCps(i) {
    if (!i.valores || i.n < 3) return '';
    const x0 = Math.min(i.min, i.lie);
    const x1 = Math.max(i.max, i.lie);
    const pad = (x1 - x0) * 0.06 || 0.5;
    const a = x0 - pad, b = x1 + pad;
    const bins = Math.max(5, Math.min(12, Math.ceil(Math.sqrt(i.n)) + 2));
    const passo = (b - a) / bins;
    const contagens = new Array(bins).fill(0);
    i.valores.forEach(v => {
      const idx = Math.min(bins - 1, Math.floor((v - a) / passo));
      contagens[idx]++;
    });
    const maxC = Math.max(...contagens, 1);
    const barras = contagens.map((c, idx) => {
      const ini = a + idx * passo;
      const fim = ini + passo;
      const abaixo = fim <= i.lie;
      const h = c ? Math.max(8, (c / maxC) * 100) : 2;
      return `<span class="cap-histo-barra ${abaixo ? 'abaixo' : ''}" style="height:${h.toFixed(0)}%" title="${fmt(ini, 1)} a ${fmt(fim, 1)} ${i.unidade}: ${c} CP${c === 1 ? '' : 's'}"></span>`;
    }).join('');
    const posLie = ((i.lie - a) / (b - a)) * 100;
    return `<div class="cap-histo">
      <div class="cap-histo-area">${barras}<span class="cap-histo-lie" style="left:${posLie.toFixed(1)}%" title="LIE ${fmt(i.lie)} ${i.unidade}"></span></div>
      <div class="cap-histo-legenda">Distribuição dos ${i.n} CPs · linha vermelha = LIE ${fmt(i.lie)} ${i.unidade}</div>
    </div>`;
  }

  function htmlCardCapabilidade(i, ctx = {}) {
    const st = statusCpk(i);
    let alertaTopo = '';
    let blocoHistorico = '';
    if (ctx.historico && ctx.historico.length) {
      const serie = serieMensalCpk(ctx.historico, i.chave, i.lie);
      const tend = tendenciaCpk(ctx.historico, i.chave, i.lie);
      if (alertaQueda(serie, tend)) alertaTopo = '<span class="cap-alerta">↘ tendência de queda</span>';
      const spark = htmlSparklineCpk(serie);
      if (spark) {
        blocoHistorico = `<div class="cap-evolucao">${spark}
          <span class="cap-evolucao-txt">Evolução mensal — ${ctx.rotuloHistorico || 'histórico completo'} (independente dos filtros) · Δ90d ${fmtDelta(tend.delta)} ${tend.seta || ''}</span>
        </div>`;
      }
    }
    if (!i.n) {
      return `<article class="cap-card neutro">
        <div class="cap-cabecalho"><div class="cap-rotulo">${i.rotulo}</div><span class="cap-status neutro">Sem dados</span></div>
        <div class="cap-vazio">Nenhum corpo de prova de ${i.rotulo.toLowerCase()} no recorte atual. Lance os resultados (CP 1 e CP 2) na Produção.</div>
        <div class="cap-limites">LIE ${fmt(i.lie)} ${i.unidade} — EM-SPE-035 rev.10 · referência ideal Cpk ≥ ${fmt(META_CPK)}</div>
      </article>`;
    }
    const margem = i.media - i.lie;
    const obs = [];
    if (st.classe === 'neutro') obs.push('mínimo de 2 CPs com variação para calcular Cpk');
    if (i.n < 30 && st.classe !== 'neutro') obs.push('amostra pequena (n < 30) — Cpk indicativo');
    return `<article class="cap-card ${st.classe}">
      <div class="cap-cabecalho">
        <div class="cap-rotulo">${i.rotulo}</div>
        <div class="cap-cabecalho-dir">${alertaTopo}<span class="cap-status ${st.classe}">${st.rotulo}</span></div>
      </div>
      <div class="cap-cpk">
        <span class="cap-tag">Cpk</span>
        <span class="cap-valor">${fmt(i.cpk)}</span>
        <span class="cap-meta-alvo">${ROTULO_META_CPK}</span>
      </div>
      ${htmlGaugeCpk(i.cpk)}
      ${blocoHistorico}
      ${htmlHistogramaCps(i)}
      <div class="cap-stats">
        <div><span>CPs ensaiados</span><strong>${i.n}</strong></div>
        <div><span>Média</span><strong>${fmt(i.media)} ${i.unidade}</strong></div>
        <div><span>Desvio (σ)</span><strong>${fmt(i.desvio, 3)}</strong></div>
        <div><span>Mín / Máx</span><strong>${fmt(i.min)} / ${fmt(i.max)}</strong></div>
        <div><span>Margem sobre o LIE</span><strong>${margem >= 0 ? '+' : ''}${fmt(margem)} ${i.unidade}</strong></div>
        <div><span>Abaixo do LIE</span><strong>${i.abaixoLie} CP · est. ${fmtPctNc(i.cpk)}</strong></div>
      </div>
      <div class="cap-limites">LIE ${fmt(i.lie)} ${i.unidade} — EM-SPE-035 rev.10 · σ amostral${obs.length ? ' · ' + obs.join(' · ') : ''}</div>
    </article>`;
  }

  function htmlPainelCapabilidade(registros, opcoes = {}) {
    const itens = calcularCapabilidade(registros);
    const sub = opcoes.subtitulo || 'Cpk calculado sobre os corpos de prova individuais (CP 1 e CP 2) dos ensaios de 28 dias no recorte atual · limites da EM-SPE-035 rev.10 · referência ideal Cpk ≥ 1,33 · leitura progressiva: 0,50 / 0,67 / 1,00 / 1,33';
    const ctx = { historico: opcoes.historico || null, rotuloHistorico: opcoes.rotuloHistorico || '' };
    const ranking = opcoes.rankingProjetos ? htmlRankingProjetosCpk(opcoes.rankingProjetos) : '';
    return `<div class="card">
      <div class="card-titulo"><span class="acento">${opcoes.titulo || 'Capabilidade do processo — Cpk (28 dias)'}</span>
        <span class="card-sub">${sub}</span></div>
      <div class="capabilidade-grid">${itens.map(i => htmlCardCapabilidade(i, ctx)).join('')}</div>
      ${ranking}
    </div>`;
  }

  /* ---------------- Histórico, tendência e saúde dos projetos ---------------- */

  // Mínimo de corpos de prova para um Cpk confiável (mês ou janela de 90d).
  // Abaixo disso o ponto é tratado como indicativo e não entra na tendência.
  const MIN_N_CPK = 8;
  const NOMES_MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  function mesDe(r) {
    const m = String(r && r.dataFabricacao || '').slice(0, 7);
    return /^\d{4}-\d{2}$/.test(m) ? m : null;
  }

  function rotuloMes(m) {
    const [ano, mes] = m.split('-');
    return `${NOMES_MES[Number(mes) - 1] || mes}/${ano.slice(2)}`;
  }

  function isoHoje() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function isoMenosDias(iso, dias) {
    const d = new Date(`${iso}T12:00:00`);
    d.setDate(d.getDate() - dias);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function valoresCpDoRegistro(r, chave) {
    const out = [];
    separarCps(r[`${chave}Cp1`], r[`${chave}Cp2`]).forEach(v => {
      const n = numeroDe(v);
      if (n != null) out.push(n);
    });
    return out;
  }

  // Série mensal de Cpk de um ensaio (meses com pelo menos 1 CP).
  // valido = mês com n >= MIN_N_CPK e desvio > 0.
  function serieMensalCpk(registros, chave, lie) {
    const porMes = new Map();
    (registros || []).forEach(r => {
      const m = mesDe(r);
      if (!m) return;
      const arr = porMes.get(m) || [];
      arr.push(...valoresCpDoRegistro(r, chave));
      porMes.set(m, arr);
    });
    return Array.from(porMes.entries())
      .filter(([, vals]) => vals.length > 0)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([mes, vals]) => {
        const e = estatisticaCapabilidade(vals, lie);
        return { mes, rotulo: rotuloMes(mes), n: vals.length, cpk: e.cpk, valido: vals.length >= MIN_N_CPK && e.cpk != null };
      });
  }

  function cpkJanela(registros, chave, lie, iniISO, fimISO) {
    const vals = [];
    (registros || []).forEach(r => {
      const d = String(r.dataFabricacao || '').slice(0, 10);
      if (!d) return;
      if (iniISO && d < iniISO) return;
      if (fimISO && d > fimISO) return;
      vals.push(...valoresCpDoRegistro(r, chave));
    });
    const e = estatisticaCapabilidade(vals, lie);
    return { ...e, valido: vals.length >= MIN_N_CPK && e.cpk != null };
  }

  // Tendência por janela móvel: últimos 90 dias × 90 dias anteriores.
  // Seta com zona morta de ±0,10 para não transformar ruído em tendência.
  function tendenciaCpk(registros, chave, lie, hojeISO) {
    const hoje = hojeISO || isoHoje();
    const d90 = isoMenosDias(hoje, 90);
    const d180 = isoMenosDias(hoje, 180);
    const atual = cpkJanela(registros, chave, lie, d90, hoje);
    const anterior = cpkJanela(registros, chave, lie, d180, isoMenosDias(d90, 1));
    const delta = atual.valido && anterior.valido ? atual.cpk - anterior.cpk : null;
    const seta = delta == null ? '' : delta >= 0.10 ? '↗' : delta <= -0.10 ? '↘' : '→';
    return { atual, anterior, delta, seta };
  }

  // Queda consecutiva: os últimos k meses válidos caindo um após o outro.
  function quedaConsecutiva(serie, k = 3) {
    const v = (serie || []).filter(p => p.valido).slice(-(k + 1));
    if (v.length < k + 1) return false;
    return v.every((p, i) => i === 0 || p.cpk < v[i - 1].cpk - 1e-9);
  }

  function alertaQueda(serie, tend) {
    return quedaConsecutiva(serie) || (tend && tend.delta != null && tend.delta <= -0.3);
  }

  // Cpk "atual" de um ensaio: janela de 90 dias; se a janela não tiver
  // amostra suficiente, usa o histórico completo (base = 'geral').
  function cpkAtualEnsaio(registros, chave, lie, hojeISO) {
    const tend = tendenciaCpk(registros, chave, lie, hojeISO);
    if (tend.atual.valido) return { cpk: tend.atual.cpk, n: tend.atual.n, base: '90d', tend };
    const geral = estatisticaCapabilidade(
      (registros || []).flatMap(r => valoresCpDoRegistro(r, chave)), lie);
    if (geral.n >= MIN_N_CPK && geral.cpk != null) return { cpk: geral.cpk, n: geral.n, base: 'geral', tend };
    return { cpk: null, n: geral.n || 0, base: null, tend };
  }

  // Resumo por projeto, sempre sobre o conjunto completo recebido
  // (independente de filtros de tela).
  function saudeProjetos(registros, hojeISO) {
    const porProjeto = new Map();
    (registros || []).forEach(r => {
      const projeto = String(r.projeto || '').trim();
      if (!projeto) return;
      const arr = porProjeto.get(projeto) || [];
      arr.push(r);
      porProjeto.set(projeto, arr);
    });

    const projetos = Array.from(porProjeto.entries()).map(([projeto, regs]) => {
      const ensaios = ENSAIOS_CAPABILIDADE.map(e => {
        const serie = serieMensalCpk(regs, e.chave, e.lie);
        const atual = cpkAtualEnsaio(regs, e.chave, e.lie, hojeISO);
        return { ...e, serie, ...atual, alerta: alertaQueda(serie, atual.tend) };
      });
      const valores = ensaios.filter(e => e.cpk != null).map(e => e.cpk);
      const cpkMin = valores.length ? Math.min(...valores) : null;
      const deltas = ensaios.filter(e => e.tend.delta != null).map(e => e.tend.delta);
      const piorDelta = deltas.length ? Math.min(...deltas) : null;
      return { projeto, ensaios, cpkMin, piorDelta, alerta: ensaios.some(e => e.alerta) };
    }).sort((a, b) => a.projeto.localeCompare(b.projeto, 'pt-BR'));

    const comCpk = projetos.filter(p => p.cpkMin != null);
    const comDelta = projetos.filter(p => p.piorDelta != null);
    return {
      projetos,
      melhor: comCpk.length ? comCpk.reduce((a, b) => (b.cpkMin > a.cpkMin ? b : a)) : null,
      atencao: comCpk.length ? comCpk.reduce((a, b) => (b.cpkMin < a.cpkMin ? b : a)) : null,
      piorTendencia: comDelta.length ? comDelta.reduce((a, b) => (b.piorDelta < a.piorDelta ? b : a)) : null,
    };
  }

  // Séries para o gráfico de evolução de um projeto (Dashboard).
  function seriesEvolucaoProjeto(registros, projeto) {
    const regs = (registros || []).filter(r => String(r.projeto || '').trim() === String(projeto || '').trim());
    const series = ENSAIOS_CAPABILIDADE.map(e => ({ ...e, serie: serieMensalCpk(regs, e.chave, e.lie) }));
    const meses = Array.from(new Set(series.flatMap(s => s.serie.map(p => p.mes)))).sort();
    const por = s => {
      const mapa = new Map(s.serie.map(p => [p.mes, p]));
      return {
        cpk: meses.map(m => { const p = mapa.get(m); return p && p.valido ? Number(p.cpk.toFixed(3)) : null; }),
        n: meses.map(m => { const p = mapa.get(m); return p ? p.n : 0; }),
      };
    };
    return {
      meses,
      rotulos: meses.map(rotuloMes),
      comp: por(series[0]),
      tracao: por(series[1]),
      nTotal: meses.map((m, i) => (por(series[0]).n[i] || 0)),
      minN: MIN_N_CPK,
    };
  }

  // Sparkline SVG (sem dependências) da série mensal, com a referência ideal 1,33.
  function htmlSparklineCpk(serie) {
    const pts = (serie || []).slice(-12);
    if (pts.filter(p => p.valido).length < 2) return '';
    const w = 150, h = 36, padX = 4, padY = 5;
    const x = i => padX + (i * (w - 2 * padX)) / Math.max(1, pts.length - 1);
    const y = v => h - padY - (Math.max(0, Math.min(2, v)) / 2) * (h - 2 * padY);
    const segmentos = [];
    let atual = [];
    pts.forEach((p, i) => {
      if (p.valido) atual.push(`${x(i).toFixed(1)},${y(p.cpk).toFixed(1)}`);
      else { if (atual.length > 1) segmentos.push(atual); atual = []; }
    });
    if (atual.length > 1) segmentos.push(atual);
    const linhas = segmentos.map(seg => `<polyline points="${seg.join(' ')}" fill="none" stroke="currentColor" stroke-width="1.6"/>`).join('');
    const pontos = pts.map((p, i) => p.valido
      ? `<circle cx="${x(i).toFixed(1)}" cy="${y(p.cpk).toFixed(1)}" r="2" fill="currentColor"><title>${p.rotulo}: Cpk ${fmt(p.cpk)} (n=${p.n})</title></circle>`
      : `<circle cx="${x(i).toFixed(1)}" cy="${(h - padY).toFixed(1)}" r="1.6" fill="none" stroke="currentColor" stroke-width="1" opacity="0.45"><title>${p.rotulo}: n=${p.n} (insuficiente p/ Cpk)</title></circle>`).join('');
    const ultimo = [...pts].reverse().find(p => p.valido);
    const cls = ultimo ? classeCpk(ultimo.cpk) : 'neutro';
    return `<span class="cap-spark ${cls}"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
      <line x1="${padX}" x2="${w - padX}" y1="${y(1.33).toFixed(1)}" y2="${y(1.33).toFixed(1)}" stroke="currentColor" stroke-width="1" stroke-dasharray="3,3" opacity="0.45"/>
      ${linhas}${pontos}
    </svg></span>`;
  }

  function fmtDelta(d) {
    if (d == null) return '—';
    return `${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(2).replace('.', ',')}`;
  }

  function badgeProjetoSeguro(projeto) {
    return (typeof U !== 'undefined' && U.badgeProjeto) ? U.badgeProjeto(projeto) : `<strong>${esc(projeto)}</strong>`;
  }

  // Painel "Saúde Estatística dos Projetos" (Dashboard).
  function htmlPainelSaudeProjetos(registros, opcoes = {}) {
    const r = saudeProjetos(registros, opcoes.hojeISO);
    const sub = opcoes.subtitulo || `Cpk 28 dias por projeto sobre o histórico completo — independente dos filtros acima · janela atual: últimos 90 dias (mínimo ${MIN_N_CPK} CPs) · referência ideal Cpk ≥ 1,33 · leitura progressiva por faixas`;

    const linhaResumo = (icone, titulo, p, texto) => p
      ? `<div class="saude-resumo-item"><span class="saude-resumo-icone">${icone}</span><span class="saude-resumo-titulo">${titulo}:</span> ${badgeProjetoSeguro(p.projeto)} <span class="saude-resumo-extra">${texto}</span></div>`
      : '';
    const resumo = (r.melhor || r.atencao || r.piorTendencia)
      ? `<div class="saude-resumo">
          ${linhaResumo('🟢', 'Melhor projeto', r.melhor, r.melhor ? `Cpk ${fmt(r.melhor.cpkMin)}` : '')}
          ${linhaResumo('🟡', 'Projeto em atenção', r.atencao, r.atencao ? `Cpk ${fmt(r.atencao.cpkMin)}` : '')}
          ${linhaResumo('🔴', 'Pior tendência', r.piorTendencia, r.piorTendencia ? `${fmtDelta(r.piorTendencia.piorDelta)} em 90 dias` : '')}
        </div>`
      : '';

    const cards = r.projetos.length ? `<div class="saude-grid">${r.projetos.map(p => {
      const cls = p.cpkMin == null ? 'neutro' : classeCpk(p.cpkMin);
      const clicavel = opcoes.clicavel ? ` class="saude-card ${cls} clicavel" data-projeto="${esc(p.projeto)}" onclick="window.__cpkEvolucao&&window.__cpkEvolucao(decodeURIComponent('${encodeURIComponent(p.projeto)}'))" title="Clique para ver a evolução mensal"` : ` class="saude-card ${cls}"`;
      const linhas = p.ensaios.map(e => {
        const c = e.cpk == null ? 'neutro' : classeCpk(e.cpk);
        const baseTxt = e.cpk == null ? `n=${e.n} (insuf.)` : e.base === 'geral' ? `base: histórico (n=${e.n})` : `n=${e.n} em 90d`;
        return `<div class="saude-linha">
          <span class="saude-ensaio">${e.rotulo.replace(' — 28 dias', ' 28d')}</span>
          <strong class="saude-cpk ${c}">${e.cpk == null ? '—' : fmt(e.cpk)}</strong>
          <em class="saude-seta">${e.tend.seta || ''}</em>
          <small class="saude-delta">Δ90d ${fmtDelta(e.tend.delta)}</small>
          ${htmlSparklineCpk(e.serie)}
          <small class="saude-base">${baseTxt}</small>
        </div>`;
      }).join('');
      const alerta = p.alerta ? `<span class="cap-alerta">↘ tendência de queda</span>` : '';
      return `<article${clicavel}>
        <div class="saude-card-topo">${badgeProjetoSeguro(p.projeto)}${alerta}</div>
        ${linhas}
      </article>`;
    }).join('')}</div>` : `<div class="vazio compacto">${typeof ICN !== 'undefined' ? ICN.vazioBox : ''}<h3>Sem dados de resistência</h3><p>Lance os corpos de prova de 28 dias na Produção para acompanhar a saúde estatística.</p></div>`;

    const areaEvolucao = opcoes.idEvolucao ? `<div id="${opcoes.idEvolucao}"></div>` : '';
    return `<div class="card">
      <div class="card-titulo"><span class="acento">${opcoes.titulo || 'Saúde Estatística dos Projetos — Cpk 28 dias'}</span>
        <span class="card-sub">${sub}</span></div>
      ${resumo}
      ${cards}
      ${areaEvolucao}
    </div>`;
  }

  // Ranking compacto por projeto (rodapé do painel da Produção sem filtro).
  function htmlRankingProjetosCpk(registros) {
    const r = saudeProjetos(registros);
    if (!r.projetos.length) return '';
    const linhas = r.projetos.map(p => {
      const cls = p.cpkMin == null ? 'neutro' : classeCpk(p.cpkMin);
      const cel = e => e.cpk == null ? '<td class="neutro">—</td>' : `<td class="${classeCpk(e.cpk)}"><strong>${fmt(e.cpk)}</strong> <em>${e.tend.seta || ''}</em> <small>${fmtDelta(e.tend.delta)}</small></td>`;
      return `<tr class="${cls}"><td>${badgeProjetoSeguro(p.projeto)}${p.alerta ? ' <span class="cap-alerta">↘</span>' : ''}</td>${cel(p.ensaios[0])}${cel(p.ensaios[1])}</tr>`;
    }).join('');
    return `<div class="cap-ranking">
      <div class="cap-ranking-titulo">Cpk por projeto — histórico completo (independente dos filtros) · Δ em 90 dias · ideal 1,33</div>
      <div class="tabela-wrap"><table class="tabela cap-ranking-tabela">
        <thead><tr><th>Projeto</th><th>Cpk Compressão 28d</th><th>Cpk Tração 28d</th></tr></thead>
        <tbody>${linhas}</tbody>
      </table></div>
    </div>`;
  }

  /* ---------------- Moldes e cavidades com mais reprovas ---------------- */

  // registros: { projeto, molde, cavidade, motivoIndicador, totalRefugos }
  function agruparMoldesCavidades(registros) {
    const projetos = new Map();
    (registros || []).forEach(r => {
      const refugos = Math.max(1, parseInt(String(r.totalRefugos || '').replace(/\D/g, ''), 10) || 1);
      const projeto = String(r.projeto || '').trim() || 'Projeto não informado';
      const molde = String(r.molde || '').trim() || 'Não informado';
      const cavidade = String(r.cavidade || '').trim() || 'Não informada';
      const motivo = String(r.motivoIndicador || '').trim() || 'Sem motivo informado';

      const proj = projetos.get(projeto) || { projeto, total: 0, itens: new Map(), motivos: new Map() };
      proj.total += refugos;
      proj.motivos.set(motivo, (proj.motivos.get(motivo) || 0) + refugos);

      const chave = `${molde}|${cavidade}`;
      const item = proj.itens.get(chave) || { molde, cavidade, total: 0, motivos: new Map() };
      item.total += refugos;
      item.motivos.set(motivo, (item.motivos.get(motivo) || 0) + refugos);
      proj.itens.set(chave, item);
      projetos.set(projeto, proj);
    });

    return Array.from(projetos.values())
      .map(p => ({
        projeto: p.projeto,
        total: p.total,
        motivos: Array.from(p.motivos.entries()).map(([nome, qtd]) => ({ nome, qtd })).sort((a, b) => b.qtd - a.qtd),
        itens: Array.from(p.itens.values())
          .map(i => ({
            molde: i.molde,
            cavidade: i.cavidade,
            total: i.total,
            motivos: Array.from(i.motivos.entries()).map(([nome, qtd]) => ({ nome, qtd })).sort((a, b) => b.qtd - a.qtd),
          }))
          .sort((a, b) => b.total - a.total || a.molde.localeCompare(b.molde, 'pt-BR')),
      }))
      .sort((a, b) => b.total - a.total || a.projeto.localeCompare(b.projeto, 'pt-BR'));
  }

  function esc(s) {
    return typeof U !== 'undefined' && U.esc ? U.esc(s) : String(s == null ? '' : s);
  }

  function htmlPainelMoldesCavidades(registros, opcoes = {}) {
    const grupos = agruparMoldesCavidades(registros);
    const limite = opcoes.limitePorProjeto || 6;
    const sub = opcoes.subtitulo || 'Moldes e cavidades com mais refugos no recorte atual, por projeto e por tipo de problema. O pior de cada projeto fica destacado.';
    const corpo = !grupos.length
      ? `<div class="vazio compacto">${typeof ICN !== 'undefined' ? ICN.check : ''}<h3>Nenhuma reprova no recorte</h3><p>Sem registros de molde/cavidade para o período e filtros atuais.</p></div>`
      : grupos.map(g => {
          const linhas = g.itens.slice(0, limite).map((i, idx) => `
            <article class="molde-card ${idx === 0 ? 'principal' : ''}">
              <div class="molde-card-topo">
                <strong>Molde ${esc(i.molde)} · Cav. ${esc(i.cavidade)}</strong>
                <span class="molde-card-total">${i.total.toLocaleString('pt-BR')} refugo${i.total === 1 ? '' : 's'}</span>
              </div>
              <div class="molde-card-motivos">${i.motivos.map(m =>
                `<span class="badge badge-reprovado mini" title="${esc(m.nome)}">${esc(m.nome)} ×${m.qtd.toLocaleString('pt-BR')}</span>`).join(' ')}</div>
            </article>`).join('');
          const resumoMotivos = g.motivos.slice(0, 4).map(m => `${esc(m.nome)} (${m.qtd.toLocaleString('pt-BR')})`).join(' · ');
          const extras = g.itens.length > limite ? `<div class="molde-extras">+ ${g.itens.length - limite} molde(s)/cavidade(s) com menos ocorrências</div>` : '';
          return `<section class="molde-projeto">
            <div class="molde-projeto-titulo">
              ${typeof U !== 'undefined' && U.badgeProjeto ? U.badgeProjeto(g.projeto) : `<strong>${esc(g.projeto)}</strong>`}
              <span class="molde-projeto-meta">${g.total.toLocaleString('pt-BR')} refugos · principais problemas: ${resumoMotivos || '—'}</span>
            </div>
            <div class="moldes-grid">${linhas}</div>
            ${extras}
          </section>`;
        }).join('');
    return `<div class="card">
      <div class="card-titulo"><span class="acento">${opcoes.titulo || 'Moldes e cavidades com mais problemas'}</span>
        <span class="card-sub">${sub}</span></div>
      ${corpo}
    </div>`;
  }

  window.IndicadoresQualidade = {
    MIN_N_CPK,
    META_CPK,
    META_CPK_BOA,
    META_CPK_ATENCAO,
    META_CPK_BAIXA,
    separarCps,
    calcularCapabilidade,
    htmlPainelCapabilidade,
    serieMensalCpk,
    tendenciaCpk,
    saudeProjetos,
    seriesEvolucaoProjeto,
    htmlPainelSaudeProjetos,
    agruparMoldesCavidades,
    htmlPainelMoldesCavidades,
  };
})();
