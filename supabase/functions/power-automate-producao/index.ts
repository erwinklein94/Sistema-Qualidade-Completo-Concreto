import { createClient } from "npm:@supabase/supabase-js@2.110.5";

type JsonCell = string | number | boolean;
type DatabaseRow = Record<string, unknown>;

const PAGE_SIZE = 1000;
const MAX_ROWS = 5000;
const TOLERANCIA_ENSAIO_28 = 1;

// A planilha do SharePoint acompanha apenas a Cavan. O padrão ilike cobre as
// variações do sufixo da unidade (Cavan SP, Cavan MG...) sem depender de acento.
const FORNECEDOR_FILTRO = "cavan%";

// Rede de segurança contra lotes da Conprem cadastrados com o fornecedor errado:
// a numeração da Cavan começa bem acima de 2000 e ela não produz contratrilho.
const LOTE_MINIMO = 2000;
const TIPOS_DORMENTE_EXCLUIDOS = ["CONTRATRILHO"];

const STATUS = {
  CURA_14: "Em processo de cura (14 dias)",
  CURA_28: "Em processo de cura (28 dias)",
  AGUARDANDO_ENSAIO: "Aguardando ensaio de liberação",
  LIBERADO: "Liberado para transporte",
  ANALISE: "Em análise",
  REPROVADO: "Reprovado",
} as const;

// Mesma ordem e mesmos títulos usados pelo botão Excel da página Produção.
const COLUMNS = [
  "PISTA:",
  "N° PEDIDO",
  "LOTE",
  "PROJETO",
  "TIPO DE DORMENTE",
  "TOTAL DA PRODUÇÃO",
  "DATA DE FABRICAÇÃO:",
  "CURA 14 DIAS",
  "CURA 28 DIAS",
  "COM USP",
  "USP (LOTE)",
  "TIPO DE OMBREIRAS",
  "LOTE OMBREIRAS",
  "TEMPERATURA °C INICIAL",
  "TEMPERATURA °C MEIO",
  "TEMPERATURA °C FINAL",
  "ENSAIO SLUMP TEST (mm) - ÍNICIO PISTA  - ABATIMENTO (230 +-30)",
  "ENSAIO SLUMP TEST (mm) - ÍNICIO PISTA - ESPALHAMENTO",
  "ENSAIO SLUMP TEST (mm) - MEIO PISTA - ABATIMANTO",
  "ENSAIO SLUMP TEST (mm) - MEIO PISTA - ESPALHAMENTO",
  "ENSAIO SLUMP TEST (mm) - FIM PISTA - ABATIMENTO",
  "ENSAIO SLUMP TEST (mm) - FIM PISTA - ESPALHAMENTO",
  "DESPRONTENSÃO INICIO PISTA",
  "DESPRONTENSÃO MEIO PISTA",
  "DESPRONTENSÃO FIM PISTA",
  "TEMPO DE CURA (Horas)",
  "DATAS DE RUPTURAS  7 DIAS (COMP.)",
  "DATAS DE RUPTURAS  14 DIAS (COMP.)",
  "DATAS DE RUPTURAS  14 DIAS (TRAÇÃO)",
  "DATAS DE RUPTURAS  28 DIAS (COMP.)",
  "DATAS DE RUPTURAS  28 DIAS",
  "COMP. AXIAL (MPa) 7 DIAS",
  "COMP. AXIAL (MPa) 14 DIAS",
  "TRAÇÃO NA FLEXÃO 14 DIAS",
  "COMP. AXIAL (MPa) 28 DIAS",
  "TRAÇÃO NA FLEXÃO 28 DIAS",
  "SÉRIE - ENSAIO DE LIBERAÇÃO",
  "ENSAIO NO IAUDITOR",
  "DORMENTES ENSIADOS",
  "DORMENTES A SEREM ANALISADOS",
  "DORMENTES REPROVADOS",
  "TOTAL DA PRODUÇÃO APROVADO:",
  "STATUS",
  "MOTIVO / ESPECIFICAÇÃO",
] as const;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-power-automate-secret",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function env(name: string) {
  return String(Deno.env.get(name) || "").trim();
}

