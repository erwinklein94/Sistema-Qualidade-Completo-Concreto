import { createClient } from "npm:@supabase/supabase-js@2.110.5";

type DatabaseRow = Record<string, unknown>;

const PAGE_SIZE = 1000;
const MAX_ROWS = 5000;

// A aba REPROVADOS_CAVAN acompanha apenas a Cavan. As reprovas da Conprem
// ficam em conprem_reprovados, mas o filtro protege contra cadastro trocado.
const FORNECEDOR_FILTRO = "cavan%";

const SELECT = [
  "id",
  "fornecedor",
  "semana",
  "ano",
  "data_producao",
  "periodo_inicio",
  "periodo_fim",
  "lote",
  "projeto",
  "tipo",
  "molde",
  "cavidade",
  "motivo_detalhado",
  "motivo_indicador",
  "total_refugos",
].join(",");

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

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Mesmo segredo do fluxo da Produção, salvo que um exclusivo seja configurado:
// o consumidor é o mesmo Power Automate e os dados são só de leitura.
function authorize(req: Request) {
  const expected = env("POWER_AUTOMATE_REPROVADOS_SECRET") || env("POWER_AUTOMATE_PRODUCAO_SECRET");
  const received = req.headers.get("x-power-automate-secret") || "";
  if (!expected) throw new HttpError(503, "O secret da integração ainda não foi configurado.");
  if (!received || !timingSafeEqual(expected, received)) {
    throw new HttpError(401, "Credencial da integração inválida.");
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

async function readAll() {
  const supabase = adminClient();
  const rows: DatabaseRow[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("reprovados")
      .select(SELECT)
      .ilike("fornecedor", FORNECEDOR_FILTRO)
      .order("data_producao", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data || []) as DatabaseRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
  const { count, error } = await supabase
    .from("reprovados")
    .select("*", { count: "exact", head: true })
    .ilike("fornecedor", FORNECEDOR_FILTRO);
  if (error) throw error;
  if ((count || 0) > MAX_ROWS) {
    throw new HttpError(
      413,
      `reprovados possui ${count} registros da Cavan; o limite seguro desta integração é ${MAX_ROWS}.`,
    );
  }
  return rows;
}

function text(value: unknown) {
  return value == null ? "" : String(value).trim();
}

function integer(value: unknown) {
  const parsed = Number.parseInt(text(value).replace(/[^0-9-]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateIso(value: unknown) {
  const valueText = text(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(valueText) ? valueText : "";
}

function utc(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function isoOf(date: Date) {
  return date.toISOString().slice(0, 10);
}

function firstThursday(year: number) {
  const date = new Date(Date.UTC(year, 0, 1));
  while (date.getUTCDay() !== 4) date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

// Réplica de U.semanaOperacionalInfo (js/comum.js): semana de quinta a quarta,
// numerada pela quinta-feira seguinte, que é a de fechamento/referência.
function operationalWeek(iso: string) {
  if (!iso) return null;
  const start = utc(iso);
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() - 4 + 7) % 7));
  const end = new Date(start.valueOf());
  end.setUTCDate(end.getUTCDate() + 6);
  const reference = new Date(start.valueOf());
  reference.setUTCDate(reference.getUTCDate() + 7);
  let year = reference.getUTCFullYear();
  let first = firstThursday(year);
  if (reference < first) {
    year -= 1;
    first = firstThursday(year);
  }
  const week = 1 + Math.floor((reference.valueOf() - first.valueOf()) / 604_800_000);
  return { semana: week, ano: year, inicio: isoOf(start), fim: isoOf(end) };
}

// Réplica de U.periodoReprova: a semana é a da data de produção do dormente e
// só cai no período gravado quando a reprova não tem data de produção.
function rejectionPeriod(row: DatabaseRow) {
  const production = dateIso(row.data_producao);
  return operationalWeek(production) ||
    operationalWeek(dateIso(row.periodo_inicio) || dateIso(row.periodo_fim));
}

function record(row: DatabaseRow) {
  const period = rejectionPeriod(row);
  return {
    id: text(row.id),
    semana: period?.semana ?? integer(row.semana),
    ano: period?.ano ?? integer(row.ano),
    semanaInicio: period?.inicio ?? "",
    semanaFim: period?.fim ?? "",
    dataProducao: dateIso(row.data_producao),
    lote: text(row.lote),
    projeto: text(row.projeto),
    tipo: text(row.tipo),
    molde: text(row.molde),
    cavidade: text(row.cavidade),
    motivoDetalhado: text(row.motivo_detalhado),
    motivoIndicador: text(row.motivo_indicador),
    // Mesma regra da tela: reprova sem quantidade conta como um dormente.
    totalRefugos: integer(row.total_refugos) || 1,
  };
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
    const rows = (await readAll()).map(record);
    return json({
      generatedAt: new Date().toISOString(),
      source: "Supabase/public.reprovados (fornecedor Cavan)",
      total: rows.length,
      registros: rows,
    });
  } catch (error) {
    console.error(error);
    const status = error instanceof HttpError ? error.status : 500;
    return json({ error: errorMessage(error) }, status);
  }
});
