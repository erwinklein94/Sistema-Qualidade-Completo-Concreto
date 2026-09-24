/* Relatório A4 de lote. O modelo visual fica em css/relatorio-lote.css.
   Os textos são calculados para o lote aberto; dados ausentes nunca são
   preenchidos com conclusões do PDF usado como referência visual. */
const RelatorioLote = (() => {
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const cell = value => value == null || String(value).trim() === '' ? '<span class="muted">não informado</span>' : esc(value);
  const num = value => {
    if (value == null || String(value).trim() === '') return null;
    const n = Number(String(value).replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };
  const inteiro = value => num(value) == null ? null : Math.trunc(num(value));
  const formato = value => num(value) == null ? '—' : num(value).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  const data = value => {
    const iso = String(value || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
    return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
  };
  const hojeISO = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };
  const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const origem = value => {
    const n = norm(value);
    if (n.includes('cavan')) return 'cavan';
    if (n.includes('conprem')) return 'conprem';
    return n;
  };
  const mencionaLote = (texto, lote) => {
    const codigo = String(lote || '').trim();
    if (!codigo) return false;
    const literal = codigo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^0-9A-Za-z])${literal}(?=$|[^0-9A-Za-z])`, 'i').test(String(texto || ''));
  };
  const mesmoLote = (row, lote) => String(row.lote || row.lote_ensaiado || '').trim() === String(lote.lote || '').trim();
  const mesmaOrigem = (row, lote) => !row.fornecedor || !lote.fornecedor || origem(row.fornecedor) === origem(lote.fornecedor);
  const relacionado = (row, lote) => row.producao_lote_id
    ? String(row.producao_lote_id) === String(lote.id)
    : mesmoLote(row, lote) && mesmaOrigem(row, lote);
  const tituloSecao = (n, title, novaPagina = false) => `<section class="section${novaPagina ? ' page-break' : ''}"><h2><b>${n}</b>${esc(title)}</h2>`;
  const pares = itens => `<table class="kv"><tbody>${itens.map(([label, value]) => `<tr><td>${esc(label)}</td><td>${cell(value)}</td></tr>`).join('')}</tbody></table>`;
  const grade = (left, right) => `<div class="cols">${pares(left)}${pares(right)}</div>`;
  const tabela = (headers, rows, empty = 'Nenhum registro encontrado.') => rows.length
    ? `<table class="data"><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr${row.selected ? ' class="selected"' : ''}>${row.cells.map(v => `<td>${cell(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
    : `<p class="note">${esc(empty)}</p>`;
  const nota = text => `<p class="note">${esc(text)}</p>`;
  const vazioOuFalha = (result, empty) => result?.ok ? empty : 'Consulta indisponível no momento.';

  function prepararCavan(lote, contexto, extras) {
    const todas = contexto.producao || [];
    const ensaios = contexto.ensaios || [];
    const pedidos = contexto.pedidos || [];
    const rep = extras.reprovados.ok ? extras.reprovados.rows.filter(r => relacionado(r, lote)) : [];
    const pista = extras.pista.ok ? extras.pista.rows.filter(r => mesmoLote(r, lote) && mesmaOrigem(r, lote)) : [];
    const concretagem = extras.concretagem.ok ? extras.concretagem.rows.filter(r => mesmoLote(r, lote) && mesmaOrigem(r, lote)) : [];
    const serie = String(lote.serie || '').trim();
    const lotesSerie = serie ? todas.filter(r => String(r.serie || '').trim() === serie && mesmaOrigem(r, lote) && norm(r.projeto) === norm(lote.projeto)) : [];
    const numsSerie = new Set(lotesSerie.map(r => String(r.lote || '').trim()));
    const ensSerie = serie ? ensaios.filter(r => r.producaoLoteId
      ? lotesSerie.some(l => String(l.id) === String(r.producaoLoteId))
      : numsSerie.has(String(r.lote || '').trim()) && mesmaOrigem(r, lote)) : [];
    const pedido = pedidos.find(r => String(r.numeroPedido || r.numero_pedido || '') === String(lote.pedido || '') && mesmaOrigem(r, lote));
    const semana = todas.filter(r => r.periodoIni && r.periodoIni === lote.periodoIni && r.periodoFim === lote.periodoFim
      && mesmaOrigem(r, lote) && norm(r.projeto) === norm(lote.projeto) && String(r.pista || '') === String(lote.pista || ''));
    const refugos = rep.reduce((sum, r) => sum + (inteiro(r.total_refugos) ?? 1), 0);
    const idade = lote.dataFabricacao ? Math.max(0, Math.floor((Date.now() - new Date(`${lote.dataFabricacao}T12:00:00`).getTime()) / 86400000)) : null;
    return { lote, todas, ensaios, pedidos, rep, pista, concretagem, serie, lotesSerie, ensSerie, pedido, semana, refugos, idade, extras };
  }

  function alertasCavan(d) {
    const l = d.lote;
    const result = [];
    const add = (title, body) => result.push(`<li><strong>${esc(title)}</strong> ${esc(body)}</li>`);
    const total = inteiro(l.total);
    const aprovados = inteiro(l.aprovado);
    const lancados = inteiro(l.reprovados);
    if (d.extras.reprovados.ok && lancados != null && d.refugos !== lancados) add('Contadores divergentes.', `A ficha de produção registra ${lancados} reprovado(s), enquanto Reprovados soma ${d.refugos} para o lote.`);
    if (d.extras.pista.ok) {
      for (const row of d.pista) {
        const qtd = inteiro(row.quantidade_produzida);
        if (qtd != null && total != null && qtd !== total) add('Quantidade produzida diverge.', `Produção registra ${total}; a inspeção de pista registra ${qtd}.`);
      }
    }
    if (d.serie && d.ensSerie.length === 0 && l.cura14 && String(l.cura14) < hojeISO()) add('Série sem ensaio registrado.', `A cura de 14 dias venceu em ${data(l.cura14)} e nenhum ensaio da série ${d.serie} foi encontrado nos registros carregados.`);
    if (total != null && aprovados != null && aprovados > total) add('Total aprovado acima da produção.', `A ficha registra ${aprovados} aprovados para ${total} produzidos.`);
    if (!l.tempIni && !l.tempMeio && !l.tempFim) add('Temperaturas ausentes.', 'As leituras inicial, do meio e final não estão preenchidas na Produção.');
    if (!l.loteOmbreira) add('Rastreabilidade incompleta.', 'O lote de ombreiras não está preenchido na Produção.');
    if (!result.length) add('Sem divergência automática identificada.', 'Confira os registros e relatórios vinculados antes de liberar o lote.');
    return `<ol class="attention">${result.join('')}</ol>`;
  }

  function resistencias(l) {
    const itens = [
      ['Compressão axial, 7 dias', l.comp7Cp1, l.comp7Cp2],
      ['Compressão axial, 14 dias', l.comp14Cp1, l.comp14Cp2],
      ['Compressão axial, 28 dias', l.comp28Cp1, l.comp28Cp2],
      ['Tração na flexão, 14 dias', l.tracao14Cp1, l.tracao14Cp2],
      ['Tração na flexão, 28 dias', l.tracao28Cp1, l.tracao28Cp2],
    ];
    return tabela(['Ensaio', 'CP 1', 'CP 2', 'Média', 'Diferença CP 2 − CP 1'], itens.map(([name, a, b]) => ({ cells: [name, formato(a), formato(b), num(a) == null || num(b) == null ? '—' : formato((num(a) + num(b)) / 2), num(a) == null || num(b) == null ? '—' : formato(num(b) - num(a))] })));
  }

  function barrasComparacao(lotes, selecionado) {
    const bloco = (titulo, campo) => {
      const linhas = lotes.map(l => ({ lote: l, valor: num(l[campo]) })).filter(r => r.valor != null);
      if (!linhas.length) return '';
      const maior = Math.max(1, ...linhas.map(r => r.valor));
      const media = linhas.reduce((total, r) => total + r.valor, 0) / linhas.length;
      return `<div><div class="subhead">${esc(titulo)}</div>${linhas.map(r => `<div class="bar-row${String(r.lote.id) === String(selecionado.id) ? ' selected' : ''}"><span>${esc(r.lote.lote)}</span><i><b style="width:${Math.max(1, Math.min(100, Math.round(r.valor / maior * 100)))}%"></b></i><em>${esc(formato(r.valor))}</em></div>`).join('')}${nota(`Média dos lotes com valor: ${formato(media)}.`)}</div>`;
    };
    const despro = bloco('Desprotensão (início da pista)', 'desproIni');
    const comp14 = bloco('Compressão aos 14 dias, CP 1 (MPa)', 'comp14Cp1');
    return despro || comp14 ? `<div class="cols comparison-bars">${despro || '<div></div>'}${comp14 || '<div></div>'}</div>` : '';
  }

  function corpoCavan(d) {
    const l = d.lote;
    const hoje = data(hojeISO());
    const statusOk = /liberado|aprovado/i.test(l.status || '');
    const statusAlerta = /trav|reprov|análise|analise|bloquead/i.test(l.status || '');
    const resumo = `O lote ${l.lote || 'sem número'} foi fabricado em ${data(l.dataFabricacao) || 'data não informada'} na pista ${l.pista || 'não informada'} de ${l.fornecedor || 'fornecedor não informado'}, para o projeto ${l.projeto || 'não informado'}. A Produção registra ${l.total || 'quantidade não informada'} dormentes. Situação atual: ${l.status || 'não informada'}.`;
    const metricas = [
      [statusOk ? 'status ok' : statusAlerta ? 'status' : 'status neutral', String(l.status || 'Sem status'), l.motivo || 'Situação na Produção'],
      ['', formato(l.total), 'dormentes produzidos'],
      ['alert', d.extras.reprovados.ok ? formato(d.refugos) : '—', 'refugos em Reprovados'],
      ['', d.idade == null ? '—' : formato(d.idade), 'dias desde a fabricação'],
      ['', formato(d.ensSerie.length), 'ensaios da série'],
    ];
    const comparacao = d.semana.slice().sort((a, b) => String(a.dataFabricacao).localeCompare(String(b.dataFabricacao)));
    const rnc = d.extras.rnc.ok && !d.extras.areaConprem ? d.extras.rnc.rows.filter(r => mencionaLote(`${r.titulo || ''} ${r.conteudo || ''}`, l.lote)) : [];
    return `
      <header class="hero"><div class="hero-copy"><img class="hero-logo" src="${esc(d.extras.logo)}" alt="Rumo"><div class="eyebrow">Relatório de qualidade · dormentes de concreto</div><h1>Lote ${esc(l.lote || '—')}</h1><div class="subtitle">${esc(l.fornecedor || 'Fornecedor não informado')} · ${esc(l.projeto || 'Projeto não informado')} · ${esc(l.tipo || l.bitola || 'Tipo não informado')}<br>Pista ${esc(l.pista || '—')} · Fabricado em ${esc(data(l.dataFabricacao) || 'data não informada')}</div><div class="meta">Emitido em ${hoje} · Fonte: Sistema de Qualidade de Dormentes (Supabase)</div></div><div class="mosaic"><i></i><i></i><i></i><i></i><i></i><i></i></div></header>
      <div class="metrics">${metricas.map(([kind, value, label]) => `<div class="metric ${kind}"><strong>${esc(value)}</strong><span>${esc(label)}</span></div>`).join('')}</div>
      <div class="summary"><strong>Resumo.</strong> ${esc(resumo)}</div>
      ${tituloSecao(1, 'Pontos de atenção')}${alertasCavan(d)}</section>
      ${tituloSecao(2, 'Identificação', true)}${grade([
        ['Lote', l.lote], ['Fornecedor', l.fornecedor], ['Projeto', l.projeto], ['Bitola', l.bitola], ['Tipo de dormente', l.tipo], ['Pedido', l.pedido], ['Série', l.serie],
      ], [
        ['Pista', l.pista], ['Tipo de ombreira', l.ombreira], ['USP', l.comUsp], ['Lote USP', l.uspLote], ['Lote de ombreira', l.loteOmbreira], ['Semana operacional', l.semana && l.ano ? `${l.semana}/${l.ano}` : ''], ['Status', l.status], ['Motivo', l.motivo],
      ])}</section>
      ${tituloSecao(3, 'Fabricação e cura')}${grade([
        ['Data de fabricação', data(l.dataFabricacao)], ['Hora de fabricação', l.horaFabricacao], ['Cura 14 dias', data(l.cura14)], ['Cura 28 dias', data(l.cura28)], ['Tempo de cura', l.tempoCura ? `${l.tempoCura} h` : ''], ['Cura térmica', l.curaTermica ? 'Sim' : 'Não'],
      ], [
        ['Total produzido', l.total], ['Total aprovado', l.aprovado], ['Dormentes ensaiados', l.ensaiados], ['A analisar', l.aAnalisar], ['Reprovados na ficha', l.reprovados], ['Desmolde', l.desmoldeEm ? `${data(l.desmoldeEm)} ${String(l.desmoldeEm).slice(11, 16)}` : ''],
      ])}</section>
      ${tituloSecao(4, 'Controle do concreto')}<div class="cols"><div><div class="subhead">Slump test (mm)</div>${tabela(['Ponto', 'Abatimento', 'Espalhamento'], [
        { cells: ['Início', formato(l.slumpIniA), formato(l.slumpIniE)] }, { cells: ['Meio', formato(l.slumpMeioA), formato(l.slumpMeioE)] }, { cells: ['Fim', formato(l.slumpFimA), formato(l.slumpFimE)] },
      ])}</div><div><div class="subhead">Desprotensão por posição</div>${tabela(['Posição', 'Valor'], [
        { cells: ['Início da pista', l.desproIni] }, { cells: ['Meio da pista', l.desproMeio] }, { cells: ['Fim da pista', l.desproFim] },
      ])}<div class="subhead">Temperatura do concreto (°C)</div>${pares([['Inicial', l.tempIni], ['Meio', l.tempMeio], ['Final', l.tempFim]])}</div></div><div class="subhead">Resistências (MPa)</div>${resistencias(l)}${nota('Os valores são reproduzidos como lançados na Produção; este relatório não aplica limites de especificação automaticamente.')}</section>
      ${tituloSecao(5, 'Comparação com os lotes do mesmo período', true)}${nota(`Mesmo fornecedor, projeto, pista e período operacional do lote ${l.lote || '—'}.`)}${tabela(['Lote', 'Fabricação', 'Série', 'Desprot. inicial', 'Comp. 14 d CP 1', 'Comp. 28 d CP 1', 'Status'], comparacao.map(r => ({ selected: String(r.id) === String(l.id), cells: [r.lote, data(r.dataFabricacao), r.serie, r.desproIni, r.comp14Cp1, r.comp28Cp1, r.status] })), 'Não há outros lotes comparáveis nos registros carregados.')}${barrasComparacao(comparacao, l)}</section>
      ${tituloSecao(6, 'Reprovados')}${tabela(['Molde', 'Cavidade', 'Indicador', 'Motivo detalhado', 'Qtd.', 'Data de produção'], d.rep.map(r => ({ cells: [r.molde, r.cavidade, r.motivo_indicador, r.motivo_detalhado, r.total_refugos ?? 1, data(r.data_producao)] })), vazioOuFalha(d.extras.reprovados, 'Nenhum registro de refugo vinculado ao lote.'))}</section>
      ${tituloSecao(7, 'Inspeções')}${tabela(['Tipo', 'Data', 'Responsável', 'Resultado', 'Arquivo de origem'], [
        ...d.pista.map(r => ({ cells: ['Pista', data(r.data_inspecao), r.responsavel, r.resultado, r.arquivo_origem] })),
        ...d.concretagem.map(r => ({ cells: ['Concretagem', data(r.data_inspecao), r.responsavel, r.resultado, r.arquivo_origem] })),
      ], d.extras.pista.ok && d.extras.concretagem.ok ? 'Nenhuma inspeção vinculada pelo número do lote.' : 'Uma ou mais consultas de inspeção estão indisponíveis.')}</section>
      ${tituloSecao(8, 'RNC e avisos do painel', true)}${rnc.length ? rnc.map(r => `<div class="callout"><strong>${esc(r.titulo)}</strong>${esc(r.conteudo).replace(/\n/g, '<br>')}</div>`).join('') : nota(d.extras.areaConprem ? 'O quadro de RNC de dormentes é compartilhado com a área Cavan e não é consultado neste relatório Conprem.' : vazioOuFalha(d.extras.rnc, 'Nenhuma RNC com o número exato deste lote foi encontrada.'))}${d.extras.aviso.ok && mencionaLote(d.extras.aviso.row?.conteudo, l.lote) ? '<div class="callout"><strong>Aviso do painel</strong>O quadro de avisos menciona este lote; consulte o painel para o contexto completo.</div>' : ''}</section>
      ${tituloSecao(9, 'Série e pedido')}${grade([
        ['Série do lote', l.serie], ['Lotes da série no site', d.lotesSerie.map(r => r.lote).join(', ')], ['Ensaios vinculados à série', d.ensSerie.length],
      ], [
        ['Pedido', l.pedido], ['Cliente', d.pedido?.cliente], ['Quantidade do pedido', d.pedido?.quantidade || d.pedido?.quantidade_dormentes],
      ])}${d.ensSerie.length ? tabela(['Lote ensaiado', 'Data', 'Resultado'], d.ensSerie.map(r => ({ cells: [r.lote, data(r.dataEnsaio), r.resultado] }))) : ''}</section>
      ${tituloSecao(10, 'Dados não encontrados no site')}${tabela(['Fonte', 'Situação'], [
        { cells: ['Inspeção de pista', d.extras.pista.ok ? `${d.pista.length} registro(s)` : 'Consulta indisponível'] },
        { cells: ['Inspeção de concretagem', d.extras.concretagem.ok ? `${d.concretagem.length} registro(s)` : 'Consulta indisponível'] },
        { cells: ['Ensaio de liberação da série', `${d.ensSerie.length} registro(s) carregado(s)`] },
        { cells: ['Temperaturas do concreto', l.tempIni || l.tempMeio || l.tempFim ? 'Parcial ou preenchido' : 'Não informadas'] },
        { cells: ['Lote de ombreiras', l.loteOmbreira ? 'Preenchido' : 'Não informado'] },
      ])}</section>
      ${tituloSecao(11, 'Registros consultados')}${tabela(['Tela / tabela', 'Registros usados'], [
        { cells: ['Produção / producao_lotes', '1 lote + comparação do período'] },
        { cells: ['Reprovados / reprovados', d.extras.reprovados.ok ? d.rep.length : 'consulta indisponível'] },
        { cells: ['Inspeções / inspecoes_pista', d.extras.pista.ok ? d.pista.length : 'consulta indisponível'] },
        { cells: ['Inspeções / inspecoes_concretagem', d.extras.concretagem.ok ? d.concretagem.length : 'consulta indisponível'] },
        { cells: ['Ensaios / ensaios_liberacao', d.ensSerie.length] },
        { cells: ['RNC / rnc_dormentes', d.extras.rnc.ok ? rnc.length : 'consulta indisponível'] },
      ])}${nota(`Consulta emitida em ${hoje}. Vínculos por ID são preferidos; quando ausentes, o relatório usa número exato do lote e fornecedor. Valores do banco são exibidos sem correção manual.`)}</section>`;
  }

  function corpoConprem(l, campos, logo) {
    const grupos = (campos || []).filter(g => g.itens?.length);
    const hoje = data(hojeISO());
    return `<header class="hero"><div class="hero-copy"><img class="hero-logo" src="${esc(logo)}" alt="Rumo"><div class="eyebrow">Relatório de qualidade · dormentes de concreto</div><h1>Lote ${esc(l.lote || '—')}</h1><div class="subtitle">Conprem · ${esc(l.projeto || 'Projeto não informado')} · ${esc(l.bitola || 'Bitola não informada')}<br>Fabricado em ${esc(data(l.dataFabricacao) || 'data não informada')}</div><div class="meta">Emitido em ${hoje} · Fonte: Sistema de Qualidade de Dormentes (Supabase)</div></div><div class="mosaic"><i></i><i></i><i></i><i></i><i></i><i></i></div></header>
      <div class="metrics"><div class="metric status"><strong>Conprem</strong><span>Mapa de rastreabilidade</span></div><div class="metric"><strong>${esc(l.lote || '—')}</strong><span>lote</span></div><div class="metric"><strong>${esc(formato(l.total))}</strong><span>dormentes produzidos</span></div><div class="metric"><strong>${esc(l.semanaRef || '—')}</strong><span>semana</span></div><div class="metric"><strong>${esc(l.ordemFabricacao || '—')}</strong><span>ordem de fabricação</span></div></div>
      <div class="summary"><strong>Resumo.</strong> Mapa de rastreabilidade do lote ${esc(l.lote || '—')}, com os dados de produção, insumos e certificados cadastrados na área Conprem.</div>
      ${grupos.map((g, i) => `${tituloSecao(i + 1, g.grupo)}${grade(
        g.itens.slice(0, Math.ceil(g.itens.length / 2)).map(([key, rot]) => [rot, key === 'dataFabricacao' ? data(l[key]) : l[key]]),
        g.itens.slice(Math.ceil(g.itens.length / 2)).map(([key, rot]) => [rot, key === 'dataFabricacao' ? data(l[key]) : l[key]])
      )}</section>`).join('')}
      ${tituloSecao(grupos.length + 1, 'Registros consultados')}${nota(`Produção Conprem / conprem_producao_lotes · 1 lote · consulta emitida em ${hoje}. Os campos não preenchidos aparecem como “não informado”.`)}</section>`;
  }

  function documento(corpo, title, cssUrl) {
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><link rel="stylesheet" href="${esc(cssUrl)}"></head><body><div class="toolbar"><span>${esc(title)} · Modelo padrão de PDF</span><button type="button" onclick="window.print()">Salvar PDF / imprimir</button></div><main class="report">${corpo}<div class="footer-screen"><span>Rumo · Sistema de Qualidade de Dormentes</span><span>${esc(title)}</span></div></main><script>window.addEventListener('load', () => setTimeout(() => window.print(), 300), { once: true });</script></body></html>`;
  }

  function janela() {
    const nova = window.open('', '_blank');
    if (!nova) throw new Error('O navegador bloqueou a janela do relatório. Permita pop-ups para este site.');
    nova.document.write('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Preparando relatório</title><body style="font:16px Arial;padding:32px">Consultando os dados do lote...</body></html>');
    nova.document.close();
    return nova;
  }

  function mostrar(nova, html) {
    nova.document.open();
    nova.document.write(html);
    nova.document.close();
  }

  async function abrirCavan(lote, contexto = {}) {
    const nova = janela(); // Antes da primeira operação assíncrona, para não bloquear o pop-up.
    try {
      const chamadas = [
        ['reprovados', () => StoreSupabase.listarReprovados({ lote: lote.lote, limite: 500 })],
        ['pista', () => StoreSupabase.listarInspecoesPista({ lote: lote.lote, limite: 500 })],
        ['concretagem', () => StoreSupabase.listarInspecoesConcretagem({ lote: lote.lote, limite: 500 })],
        ['rnc', () => StoreSupabase.listarRncDormentes({ limite: 500 })],
        ['aviso', () => StoreSupabase.obterAvisoDashboard()],
      ];
      const results = await Promise.allSettled(chamadas.map(([, fn]) => fn()));
      const extras = { areaConprem: false, logo: new URL('assets/rumo/rumo-logo-branco.png', location.href).href };
      callsToExtras(chamadas, results, extras);
      const css = new URL('css/relatorio-lote.css?v=20260923', location.href).href;
      mostrar(nova, documento(corpoCavan(prepararCavan(lote, contexto, extras)), `Relatório do lote ${lote.lote}`, css));
    } catch (err) {
      nova.document.body.textContent = `Não foi possível preparar o relatório: ${err.message || err}`;
      throw err;
    }
  }

  function callsToExtras(chamadas, results, extras) {
    chamadas.forEach(([key], i) => {
      const result = results[i];
      if (result.status === 'fulfilled') extras[key] = key === 'aviso' ? { ok: true, row: result.value } : { ok: true, rows: result.value || [] };
      else { console.warn(`Relatório de lote: falha ao consultar ${key}`, result.reason); extras[key] = { ok: false, rows: [] }; }
    });
  }

  function abrirConprem(lote, campos) {
    const nova = janela();
    const css = new URL('css/relatorio-lote.css?v=20260923', location.href).href;
    const logo = new URL('assets/rumo/rumo-logo-branco.png', location.href).href;
    mostrar(nova, documento(corpoConprem(lote, campos, logo), `Relatório do lote ${lote.lote}`, css));
  }

  return { abrirCavan, abrirConprem, prepararCavan, corpoCavan, corpoConprem, documento };
})();

if (typeof window !== 'undefined') window.RelatorioLote = RelatorioLote;
if (typeof module !== 'undefined') module.exports = RelatorioLote;
