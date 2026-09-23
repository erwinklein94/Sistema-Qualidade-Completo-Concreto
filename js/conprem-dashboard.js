/* Dashboard Conprem: a mesma linguagem visual da Cavan, com indicadores
   calculados apenas dos relatórios da Conprem. */
const ConpremDashboard = {
  lotes: [],
  ensaios: [],
  resumos: [],
  graficos: {},
  carregando: true,
  erro: "",
  aviso: null,
  avisoCarregando: true,
  avisoErro: "",
  avisoSalvando: false,

  async iniciar() {
    if (!await Auth.exigirLogin()) return;
    App.montarLayout("dashboard", "Dashboard — Conprem",
      "Produção, ensaios, refugo e planejamento dos relatórios da Conprem");
    App.acoesTopo(
      '<button class="btn btn-secundario" type="button" onclick="location.href=\'conprem-leitor.html\'">' +
      ICN.upload + 'Leitor de Recebidos</button>' +
      '<button class="btn btn-secundario" type="button" onclick="ConpremDashboard.atualizar()">' +
      ICN.check + 'Atualizar</button>'
    );
    ["fProjeto", "fBitola", "fPedido"].forEach(id => {
      document.getElementById(id)?.addEventListener("change", () => this.render());
    });
    document.getElementById("fSemana")?.addEventListener("change", () => {
      if (!U.aplicarSemanaSelecionada("fSemana", "fPeriodoIni", "fPeriodoFim")) {
        document.getElementById("fPeriodoIni").value = "";
        document.getElementById("fPeriodoFim").value = "";
      }
      this.render();
    });
    ["fPeriodoIni", "fPeriodoFim"].forEach(id => {
      document.getElementById(id)?.addEventListener("change", () => {
        U.sincronizarFiltroSemana("fSemana",
          document.getElementById("fPeriodoIni").value,
          document.getElementById("fPeriodoFim").value);
        this.render();
      });
    });
    document.getElementById("btnUltimaSemana")?.addEventListener("click", () => this.ultimaSemana());
    document.getElementById("btnLimparFiltros")?.addEventListener("click", () => this.limparFiltros());
    window.render = () => this.render();
    App.aplicarPadraoGraficos();
    this.render();
    this.renderAviso();
    await this.atualizar();
  },

  async atualizar() {
    await Promise.all([this.carregar(), this.carregarAviso()]);
  },

  async carregar() {
    this.carregando = true;
    this.erro = "";
    this.render();
    try {
      const [lotes, ensaios, reprovados] = await Promise.all([
        StoreSupabase.listarProducao({
          limite: 10000,
          colunas: "id,fornecedor,projeto,bitola,pedido,lote,ordem_fabricacao,data_fabricacao,total_produzido,semana,ano,aco_cert_externo,cimento_cert_externo,areia_cert_externo,brita_cert_externo,aditivo_cert_externo,adicao_cert_externo"
        }),
        StoreSupabase.listarEnsaiosDormentesConprem({
          limite: 10000,
          colunas: "id,producao_lote_id,projeto,bitola,pedido,lote_ensaiado,data_ensaio,resultado,semana,ano"
        }),
        StoreSupabase.listarReprovados({
          limite: 10000,
          colunas: "id,projeto,bitola,semana,ano,numero_resumo,pedido_local,periodo_inicio,periodo_fim,data_emissao,qtd_fabricada,ensaios_realizados,total_refugos,taxa_refugo,qtd_planejada,planejamento_inicio,planejamento_fim,refugo_fissuras,refugo_vazios,refugo_ombreiras,refugo_quebras,refugo_usp,refugo_falhas_fabricacao,refugo_outros"
        })
      ]);
      this.lotes = lotes || [];
      const porId = new Map(this.lotes.map(lote => [lote.id, lote]));
      this.ensaios = (ensaios || []).map(ensaio => {
        const lote = porId.get(ensaio.producao_lote_id);
        return {
          ...ensaio,
          projeto: ensaio.projeto || lote?.projeto || "",
          bitola: ensaio.bitola || lote?.bitola || "",
          pedido: ensaio.pedido || lote?.pedido || ""
        };
      });
      this.resumos = (reprovados || []).filter(r => r.qtd_fabricada != null || r.numero_resumo);
      this.carregando = false;
      this.atualizarFiltros();
      this.render();
    } catch (err) {
      console.error("Erro ao carregar dashboard Conprem", err);
      this.carregando = false;
      this.erro = String(err?.message || err) || "Não foi possível carregar os dados.";
      App.toast(U.esc(this.erro), "erro");
      this.render();
    }
  },

  atualizarFiltros() {
    const registros = [...this.lotes, ...this.ensaios, ...this.resumos];
    const preencher = (id, valores, placeholder) => {
      const select = document.getElementById(id);
      if (!select) return;
      const selecionado = select.value;
      select.innerHTML = '<option value="">' + placeholder + "</option>" +
        [...new Set(valores.filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"))
          .map(valor => '<option value="' + U.esc(valor) + '">' + U.esc(valor) + "</option>").join("");
      select.value = selecionado;
    };
    preencher("fProjeto", registros.map(r => r.projeto), "Todos os projetos");
    preencher("fBitola", registros.map(r => r.bitola), "Todas as bitolas");
    preencher("fPedido", registros.map(pedidoConprem), "Todos os pedidos");
    const datas = [
      ...this.lotes.map(r => r.data_fabricacao),
      ...this.ensaios.map(r => r.data_ensaio),
      ...this.resumos.map(r => r.periodo_inicio)
    ].filter(Boolean);
    U.preencherFiltroSemana("fSemana", datas, document.getElementById("fSemana")?.value,
      "Todas as semanas");
  },

  ultimaSemana() {
    const hoje = U.isoLocal(new Date());
    const datas = [
      ...this.lotes.map(r => r.data_fabricacao),
      ...this.ensaios.map(r => r.data_ensaio),
      ...this.resumos.map(r => r.periodo_inicio)
    ].filter(d => d && d <= hoje).sort();
    const periodo = U.periodoSemanaOperacional(datas.at(-1) || hoje);
    if (!periodo) return;
    document.getElementById("fPeriodoIni").value = periodo.ini;
    document.getElementById("fPeriodoFim").value = periodo.fim;
    U.sincronizarFiltroSemana("fSemana", periodo.ini, periodo.fim);
    this.render();
  },

  limparFiltros() {
    ["fProjeto", "fBitola", "fPedido", "fSemana", "fPeriodoIni", "fPeriodoFim"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    this.render();
  },

  recorte() {
    const projeto = document.getElementById("fProjeto")?.value || "";
    const bitola = document.getElementById("fBitola")?.value || "";
    const pedido = document.getElementById("fPedido")?.value || "";
    const ini = document.getElementById("fPeriodoIni")?.value || "";
    const fim = document.getElementById("fPeriodoFim")?.value || "";
    const pertence = r => (!projeto || r.projeto === projeto) &&
      (!bitola || r.bitola === bitola) &&
      (!pedido || pedidoConprem(r) === pedido);
    const dataNoPeriodo = data => (!ini || data >= ini) && (!fim || data <= fim);
    const resumoNoPeriodo = r => (!ini || (r.periodo_fim || r.periodo_inicio || "") >= ini) &&
      (!fim || (r.periodo_inicio || r.periodo_fim || "") <= fim);
    return {
      lotes: this.lotes.filter(r => pertence(r) && dataNoPeriodo(r.data_fabricacao || "")),
      ensaios: this.ensaios.filter(r => pertence(r) && dataNoPeriodo(r.data_ensaio || "")),
      resumos: this.resumos.filter(r => pertence(r) && resumoNoPeriodo(r))
    };
  },

  destruirGraficos() {
    Object.values(this.graficos).forEach(grafico => {
      try { grafico.destroy(); } catch (err) { console.warn("Gráfico já removido", err); }
    });
    this.graficos = {};
  },

  render() {
    const painel = document.getElementById("painel");
    const kpis = document.getElementById("kpis");
    if (!painel || !kpis) return;
    this.destruirGraficos();
    if (this.carregando) {
      kpis.innerHTML = "";
      painel.innerHTML = '<div class="card"><div class="vazio">' + ICN.vazioBox +
        "<h3>Carregando</h3><p>Buscando os dados da Conprem no Supabase...</p></div></div>";
      return;
    }
    if (this.erro) {
      kpis.innerHTML = "";
      painel.innerHTML = '<div class="card"><div class="vazio">' + ICN.alerta +
        "<h3>Painel indisponível</h3><p>" + U.esc(this.erro) +
        '</p><button class="btn btn-secundario" type="button" onclick="ConpremDashboard.carregar()">Tentar novamente</button></div></div>';
      return;
    }
    const recorte = this.recorte();
    kpis.innerHTML = this.htmlKpis(recorte);
    if (!recorte.lotes.length && !recorte.ensaios.length && !recorte.resumos.length) {
      painel.innerHTML = '<div class="card"><div class="vazio">' + ICN.vazioBox +
        "<h3>Sem dados neste recorte</h3><p>Ajuste os filtros ou carregue os relatórios no Leitor de Recebidos.</p></div></div>";
      return;
    }
    painel.innerHTML = this.htmlPaineis(recorte);
    this.desenharGraficos(recorte);
  },

  htmlKpis({ lotes, ensaios, resumos }) {
    const produzidos = somaConprem(lotes, "total_produzido");
    const aprovados = ensaios.filter(r => r.resultado === "Aprovado").length;
    const refugos = somaConprem(resumos, "total_refugos");
    const fabricados = somaConprem(resumos, "qtd_fabricada");
    const planejados = somaConprem(resumos, "qtd_planejada");
    const taxa = fabricados ? refugos / fabricados : null;
    const kpi = (titulo, valor, extra, classe) =>
      '<div class="kpi ' + classe + '"><div class="rotulo">' + titulo +
      '</div><div class="valor">' + valor + '</div><div class="extra">' + extra + "</div></div>";
    return [
      kpi("Produção registrada", numeroConprem(produzidos),
        numeroConprem(lotes.length) + " lotes na rastreabilidade", "escuro"),
      kpi("Ensaios aprovados", numeroConprem(aprovados),
        numeroConprem(ensaios.length) + " ensaios físicos · " +
        percentualConprem(ensaios.length ? aprovados / ensaios.length : null) + " de aprovação", "verde"),
      kpi("Refugos", numeroConprem(refugos),
        numeroConprem(fabricados) + " fabricados nos resumos", "vermelho"),
      kpi("Taxa de refugo", percentualConprem(taxa),
        "Refugos ÷ fabricados no Resumo Semanal", "amarelo"),
      kpi("Planejado", numeroConprem(planejados),
        "Dormentes previstos nos resumos filtrados", "escuro")
    ].join("");
  },

  htmlPaineis({ lotes, ensaios, resumos }) {
    const card = (titulo, subtitulo, id, amplo) =>
      '<div class="card' + (amplo ? " span2" : "") +
      '"><div class="card-titulo"><span class="acento">' + titulo +
      '</span><span class="card-sub">' + subtitulo +
      '</span></div><div class="chart-box' + (amplo ? " alto" : "") +
      '"><canvas id="' + id + '"></canvas></div></div>';
    const graficos = [
      card("Produção por projeto", "Dormentes do Mapa de Rastreabilidade", "chartProjeto", false),
      card("Refugos por motivo", "Composição dos Resumos Semanais", "chartRefugos", false),
      card("Fabricado × Refugo semanal por projeto",
        "Quantidades e taxa dos Resumos Semanais; não soma lotes ao fabricado do resumo",
        "chartSemanal", true),
      card("Fabricado × Refugo mensal por projeto",
        "Resumos agrupados pelo mês de início do período", "chartMensal", true),
      card("Produção por lote", "Até 20 lotes mais recentes da rastreabilidade", "chartLote", true),
      card("Resultado dos ensaios", "Aprovados, reprovados e pendentes", "chartStatusEnsaios", false),
      card("Ensaios por semana", "Semana da data do ensaio", "chartEnsaiosSemana", false),
      card("Planejamento por semana", "Fabricado no período e planejado para o seguinte",
        "chartPlanejamento", true)
    ].join("");
    return '<div class="grid-graficos">' + graficos + "</div>" +
      this.htmlResumo(resumos) + this.htmlPendencias(lotes);
  },

  htmlResumo(resumos) {
    if (!resumos.length) return "";
    const linhas = resumos.slice().sort((a, b) =>
      String(b.periodo_inicio || "").localeCompare(String(a.periodo_inicio || "")) ||
      String(b.numero_resumo || "").localeCompare(String(a.numero_resumo || "")));
    return '<div class="card"><div class="card-titulo"><span class="acento">Resumo Semanal</span>' +
      '<span class="card-sub">Detalhe por projeto e pedido, sem misturar com reprovas avulsas</span></div>' +
      '<div class="tabela-wrap"><table class="tabela"><thead><tr>' +
      '<th>Semana</th><th>Projeto</th><th>Pedido</th><th>Período</th>' +
      '<th class="right">Fabricado</th><th class="right">Ensaios</th>' +
      '<th class="right">Refugos</th><th class="right">Taxa</th>' +
      '<th class="right">Planejado</th></tr></thead><tbody>' +
      linhas.map(r => {
        const taxa = r.taxa_refugo != null && Number.isFinite(Number(r.taxa_refugo)) ?
          Number(r.taxa_refugo) : (Number(r.qtd_fabricada) ? Number(r.total_refugos) / Number(r.qtd_fabricada) : null);
        return "<tr><td><strong>" + U.esc(semanaRelatorio(r)) + "</strong></td>" +
          "<td>" + U.esc(r.projeto || "—") + "</td>" +
          "<td>" + U.esc(pedidoConprem(r) || "—") + "</td>" +
          "<td>" + U.esc(U.dataBR(r.periodo_inicio)) + " a " +
          U.esc(U.dataBR(r.periodo_fim)) + "</td>" +
          '<td class="right">' + numeroConprem(r.qtd_fabricada) + "</td>" +
          '<td class="right">' + numeroConprem(r.ensaios_realizados) + "</td>" +
          '<td class="right">' + numeroConprem(r.total_refugos) + "</td>" +
          '<td class="right">' + percentualConprem(taxa) + "</td>" +
          '<td class="right">' + numeroConprem(r.qtd_planejada) + "</td></tr>";
      }).join("") + "</tbody></table></div></div>";
  },

  htmlPendencias(lotes) {
    const campos = [
      ["aco_cert_externo", "Aço"], ["cimento_cert_externo", "Cimento"],
      ["areia_cert_externo", "Areia"], ["brita_cert_externo", "Brita"],
      ["aditivo_cert_externo", "Aditivo"], ["adicao_cert_externo", "Adição"]
    ];
    const doMapa = lotes.filter(lote => lote.ordem_fabricacao ||
      campos.some(([campo]) => String(lote[campo] || "").trim()));
    const pendencias = campos.map(([campo, nome]) => ({
      nome,
      registros: doMapa.filter(lote => certificadoPendente(lote[campo]))
    })).filter(item => item.registros.length);
    const conteudo = pendencias.length ?
      '<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Insumo</th>' +
      '<th class="right">Lotes sem certificado</th><th class="right">Dormentes envolvidos</th>' +
      '</tr></thead><tbody>' + pendencias.map(item =>
        "<tr><td><strong>" + U.esc(item.nome) + "</strong></td>" +
        '<td class="right">' + numeroConprem(item.registros.length) + "</td>" +
        '<td class="right">' + numeroConprem(somaConprem(item.registros, "total_produzido")) +
        "</td></tr>").join("") + "</tbody></table></div>" :
      '<div class="vazio compacto">' + ICN.check +
      "<h3>Rastreabilidade completa</h3><p>Nenhum certificado externo pendente no recorte.</p></div>";
    return '<div class="card"><div class="card-titulo"><span class="acento">Certificados externos pendentes</span>' +
      '<span class="card-sub">Insumos sem certificado no Mapa de Rastreabilidade</span></div>' +
      conteudo + "</div>";
  },

  criar(id, config) {
    const canvas = document.getElementById(id);
    if (canvas && typeof Chart !== "undefined") this.graficos[id] = new Chart(canvas, config);
  },

  desenharGraficos({ lotes, ensaios, resumos }) {
    if (typeof Chart === "undefined") return;
    const C = App.coresGrafico();
    const texto = App.cssVar("--cinza-texto", "#5a6b7b");
    const borda = App.cssVar("--chart-borda", "#fff");
    const base = {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: "top", labels: { color: texto, usePointStyle: true } } }
    };
    const projetos = agruparConprem(lotes, r => r.projeto || "Sem projeto", "total_produzido");
    const nomesProjeto = Object.keys(projetos).sort((a, b) => projetos[b] - projetos[a]);
    this.criar("chartProjeto", {
      type: "bar",
      data: { labels: nomesProjeto, datasets: [{
        label: "Dormentes", data: nomesProjeto.map(k => projetos[k]),
        backgroundColor: nomesProjeto.map((_, i) => C.paleta[i % C.paleta.length])
      }] },
      options: { ...base, indexAxis: "y", plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, ticks: { precision: 0, color: texto } },
          y: { ticks: { color: texto } } } }
    });
    const tipos = [
      ["refugo_fissuras", "Fissuras"], ["refugo_vazios", "Vazios"],
      ["refugo_ombreiras", "Ombreiras"], ["refugo_quebras", "Quebras"],
      ["refugo_usp", "USP"], ["refugo_falhas_fabricacao", "Falhas de fabricação"],
      ["refugo_outros", "Outros"]
    ].map(([campo, nome]) => [nome, somaConprem(resumos, campo)]).filter(([, valor]) => valor > 0);
    this.criar("chartRefugos", {
      type: "doughnut",
      data: { labels: tipos.length ? tipos.map(x => x[0]) : ["Sem refugos"],
        datasets: [{ data: tipos.length ? tipos.map(x => x[1]) : [1],
          backgroundColor: tipos.length ? tipos.map((_, i) => C.paleta[i % C.paleta.length]) : [C.cinza],
          borderColor: borda, borderWidth: 2 }] },
      options: { ...base, plugins: { legend: { position: "bottom", labels: { color: texto } } } }
    });
    this.graficoResumo("chartSemanal", agruparResumosConprem(resumos, "semana"));
    this.graficoResumo("chartMensal", agruparResumosConprem(resumos, "mes"));
    const ultimos = lotes.slice().sort((a, b) =>
      String(b.data_fabricacao || "").localeCompare(String(a.data_fabricacao || "")) ||
      String(b.lote || "").localeCompare(String(a.lote || ""))).slice(0, 20).reverse();
    this.criar("chartLote", {
      type: "bar",
      data: { labels: ultimos.map(r => r.lote || "—"),
        datasets: [{ label: "Dormentes", data: ultimos.map(r => Number(r.total_produzido) || 0),
          backgroundColor: C.azulClaro, borderRadius: 4 }] },
      options: { ...base, plugins: { legend: { display: false },
        tooltip: { callbacks: { title: itens => {
          const lote = ultimos[itens[0].dataIndex];
          return "Lote " + (lote.lote || "—") + " · " + (lote.projeto || "Sem projeto");
        } } } },
        scales: { x: { ticks: { color: texto, maxRotation: 55, minRotation: 30 } },
          y: { beginAtZero: true, ticks: { precision: 0, color: texto } } } }
    });
    const status = ["Aprovado", "Reprovado", "Pendente"];
    const valores = status.map(s => ensaios.filter(e => e.resultado === s).length);
    this.criar("chartStatusEnsaios", {
      type: "doughnut",
      data: { labels: valores.some(Boolean) ? status : ["Sem ensaios"], datasets: [{
        data: valores.some(Boolean) ? valores : [1],
        backgroundColor: valores.some(Boolean) ? [C.verde, C.erro, C.amarelo] : [C.cinza],
        borderColor: borda, borderWidth: 2
      }] },
      options: { ...base, plugins: { legend: { position: "bottom", labels: { color: texto } } } }
    });
    const porSemana = {};
    ensaios.forEach(ensaio => {
      const rotulo = rotuloSemanaData(ensaio.data_ensaio);
      if (!rotulo) return;
      if (!porSemana[rotulo]) porSemana[rotulo] = { aprovado: 0, reprovado: 0, pendente: 0 };
      const chave = (ensaio.resultado || "Pendente").toLowerCase();
      if (chave in porSemana[rotulo]) porSemana[rotulo][chave] += 1;
    });
    const semanas = Object.keys(porSemana).sort();
    this.criar("chartEnsaiosSemana", {
      type: "bar",
      data: { labels: semanas.map(rotuloSemanaCurto),
        datasets: [
          { label: "Aprovados", data: semanas.map(s => porSemana[s].aprovado), backgroundColor: C.verde },
          { label: "Reprovados", data: semanas.map(s => porSemana[s].reprovado), backgroundColor: C.erro },
          { label: "Pendentes", data: semanas.map(s => porSemana[s].pendente), backgroundColor: C.amarelo }
        ] },
      options: { ...base, scales: { x: { stacked: true, ticks: { color: texto } },
        y: { stacked: true, beginAtZero: true, ticks: { precision: 0, color: texto } } } }
    });
    const planos = agruparResumosConprem(resumos, "semana");
    this.criar("chartPlanejamento", {
      type: "bar",
      data: { labels: planos.map(r => r.rotulo), datasets: [
        { label: "Fabricado", data: planos.map(r => r.fabricado), backgroundColor: C.azulEscuro },
        { label: "Planejado para a semana seguinte", data: planos.map(r => r.planejado),
          backgroundColor: C.verdeClaro }
      ] },
      options: { ...base, scales: { x: { ticks: { color: texto } },
        y: { beginAtZero: true, ticks: { precision: 0, color: texto } } } }
    });
  },

  graficoResumo(id, linhas) {
    const C = App.coresGrafico();
    const texto = App.cssVar("--cinza-texto", "#5a6b7b");
    this.criar(id, {
      data: { labels: linhas.map(r => r.rotulo),
        datasets: [
          { type: "bar", label: "Fabricados", data: linhas.map(r => r.fabricado),
            backgroundColor: C.azulEscuro, borderRadius: 4, yAxisID: "y", order: 3 },
          { type: "bar", label: "Refugos", data: linhas.map(r => r.refugos),
            backgroundColor: C.erro, borderRadius: 4, yAxisID: "y", order: 2 },
          { type: "line", label: "% de refugo",
            data: linhas.map(r => r.fabricado ? r.refugos / r.fabricado * 100 : 0),
            borderColor: C.amarelo, backgroundColor: C.amarelo, tension: 0.25,
            yAxisID: "y1", order: 1 }
        ] },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: { legend: { position: "top", labels: { color: texto, usePointStyle: true } },
          tooltip: { callbacks: { label: item =>
            item.dataset.label === "% de refugo" ?
              item.dataset.label + ": " + percentualConprem(Number(item.raw) / 100) :
              item.dataset.label + ": " + numeroConprem(item.raw) } } },
        scales: {
          x: { ticks: { color: texto, maxRotation: 45, minRotation: 0 } },
          y: { beginAtZero: true, ticks: { precision: 0, color: texto } },
          y1: { beginAtZero: true, position: "right",
            grid: { drawOnChartArea: false },
            ticks: { color: texto, callback: valor => valor + "%" } }
        }
      }
    });
  },

  async carregarAviso() {
    this.avisoCarregando = true;
    this.avisoErro = "";
    this.renderAviso();
    try {
      this.aviso = await StoreSupabase.obterAvisoDashboard();
      this.avisoCarregando = false;
      this.renderAviso();
    } catch (err) {
      console.error("Erro ao carregar avisos Conprem", err);
      this.avisoCarregando = false;
      this.avisoErro = String(err?.message || err) || "Não foi possível carregar os avisos.";
      this.renderAviso();
    }
  },

  async salvarAviso() {
    if (!Auth.permissoesAtuais?.()?.admin) {
      App.toast(Auth.mensagemSemPermissao("editar o quadro de avisos da Conprem"), "erro");
      return;
    }
    const titulo = document.getElementById("avisoDashboardTitulo")?.value.trim() || "Avisos da Conprem";
    const conteudo = document.getElementById("avisoDashboardConteudo")?.value || "";
    this.avisoSalvando = true;
    document.querySelectorAll("[data-aviso-acao]").forEach(botao => { botao.disabled = true; });
    try {
      this.aviso = await StoreSupabase.salvarAvisoDashboard({ titulo, conteudo });
      this.avisoErro = "";
      App.toast("Quadro de avisos salvo no Supabase.");
      this.renderAviso();
    } catch (err) {
      console.error("Erro ao salvar avisos Conprem", err);
      App.toast(U.esc(String(err?.message || err)), "erro");
      document.querySelectorAll("[data-aviso-acao]").forEach(botao => { botao.disabled = false; });
    } finally {
      this.avisoSalvando = false;
    }
  },

  renderAviso() {
    const alvo = document.getElementById("quadroAvisosDashboard");
    if (!alvo) return;
    const cab = '<div class="card-titulo"><span class="acento">Quadro de avisos · Conprem</span></div>';
    if (this.avisoCarregando) {
      alvo.innerHTML = '<div class="card dashboard-aviso-card">' + cab +
        '<div class="vazio compacto">' + ICN.vazioBox +
        "<h3>Carregando avisos</h3><p>Buscando o quadro da Conprem...</p></div></div>";
      return;
    }
    if (this.avisoErro) {
      alvo.innerHTML = '<div class="card dashboard-aviso-card">' + cab +
        '<div class="vazio compacto">' + ICN.alerta +
        "<h3>Não foi possível carregar os avisos</h3><p>" + U.esc(this.avisoErro) +
        '</p><button class="btn btn-secundario btn-sm" type="button" onclick="ConpremDashboard.carregarAviso()">Tentar novamente</button></div></div>';
      return;
    }
    const aviso = this.aviso || {};
    const titulo = aviso.titulo || "Avisos da Conprem";
    const conteudo = aviso.conteudo || "";
    const atualizado = aviso.atualizado_em || aviso.criado_em;
    const admin = !!Auth.permissoesAtuais?.()?.admin;
    const seguro = U.esc(conteudo).trim();
    const publicado = seguro ?
      seguro.split(/\n{2,}/).map(paragrafo => "<p>" +
        paragrafo.replace(/\n/g, "<br>") + "</p>").join("") :
      "<p>Nenhum aviso publicado no momento.</p>";
    const editor = admin ?
      '<div class="dashboard-aviso-editor" data-admin-only><div class="form-grid">' +
      '<div class="campo"><label for="avisoDashboardTitulo">Título do aviso</label>' +
      '<input id="avisoDashboardTitulo" type="text" maxlength="120" value="' +
      U.esc(titulo) + '"></div>' +
      '<div class="campo full"><label for="avisoDashboardConteudo">Conteúdo do quadro</label>' +
      '<textarea id="avisoDashboardConteudo" maxlength="4000" rows="7">' +
      U.esc(conteudo) + "</textarea></div></div>" +
      '<div class="dashboard-aviso-editor-acoes">' +
      '<span class="dashboard-aviso-contador" id="avisoDashboardContador"></span>' +
      '<div class="flex" style="gap:10px;justify-content:flex-end">' +
      '<button class="btn btn-secundario btn-sm" data-aviso-acao type="button" onclick="ConpremDashboard.carregarAviso()">Recarregar</button>' +
      '<button class="btn btn-primario btn-sm" data-aviso-acao type="button" onclick="ConpremDashboard.salvarAviso()">' +
      ICN.check + "Salvar aviso</button></div></div></div>" : "";
    alvo.innerHTML = '<div class="card dashboard-aviso-card">' +
      '<div class="card-titulo dashboard-aviso-titulo"><span class="acento">' +
      U.esc(titulo) + '</span></div><div class="dashboard-aviso-corpo">' +
      '<div class="dashboard-aviso-publicado' + (seguro ? "" : " sem-conteudo") +
      '">' + publicado + '</div><div class="dashboard-aviso-meta">' +
      (atualizado ? "Atualizado em " + U.esc(dataHoraConprem(atualizado)) :
        "Ainda sem atualização salva") + "</div></div>" + editor + "</div>";
    const textarea = document.getElementById("avisoDashboardConteudo");
    const contador = document.getElementById("avisoDashboardContador");
    if (textarea && contador) {
      const atualizar = () => { contador.textContent = textarea.value.length + "/4000 caracteres"; };
      textarea.addEventListener("input", atualizar);
      atualizar();
    }
  }
};

