/* =====================================================================
   CONPREM-DASHBOARD.JS — Painel da área Conprem

   O painel da Cavan é sobre o fluxo de liberação: cura de 14 e 28 dias,
   séries, status do lote. A Conprem não tem esse fluxo — ela manda três
   relatórios semanais, e é sobre eles que este painel fala:

     Rastreabilidade -> quanto chegou, em quantos lotes, com que insumos
     Ensaio          -> quantos ensaios, quantos aprovados
     Resumo Semanal  -> refugo por tipo, taxa e planejamento

   Por isso este arquivo existe em vez de reaproveitar js/dashboard.js:
   os números que importam aqui são outros.
   ===================================================================== */

const ConpremDashboard = {
  lotes: [],
  ensaios: [],
  resumos: [],
  carregando: true,
  erro: '',
  graficos: {},
};

document.addEventListener('DOMContentLoaded', async () => {
  if (!await Auth.exigirLogin()) return;
  App.montarLayout('dashboard', 'Dashboard — Conprem',
    'Recebimento semanal da CONPREM: produção, ensaios, refugo e planejamento');
  App.acoesTopo(`
    <button class="btn btn-secundario" onclick="location.href='conprem-leitor.html'">${ICN.upload}Leitor de Recebidos</button>
    <button class="btn btn-secundario" onclick="ConpremDashboard.carregar()">Atualizar</button>
  `);

  const filtro = document.getElementById('fSemana');
  if (filtro) filtro.addEventListener('change', () => ConpremDashboard.render());

  ConpremDashboard.render();
  await ConpremDashboard.carregar();
});

ConpremDashboard.carregar = async function carregar() {
  this.carregando = true;
  this.erro = '';
  this.render();
  try {
    const [lotes, ensaios, resumos] = await Promise.all([
      StoreSupabase.listarProducao({ limite: 10000 }),
      StoreSupabase.listarEnsaiosDormentesConprem({ limite: 10000 }),
      StoreSupabase.listarReprovados({ limite: 10000 }),
    ]);
    this.lotes = lotes || [];
    this.ensaios = ensaios || [];
    // Só as linhas de Resumo Semanal: as reprovas avulsas antigas da Conprem
    // não têm o quadro da semana e distorceriam taxa e planejamento.
    this.resumos = (resumos || []).filter(r => r.qtd_fabricada != null || r.numero_resumo);
    this.carregando = false;
    this.atualizarFiltroSemana();
    this.render();
  } catch (err) {
    console.error('Erro ao carregar o painel da Conprem', err);
    this.carregando = false;
    this.erro = String(err?.message || err) || 'Não foi possível carregar os dados.';
    App.toast(this.erro, 'erro');
    this.render();
  }
};

/* ------------------------------------------------------------- filtros */

function semanaRotulo(r) {
  return r?.semana && r?.ano ? `${r.ano}-S${String(r.semana).padStart(2, '0')}` : '';
}

ConpremDashboard.atualizarFiltroSemana = function () {
  const el = document.getElementById('fSemana');
  if (!el) return;
  const semanas = [...new Set(
    [...this.lotes, ...this.ensaios, ...this.resumos].map(semanaRotulo).filter(Boolean),
  )].sort((a, b) => b.localeCompare(a));
  const atual = el.value;
  el.innerHTML = U.opcoes(semanas, atual, 'Todas as semanas');
  el.value = atual;
};

ConpremDashboard.recorte = function () {
  const semana = document.getElementById('fSemana')?.value || '';
  const filtra = lista => (semana ? lista.filter(r => semanaRotulo(r) === semana) : lista);
  return {
    semana,
    lotes: filtra(this.lotes),
    ensaios: filtra(this.ensaios),
    resumos: filtra(this.resumos),
  };
};

/* -------------------------------------------------------------- render */

ConpremDashboard.render = function () {
  const alvo = document.getElementById('painel');
  if (!alvo) return;

  if (this.carregando) {
    alvo.innerHTML = `<div class="card"><div class="vazio">${ICN.vazioBox}<h3>Carregando</h3><p>Buscando os dados da Conprem no Supabase...</p></div></div>`;
    return;
  }
  if (this.erro) {
    alvo.innerHTML = `<div class="card"><div class="vazio">${ICN.alerta}<h3>Painel indisponível</h3><p>${U.esc(this.erro)}</p><button class="btn btn-secundario" onclick="ConpremDashboard.carregar()">Tentar novamente</button></div></div>`;
    return;
  }

  const r = this.recorte();
  if (!r.lotes.length && !r.ensaios.length && !r.resumos.length) {
    alvo.innerHTML = `<div class="card"><div class="vazio">${ICN.vazioBox}<h3>Sem dados da Conprem</h3>
      <p>Importe os relatórios semanais no <strong>Leitor de Recebidos</strong> e mande gravar — o painel se monta a partir deles.</p>
      <button class="btn btn-primario" onclick="location.href='conprem-leitor.html'">Ir para o Leitor</button></div></div>`;
    return;
  }

  document.getElementById('kpis').innerHTML = this.htmlKpis(r);
  alvo.innerHTML = this.htmlPaineis(r);
  this.desenharGraficos(r);
};

