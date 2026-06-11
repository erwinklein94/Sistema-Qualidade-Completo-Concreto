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

  /* ---------------- Capabilidade (Cp / Cpk) ---------------- */

  // Limites de especificação (LIE = limite inferior; LSE = superior).
  // 28 dias conforme EM-SPE-035 rev.10: fck ≥ 65 MPa e tração ≥ 7,5 MPa.
  // 7 e 14 dias não possuem limite normativo — mostramos só a estatística.
  const ENSAIOS_CAPABILIDADE = [
    { chave: 'comp7', rotulo: 'Compressão axial — 7 dias', unidade: 'MPa', lie: null, lse: null },
    { chave: 'comp14', rotulo: 'Compressão axial — 14 dias', unidade: 'MPa', lie: null, lse: null },
    { chave: 'tracao14', rotulo: 'Tração na flexão — 14 dias', unidade: 'MPa', lie: null, lse: null },
    { chave: 'comp28', rotulo: 'Compressão axial — 28 dias', unidade: 'MPa', lie: 65, lse: null },
    { chave: 'tracao28', rotulo: 'Tração na flexão — 28 dias', unidade: 'MPa', lie: 7.5, lse: null },
  ];

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
  // (registros no formato da Produção/Dashboard: comp7Cp1, comp7Cp2, ...).
  // Passa pela divisão de segurança para cobrir valores antigos "a / b".
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

  function estatisticaCapabilidade(valores, lie, lse) {
    const n = valores.length;
    if (!n) return { n: 0, lie, lse };
    const media = valores.reduce((s, v) => s + v, 0) / n;
    const desvio = n > 1
      ? Math.sqrt(valores.reduce((s, v) => s + (v - media) ** 2, 0) / (n - 1))
      : 0;
    const min = Math.min(...valores);
    const max = Math.max(...valores);
    let cp = null, cpk = null;
    if (desvio > 0) {
      if (lie != null && lse != null) cp = (lse - lie) / (6 * desvio);
      const lados = [];
      if (lie != null) lados.push((media - lie) / (3 * desvio));
      if (lse != null) lados.push((lse - media) / (3 * desvio));
      if (lados.length) cpk = Math.min(...lados);
    }
    const abaixoLie = lie != null ? valores.filter(v => v < lie).length : 0;
    return { n, media, desvio, min, max, cp, cpk, lie, lse, abaixoLie };
  }

  function calcularCapabilidade(registros) {
    return ENSAIOS_CAPABILIDADE.map(e => ({
      ...e,
      ...estatisticaCapabilidade(valoresEnsaio(registros, e.chave), e.lie, e.lse),
    }));
  }

  function classeCpk(cpk) {
    if (cpk == null) return 'neutro';
    if (cpk >= 1.33) return 'ok';
    if (cpk >= 1.0) return 'aviso';
    return 'critico';
  }

  function fmt(v, casas = 2) {
    return v == null || !Number.isFinite(v) ? '—' : v.toFixed(casas).replace('.', ',');
  }

  function htmlPainelCapabilidade(registros, opcoes = {}) {
    const itens = calcularCapabilidade(registros);
    const comDados = itens.some(i => i.n > 0);
    const sub = opcoes.subtitulo || 'Cp/Cpk calculados sobre os corpos de prova individuais (CP 1 e CP 2) do recorte atual · limites da EM-SPE-035 rev.10 · meta Cpk ≥ 1,33';
    const corpo = !comDados
      ? `<div class="vazio compacto">${typeof ICN !== 'undefined' ? ICN.vazioBox : ''}<h3>Sem corpos de prova no recorte</h3><p>Lance os resultados de resistência (CP 1 e CP 2) na Produção para calcular a capabilidade.</p></div>`
      : `<div class="capabilidade-grid">${itens.map(i => {
          const cls = i.n ? classeCpk(i.cpk) : 'neutro';
          const semLimite = i.lie == null && i.lse == null;
          const rodape = semLimite
            ? 'Sem limite normativo — apenas estatística'
            : `LIE ${fmt(i.lie)} ${i.unidade}${i.lse != null ? ` · LSE ${fmt(i.lse)} ${i.unidade}` : ' · sem LSE (Cp exige os dois limites)'}${i.abaixoLie ? ` · <strong>${i.abaixoLie} CP abaixo do LIE</strong>` : ''}`;
          return `<article class="cap-card ${cls}">
            <div class="cap-rotulo">${i.rotulo}</div>
            <div class="cap-numeros">
              <div class="cap-principal"><span class="cap-tag">Cpk</span><span class="cap-valor">${i.n ? fmt(i.cpk) : '—'}</span></div>
              <div class="cap-secundario"><span class="cap-tag">Cp</span><span>${i.n ? fmt(i.cp) : '—'}</span></div>
            </div>
            <div class="cap-meta">n = ${i.n} CP · média ${fmt(i.media)} · σ ${fmt(i.desvio, 3)}${i.n ? ` · mín ${fmt(i.min)} / máx ${fmt(i.max)}` : ''}</div>
            <div class="cap-limites">${rodape}</div>
          </article>`;
        }).join('')}</div>`;
    return `<div class="card">
      <div class="card-titulo"><span class="acento">${opcoes.titulo || 'Capabilidade do processo — Cp / Cpk'}</span>
        <span class="card-sub">${sub}</span></div>
      ${corpo}
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
    separarCps,
    calcularCapabilidade,
    htmlPainelCapabilidade,
    agruparMoldesCavidades,
    htmlPainelMoldesCavidades,
  };
})();
