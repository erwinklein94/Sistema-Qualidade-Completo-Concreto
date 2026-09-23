const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const codigo = fs.readFileSync(path.join(__dirname, "..", "js", "conprem-dashboard.js"), "utf8");

function contexto(perfil = "consulta") {
  const elementos = new Map();
  const document = {
    addEventListener() {},
    querySelectorAll() { return []; },
    getElementById(id) {
      if (!elementos.has(id)) elementos.set(id, {
        value: "", innerHTML: "", addEventListener() {}
      });
      return elementos.get(id);
    }
  };
  const ctx = vm.createContext({
    document, window: {}, console,
    Auth: { permissoesAtuais: () => ({ admin: perfil === "admin" }),
      mensagemSemPermissao: () => "Sem permissão" },
    App: { cssVar: (_, fallback) => fallback, coresGrafico: () => ({}), toast() {} },
    StoreSupabase: {},
    U: {
      esc: valor => String(valor == null ? "" : valor)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
      dataBR: valor => valor || "—",
      semanaOperacionalInfo: () => ({}),
      isoLocal: () => "2026-09-23"
    },
    CFG: { cores: {} }, ICN: { vazioBox: "", alerta: "", check: "" }
  });
  vm.runInContext(codigo, ctx);
  return { ctx, elementos, document };
}

test("resumos somam fabricado e refugo por semana e projeto, sem usar lotes", () => {
  const { ctx } = contexto();
  const dados = [
    { ano: 2026, semana: 38, projeto: "MALHA CENTRAL", periodo_inicio: "2026-09-14",
      qtd_fabricada: 285, total_refugos: 1, qtd_planejada: 0 },
    { ano: 2026, semana: 38, projeto: "MALHA CENTRAL", periodo_inicio: "2026-09-15",
      qtd_fabricada: 707, total_refugos: 1, qtd_planejada: 1116 },
    { ano: 2026, semana: 38, projeto: "FERRO NORTE", periodo_inicio: "2026-09-14",
      qtd_fabricada: 868, total_refugos: 4, qtd_planejada: 1116 }
  ];
  ctx.dados = dados;
  const grupos = JSON.parse(vm.runInContext(
    "JSON.stringify(agruparResumosConprem(dados, 'semana'))", ctx));
  assert.equal(grupos.length, 2);
  assert.deepEqual(
    grupos.filter(g => g.projeto === "MALHA CENTRAL")
      .map(g => [g.fabricado, g.refugos, g.planejado]),
    [[992, 2, 1116]]
  );
});

test("filtros de período respeitam data do lote, ensaio e intervalo do resumo", () => {
  const { ctx } = contexto();
  for (const id of ["fProjeto", "fBitola", "fPedido", "fPeriodoIni", "fPeriodoFim"]) {
    ctx.document.getElementById(id);
  }
  ctx.document.getElementById("fProjeto").value = "FERRO NORTE";
  ctx.document.getElementById("fPedido").value = "4502047525";
  ctx.document.getElementById("fPeriodoIni").value = "2026-09-14";
  ctx.document.getElementById("fPeriodoFim").value = "2026-09-20";
  ctx.lotes = [
    { projeto: "FERRO NORTE", pedido: "4502047525", data_fabricacao: "2026-09-15" },
    { projeto: "FERRO NORTE", pedido: "4502047525", data_fabricacao: "2026-09-10" }
  ];
  ctx.ensaios = [
    { projeto: "FERRO NORTE", pedido: "4502047525", data_ensaio: "2026-09-16" },
    { projeto: "MALHA CENTRAL", pedido: "4502047513", data_ensaio: "2026-09-16" }
  ];
  ctx.resumos = [
    { projeto: "FERRO NORTE", pedido_local: "4502047525 - CHAPADÃO",
      periodo_inicio: "2026-09-13", periodo_fim: "2026-09-16" },
    { projeto: "FERRO NORTE", pedido_local: "4502047525 - CHAPADÃO",
      periodo_inicio: "2026-09-21", periodo_fim: "2026-09-27" }
  ];
  const counts = JSON.parse(vm.runInContext(
    "ConpremDashboard.lotes = lotes; ConpremDashboard.ensaios = ensaios; " +
    "ConpremDashboard.resumos = resumos; " +
    "JSON.stringify(Object.fromEntries(Object.entries(ConpremDashboard.recorte()).map(([k,v]) => [k,v.length])))", ctx));
  assert.deepEqual(counts, { lotes: 1, ensaios: 1, resumos: 1 });
});

test("quadro de avisos exibe conteúdo seguro e editor só para admin", () => {
  const publico = contexto("consulta");
  vm.runInContext(
    "ConpremDashboard.avisoCarregando = false; " +
    "ConpremDashboard.aviso = { titulo: '<script>teste</script>', conteudo: 'Mensagem\\n<script>x</script>' }; " +
    "ConpremDashboard.renderAviso()", publico.ctx);
  const htmlPublico = publico.document.getElementById("quadroAvisosDashboard").innerHTML;
  assert.match(htmlPublico, /&lt;script&gt;teste/);
  assert.match(htmlPublico, /Mensagem<br>&lt;script&gt;x/);
  assert.doesNotMatch(htmlPublico, /avisoDashboardConteudo/);

  const admin = contexto("admin");
  vm.runInContext("ConpremDashboard.avisoCarregando = false; ConpremDashboard.renderAviso()", admin.ctx);
  assert.match(admin.document.getElementById("quadroAvisosDashboard").innerHTML,
    /avisoDashboardConteudo/);
});

test("certificados pendentes consideram apenas lotes do mapa", () => {
  const { ctx } = contexto();
  const html = vm.runInContext("ConpremDashboard.htmlPendencias([" +
    "{total_produzido:100}," +
    "{ordem_fabricacao:'OF-1',total_produzido:20,aco_cert_externo:'Aguardando'," +
    "cimento_cert_externo:'N/A',areia_cert_externo:'123',brita_cert_externo:'123'," +
    "aditivo_cert_externo:'123',adicao_cert_externo:'123'}])", ctx);
  assert.match(html, /Aço/);
  assert.match(html, />20</);
  assert.doesNotMatch(html, /Cimento<\/strong>/);
  assert.doesNotMatch(html, />120</);
});