function soma(lista, campo) {
  return lista.reduce((n, x) => n + (Number(x[campo]) || 0), 0);
}

function pct(parte, total) {
  return total ? `${Math.round((parte / total) * 100)}%` : '—';
}

function taxaTexto(v) {
  const n = Number(v);
  return Number.isFinite(n) ? `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%` : '—';
}

ConpremDashboard.htmlKpis = function ({ lotes, ensaios, resumos }) {
  const dormentes = soma(lotes, 'total_produzido');
  const aprovados = ensaios.filter(e => e.resultado === 'Aprovado').length;
  const refugos = soma(resumos, 'total_refugos');
  const fabricadoResumo = soma(resumos, 'qtd_fabricada');
  const planejado = soma(resumos, 'qtd_planejada');
  const taxa = fabricadoResumo ? refugos / fabricadoResumo : null;

  const kpi = (rotulo, valor, extra, cor = '') =>
    `<div class="kpi ${cor}"><div class="rotulo">${rotulo}</div><div class="valor">${valor}</div><div class="extra">${extra}</div></div>`;

  return [
    kpi('Dormentes recebidos', dormentes.toLocaleString('pt-BR'), `${lotes.length} lote(s) no Mapa de Rastreabilidade`, 'escuro'),
    kpi('Ensaios realizados', ensaios.length, `${aprovados} aprovado(s) · ${pct(aprovados, ensaios.length)} de aprovação`, 'verde'),
    kpi('Refugos', refugos.toLocaleString('pt-BR'), `taxa de ${taxa == null ? '—' : taxaTexto(taxa)} sobre ${fabricadoResumo.toLocaleString('pt-BR')} fabricados`, 'vermelho'),
    kpi('Planejado', planejado.toLocaleString('pt-BR'), 'dormentes para a semana seguinte', 'amarelo'),
  ].join('');
};

ConpremDashboard.htmlPaineis = function ({ lotes, ensaios, resumos }) {
  const pendencias = certificadosPendentes(lotes);
  return `
    <div class="grid-2">
      <div class="card">
        <div class="card-titulo"><span class="acento">Produção recebida por lote</span>
          <span class="card-sub">Quantidade de dormentes de cada lote do Mapa de Rastreabilidade</span></div>
        <div class="gr-box"><canvas id="chartProducao"></canvas></div>
      </div>
      <div class="card">
        <div class="card-titulo"><span class="acento">Refugo por tipo</span>
          <span class="card-sub">Somatório do Resumo Semanal no recorte</span></div>
        <div class="gr-box"><canvas id="chartRefugos"></canvas></div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-titulo"><span class="acento">Ensaios por semana</span>
          <span class="card-sub">Aprovados e reprovados no relatório FR.10/08</span></div>
        <div class="gr-box"><canvas id="chartEnsaios"></canvas></div>
      </div>
      <div class="card">
        <div class="card-titulo"><span class="acento">Taxa de refugo por semana</span>
          <span class="card-sub">Do Resumo Semanal, em % sobre o fabricado</span></div>
        <div class="gr-box"><canvas id="chartTaxa"></canvas></div>
      </div>
    </div>

    <div class="card">
      <div class="card-titulo"><span class="acento">Certificados externos pendentes</span>
        <span class="card-sub">Insumos sem certificado externo no Mapa de Rastreabilidade — é o que trava o recebimento</span></div>
      ${pendencias.length
        ? `<div class="tabela-wrap"><table class="tabela">
            <thead><tr><th>Insumo</th><th class="right">Lotes sem certificado</th><th class="right">Dormentes envolvidos</th></tr></thead>
            <tbody>${pendencias.map(p => `<tr>
              <td><strong>${U.esc(p.insumo)}</strong></td>
              <td class="right">${p.lotes}</td>
              <td class="right">${p.dormentes.toLocaleString('pt-BR')}</td>
            </tr>`).join('')}</tbody>
          </table></div>`
        : `<div class="vazio compacto">${ICN.check}<h3>Rastreabilidade completa</h3><p>Todos os lotes do recorte têm certificado externo de todos os insumos.</p></div>`}
    </div>

    ${resumos.length ? `<div class="card">
      <div class="card-titulo"><span class="acento">Planejado × recebido</span>
        <span class="card-sub">O que o Resumo Semanal planejou para a semana seguinte e o que chegou no Mapa de Rastreabilidade</span></div>
      <div class="tabela-wrap"><table class="tabela">
        <thead><tr><th>Semana do resumo</th><th class="right">Fabricado</th><th class="right">Ensaios</th><th class="right">Refugos</th><th class="right">Taxa</th><th class="right">Planejado p/ seguinte</th></tr></thead>
        <tbody>${resumos.slice().sort((a, b) => semanaRotulo(b).localeCompare(semanaRotulo(a))).map(s => `<tr>
          <td><strong>${U.esc(semanaRotulo(s) || '—')}</strong></td>
          <td class="right">${(Number(s.qtd_fabricada) || 0).toLocaleString('pt-BR')}</td>
          <td class="right">${Number(s.ensaios_realizados) || 0}</td>
          <td class="right">${Number(s.total_refugos) || 0}</td>
          <td class="right">${taxaTexto(s.taxa_refugo)}</td>
          <td class="right">${(Number(s.qtd_planejada) || 0).toLocaleString('pt-BR')}</td>
        </tr>`).join('')}</tbody>
      </table></div>
    </div>` : ''}
  `;
};