function numeroConprem(valor) {
  return (Number(valor) || 0).toLocaleString("pt-BR");
}

function percentualConprem(valor) {
  return valor == null || !Number.isFinite(Number(valor)) ? "—" :
    (Number(valor) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "%";
}

function somaConprem(registros, campo) {
  return registros.reduce((total, r) => total + (Number(r[campo]) || 0), 0);
}

function pedidoConprem(registro) {
  return String(registro.pedido || registro.pedido_local || "").trim().split(/\s+-\s+/)[0];
}

function semanaRelatorio(registro) {
  return registro.ano && registro.semana ?
    String(registro.ano) + "-S" + String(registro.semana).padStart(2, "0") : "—";
}

function rotuloSemanaData(data) {
  const info = U.semanaOperacionalInfo(data);
  return info.ano && info.semana ?
    String(info.ano) + "-S" + String(info.semana).padStart(2, "0") : "";
}

function rotuloSemanaCurto(chave) {
  return "Sem. " + chave.slice(6) + "/" + chave.slice(0, 4);
}

function agruparConprem(registros, chave, campo) {
  return registros.reduce((mapa, r) => {
    const nome = chave(r);
    mapa[nome] = (mapa[nome] || 0) + (Number(r[campo]) || 0);
    return mapa;
  }, {});
}

function agruparResumosConprem(resumos, periodo) {
  const mapa = new Map();
  resumos.forEach(r => {
    const base = periodo === "mes" ?
      String(r.periodo_inicio || r.data_emissao || "").slice(0, 7) : semanaRelatorio(r);
    if (!base || base === "—") return;
    const projeto = r.projeto || "Sem projeto";
    const chave = base + "|" + projeto;
    if (!mapa.has(chave)) mapa.set(chave, {
      chave, base, projeto, fabricado: 0, refugos: 0, planejado: 0
    });
    const grupo = mapa.get(chave);
    grupo.fabricado += Number(r.qtd_fabricada) || 0;
    grupo.refugos += Number(r.total_refugos) || 0;
    grupo.planejado += Number(r.qtd_planejada) || 0;
  });
  return [...mapa.values()].sort((a, b) => a.chave.localeCompare(b.chave)).map(r => ({
    ...r,
    rotulo: (periodo === "mes" ? r.base.slice(5) + "/" + r.base.slice(0, 4) :
      rotuloSemanaCurto(r.base)) + " · " + r.projeto,
    planejado: r.planejado
  }));
}

function certificadoPendente(valor) {
  const texto = String(valor || "").trim().toLowerCase();
  return !texto || texto === "-" || texto.includes("aguardando");
}

function dataHoraConprem(iso) {
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? String(iso).slice(0, 16).replace("T", " ") :
    data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

document.addEventListener("DOMContentLoaded", () => ConpremDashboard.iniciar());