function secretKey() {
  const direct = env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
  if (direct) return direct;
  const dictionary = env("SUPABASE_SECRET_KEYS");
  if (!dictionary) return "";
  try {
    const parsed = JSON.parse(dictionary);
    return String(parsed?.default || Object.values(parsed || {})[0] || "");
  } catch {
    return "";
  }
}

function timingSafeEqual(a: string, b: string) {
  const aa = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  if (aa.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < aa.length; i += 1) diff |= aa[i] ^ bb[i];
  return diff === 0;
}

function authorize(req: Request) {
  const expected = env("POWER_AUTOMATE_PRODUCAO_SECRET");
  const received = req.headers.get("x-power-automate-secret") || "";
  if (!expected) throw new HttpError(503, "O secret da integração ainda não foi configurado.");
  if (!received || !timingSafeEqual(expected, received)) {
    throw new HttpError(401, "Credencial da integração inválida.");
  }
}

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function adminClient() {
  const url = env("SUPABASE_URL");
  const key = secretKey();
  if (!url || !key) throw new Error("Credenciais internas do Supabase indisponíveis.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function readAll(
  table: "producao_lotes" | "ensaios_liberacao",
  select: string,
  orderColumn: string,
  fornecedor?: string,
) {
  const supabase = adminClient();
  const rows: DatabaseRow[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    let query = supabase.from(table).select(select);
    if (fornecedor) query = query.ilike("fornecedor", fornecedor);
    const { data, error } = await query
      .order(orderColumn, { ascending: false, nullsFirst: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data || []) as DatabaseRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
  let counter = supabase.from(table).select("*", { count: "exact", head: true });
  if (fornecedor) counter = counter.ilike("fornecedor", fornecedor);
  const { count, error } = await counter;
  if (error) throw error;
  if ((count || 0) > MAX_ROWS) {
    throw new HttpError(
      413,
      `${table} possui ${count} registros; o limite seguro desta integração é ${MAX_ROWS}.`,
    );
  }
  return rows;
}

function text(value: unknown) {
  return value == null ? "" : String(value);
}

function integer(value: unknown) {
  const parsed = Number.parseInt(text(value).replace(/[^0-9-]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateIso(value: unknown) {
  const valueText = text(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(valueText) ? valueText : "";
}

function dateBr(value: unknown) {
  const iso = dateIso(value);
  if (!iso) return "";
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function addDaysIso(value: unknown, days: number) {
  const iso = dateIso(value);
  if (!iso) return "";
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function ruptureDateBr(row: DatabaseRow, days: number) {
  return dateBr(addDaysIso(row.data_fabricacao, days));
}

function boolSimNao(value: unknown) {
  if (value === true) return "SIM";
  if (value === false) return "NÃO";
  return "";
}

function combined(first: unknown, second: unknown) {
  let cp1 = text(first).trim();
  let cp2 = text(second).trim();
  if (!cp2 && cp1.includes("/")) {
    const index = cp1.indexOf("/");
    cp2 = cp1.slice(index + 1).trim();
    cp1 = cp1.slice(0, index).trim();
  }
  return [cp1, cp2].filter(Boolean).join(" / ");
}

function shoulderLots(row: DatabaseRow) {
  const list = Array.isArray(row.lotes_ombreira)
    ? row.lotes_ombreira.map(text).map((item) => item.trim()).filter(Boolean)
    : [];
  return list.length ? list.join(", ") : text(row.lote_ombreira);
}

function normalize(value: unknown) {
  return text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

// "Contra Trilho", "Contra-Trilho" e "CONTRATRILHO" viram a mesma chave.
function compact(value: unknown) {
  return normalize(value).replace(/ /g, "");
}

// O lote é texto no banco, então a comparação precisa ser numérica: como string,
// "500" seria considerado maior que "2000".
function loteElegivel(row: DatabaseRow) {
  const digits = text(row.lote).replace(/\D/g, "");
  const numero = digits ? Number.parseInt(digits, 10) : Number.NaN;
  if (!Number.isFinite(numero) || numero < LOTE_MINIMO) return false;
  const tipo = compact(row.tipo_dormente);
  return !TIPOS_DORMENTE_EXCLUIDOS.some((excluido) => tipo.includes(excluido));
}

function normalizeStatus(value: unknown) {
  const map: Record<string, string> = {
    "LIBERADO PARA TRANSPORTE": STATUS.LIBERADO,
    "LIBERADO PARA ENTREGA": STATUS.LIBERADO,
    "ENTREGUE": STATUS.LIBERADO,
    "EM PROCESSO DE CURA": STATUS.CURA_14,
    "EM PROCESSO DE CURA 14 DIAS": STATUS.CURA_14,
    "CURA 14 DIAS": STATUS.CURA_14,
    "EM PROCESSO DE CURA 28 DIAS": STATUS.CURA_28,
    "CURA 28 DIAS": STATUS.CURA_28,
    "AGUARDANDO ENSAIO DE LIBERACAO": STATUS.AGUARDANDO_ENSAIO,
    "AGUARDANDO ENSAIO LIBERACAO": STATUS.AGUARDANDO_ENSAIO,
    "AGUARDANDO LIBERACAO": STATUS.AGUARDANDO_ENSAIO,
    "EM ANALISE": STATUS.ANALISE,
    "BLOQUEADO": STATUS.ANALISE,
    "REPROVADO": STATUS.REPROVADO,
  };
  return map[normalize(value)] || text(value);
}

function productionTests(row: DatabaseRow, tests: DatabaseRow[]) {
  const lot = normalize(row.lote);
  const supplier = normalize(row.fornecedor);
  const project = normalize(row.projeto);
  const gauge = normalize(row.bitola);
  return tests.filter((test) => {
    if (row.id && test.producao_lote_id && text(test.producao_lote_id) === text(row.id)) return true;
    if (!lot || normalize(test.lote_ensaiado) !== lot) return false;
    if (supplier && test.fornecedor && normalize(test.fornecedor) !== supplier) return false;
    if (project && test.projeto && normalize(test.projeto) !== project) return false;
    if (gauge && test.bitola && normalize(test.bitola) !== gauge) return false;
    return true;
  });
}

function sortedTests(tests: DatabaseRow[], ascending: boolean) {
  return tests.slice().sort((a, b) => {
    const direction = ascending ? 1 : -1;
    return direction * (
      dateIso(a.data_ensaio).localeCompare(dateIso(b.data_ensaio)) ||
      text(a.criado_em).localeCompare(text(b.criado_em))
    );
  });
}

function counterTestDecision(tests: DatabaseRow[]) {
  const decided = sortedTests(
    tests.filter((test) => ["Aprovado", "Reprovado"].includes(text(test.resultado))),
    true,
  );
  if (text(decided[0]?.resultado) !== "Reprovado") return "";
  const counterTests = decided.slice(1);
  if (counterTests.some((test) => text(test.resultado) === "Reprovado")) return STATUS.REPROVADO;
  if (counterTests.filter((test) => text(test.resultado) === "Aprovado").length >= 2) {
    return STATUS.LIBERADO;
  }
  return STATUS.ANALISE;
}

function automaticStatus(row: DatabaseRow, allTests: DatabaseRow[]) {
  const current = normalizeStatus(row.status);
  const cure14 = dateIso(row.cura_14) || addDaysIso(row.data_fabricacao, 14);
  const cure28 = dateIso(row.cura_28) || addDaysIso(row.data_fabricacao, 28);
  const today = new Date().toISOString().slice(0, 10);
  const cure28Minimum = cure28 ? addDaysIso(cure28, -TOLERANCIA_ENSAIO_28) : "";
  const linked = productionTests(row, allTests);
  const decisionTests = row.cura_termica
    ? linked.filter((test) => dateIso(test.data_ensaio) && dateIso(test.data_ensaio) >= cure28Minimum)
    : linked;
  const lastTest = sortedTests(decisionTests, false)[0];
  const counterDecision = counterTestDecision(decisionTests);

  if (counterDecision) return counterDecision;
  if (text(lastTest?.resultado) === "Aprovado") return STATUS.LIBERADO;
  if (text(lastTest?.resultado) === "Pendente") return STATUS.ANALISE;
  if (text(lastTest?.resultado) === "Reprovado") {
    if (cure28Minimum && dateIso(lastTest?.data_ensaio) >= cure28Minimum) return STATUS.REPROVADO;
    if (cure28 && today < cure28) return STATUS.CURA_28;
    return STATUS.AGUARDANDO_ENSAIO;
  }
  if (integer(row.dorm_a_analisar) > 0) return STATUS.ANALISE;
  if (integer(row.total_aprovado) > 0) return STATUS.LIBERADO;
  if (
    current === STATUS.LIBERADO ||
    current === STATUS.REPROVADO ||
    current === STATUS.ANALISE
  ) return current;
  if (integer(row.dorm_reprovados) > 0) {
    if (cure28 && today < cure28) return STATUS.CURA_28;
    return STATUS.AGUARDANDO_ENSAIO;
  }
  if (dateIso(row.data_fabricacao)) {
    if (cure14 && today < cure14) return STATUS.CURA_14;
    return STATUS.AGUARDANDO_ENSAIO;
  }
  return current;
}

function excelRow(row: DatabaseRow, tests: DatabaseRow[]): JsonCell[] {
  const cure14 = dateBr(row.cura_14);
  const cure28 = dateBr(row.cura_28);
  return [
    text(row.pista),
    text(row.pedido),
    text(row.lote),
    text(row.projeto),
    text(row.tipo_dormente),
    integer(row.total_produzido),
    dateBr(row.data_fabricacao),
    cure14,
    cure28,
    boolSimNao(row.com_usp),
    text(row.usp_lote),
    text(row.tipo_ombreira),
    shoulderLots(row),
    text(row.temp_inicial),
    text(row.temp_meio),
    text(row.temp_final),
    text(row.slump_inicial_abatimento),
    text(row.slump_inicial_espalhamento),
    text(row.slump_meio_abatimento),
    text(row.slump_meio_espalhamento),
    text(row.slump_final_abatimento),
    text(row.slump_final_espalhamento),
    text(row.despro_ini),
    text(row.despro_meio),
    text(row.despro_fim),
    text(row.tempo_cura),
    ruptureDateBr(row, 7),
    cure14 || ruptureDateBr(row, 14),
    cure14 || ruptureDateBr(row, 14),
    cure28 || ruptureDateBr(row, 28),
    cure28 || ruptureDateBr(row, 28),
    combined(row.comp_7, row.comp_7_cp2),
    combined(row.comp_14, row.comp_14_cp2),
    combined(row.tracao_14, row.tracao_14_cp2),
    combined(row.comp_28, row.comp_28_cp2),
    combined(row.tracao_28, row.tracao_28_cp2),
    text(row.serie),
    text(row.iauditor),
    integer(row.dorm_ensaiados),
    integer(row.dorm_a_analisar),
    integer(row.dorm_reprovados),
    integer(row.total_aprovado),
    automaticStatus(row, tests),
    text(row.motivo),
  ];
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Use GET." }, 405);

  try {
    authorize(req);
    const [lotes, tests] = await Promise.all([
      readAll("producao_lotes", "*", "data_fabricacao", FORNECEDOR_FILTRO),
      readAll(
        "ensaios_liberacao",
        "id,producao_lote_id,data_ensaio,fornecedor,projeto,bitola,lote_ensaiado,resultado,criado_em",
        "data_ensaio",
      ),
    ]);
    const production = lotes.filter(loteElegivel);
    return json({
      generatedAt: new Date().toISOString(),
      source: "Supabase/public.producao_lotes (fornecedor Cavan)",
      filtros: {
        fornecedor: "Cavan",
        loteMinimo: LOTE_MINIMO,
        tiposExcluidos: TIPOS_DORMENTE_EXCLUIDOS,
      },
      tableName: "tbProducaoSite",
      columns: COLUMNS,
      total: production.length,
      rows: production.map((row) => excelRow(row, tests)),
    });
  } catch (error) {
    console.error(error);
    const status = error instanceof HttpError ? error.status : 500;
    return json({ error: errorMessage(error) }, status);
  }
});