/* O certificado externo prova a procedência do insumo. O relatório escreve
   "-", "Aguardando" ou deixa em branco quando ele não chegou. */
const INSUMOS = [
  ['aco_cert_externo', 'Aço'],
  ['cimento_cert_externo', 'Cimento'],
  ['areia_cert_externo', 'Areia'],
  ['brita_cert_externo', 'Brita'],
  ['aditivo_cert_externo', 'Aditivo'],
  ['adicao_cert_externo', 'Adição'],
];

function semCertificado(valor) {
  const v = String(valor || '').trim();
  return !v || v === '-' || /aguardando/i.test(v);
}

function certificadosPendentes(lotes) {
  // Só conta lote que veio do Mapa: lote antigo, sem nenhuma coluna de
  // rastreabilidade, não é pendência — é registro de antes do Leitor.
  const doMapa = lotes.filter(l => INSUMOS.some(([c]) => String(l[c] || '').trim()) || l.ordem_fabricacao);
  return INSUMOS.map(([coluna, insumo]) => {
    const faltando = doMapa.filter(l => semCertificado(l[coluna]));
    return { insumo, lotes: faltando.length, dormentes: soma(faltando, 'total_produzido') };
  }).filter(p => p.lotes > 0).sort((a, b) => b.lotes - a.lotes);
}

/* ------------------------------------------------------------ gráficos */

ConpremDashboard.desenharGraficos = function ({ lotes, ensaios, resumos }) {
  Object.values(this.graficos).forEach(g => { try { g.destroy(); } catch (e) { /* já destruído */ } });
  this.graficos = {};
  if (typeof Chart === 'undefined') return;

  const C = CFG.cores;
  const eixoInteiro = { beginAtZero: true, ticks: { precision: 0 } };

  // Produção por lote, na ordem de fabricação
  const porLote = lotes.slice()
    .sort((a, b) => String(a.data_fabricacao).localeCompare(String(b.data_fabricacao)))
    .slice(-30);
  this.criar('chartProducao', {
    type: 'bar',
    data: {
      labels: porLote.map(l => l.lote || '—'),
      datasets: [{ label: 'Dormentes', data: porLote.map(l => Number(l.total_produzido) || 0), backgroundColor: C.azulClaro }],
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: eixoInteiro } },
  });

  // Refugo por tipo
  const tipos = [
    ['refugo_fissuras', 'Fissuras'], ['refugo_vazios', 'Vazios'], ['refugo_ombreiras', 'Ombreiras'],
    ['refugo_quebras', 'Quebras'], ['refugo_usp', 'USP'], ['refugo_falhas_fabricacao', 'Falhas fabricação'],
    ['refugo_outros', 'Outros'],
  ].map(([coluna, nome]) => [nome, soma(resumos, coluna)]).filter(([, v]) => v > 0);
  this.criar('chartRefugos', {
    type: 'doughnut',
    data: {
      labels: tipos.map(([nome]) => nome),
      datasets: [{ data: tipos.map(([, v]) => v), backgroundColor: CFG.cores.paleta }],
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } },
  });

  // Ensaios por semana, aprovados x reprovados
  const semanas = [...new Set(ensaios.map(semanaRotulo).filter(Boolean))].sort();
  this.criar('chartEnsaios', {
    type: 'bar',
    data: {
      labels: semanas,
      datasets: [
        { label: 'Aprovados', data: semanas.map(s => ensaios.filter(e => semanaRotulo(e) === s && e.resultado === 'Aprovado').length), backgroundColor: C.verde },
        { label: 'Reprovados', data: semanas.map(s => ensaios.filter(e => semanaRotulo(e) === s && e.resultado === 'Reprovado').length), backgroundColor: C.erro },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: { x: { stacked: true }, y: { ...eixoInteiro, stacked: true } },
    },
  });

  // Taxa de refugo por semana
  const semanasResumo = resumos.slice().sort((a, b) => semanaRotulo(a).localeCompare(semanaRotulo(b)));
  this.criar('chartTaxa', {
    type: 'line',
    data: {
      labels: semanasResumo.map(semanaRotulo),
      datasets: [{
        label: 'Taxa de refugo (%)',
        data: semanasResumo.map(s => (Number(s.taxa_refugo) || 0) * 100),
        borderColor: C.erro,
        backgroundColor: 'rgba(226,59,59,.15)',
        tension: .3,
        fill: true,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { callback: v => `${v}%` } } },
    },
  });
};

ConpremDashboard.criar = function (id, config) {
  const el = document.getElementById(id);
  if (!el) return;
  this.graficos[id] = new Chart(el, config);
};
