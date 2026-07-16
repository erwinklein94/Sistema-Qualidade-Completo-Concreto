import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.110.5";
import { corsHeaders as supabaseCorsHeaders } from "npm:@supabase/supabase-js@2.110.5/cors";

const SAFETYCULTURE_BASE_URL = "https://api.safetyculture.io";
const DESTINOS = [
  "inspecoes_pista",
  "inspecoes_concretagem",
  "ensaios_bitola",
  "ensaios_arrancamento_usp",
  "ensaios_liberacao",
  "ensaios_acompanhamento",
] as const;

type Destino = typeof DESTINOS[number];
type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type TemplateConfig = {
  template_id: string;
  nome: string;
  destino: Destino | null;
  ativo: boolean;
  auto_classificado?: boolean;
  mapeamento?: Record<string, string[] | string>;
};
type AuditSearchRow = {
  audit_id: string;
  modified_at?: string;
  template_id?: string;
};
type Answer = {
  itemId: string;
  label: string;
  section: string;
  value: string;
};

const corsHeaders = {
  ...supabaseCorsHeaders,
  "Access-Control-Allow-Headers": `${supabaseCorsHeaders["Access-Control-Allow-Headers"]}, x-cron-secret, x-supabase-api-version`,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
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

function adminClient() {
  const url = env("SUPABASE_URL");
  const key = secretKey();
  if (!url || !key) throw new Error("Secrets internos do Supabase não estão disponíveis na Edge Function.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function authorize(req: Request, supabase: SupabaseClient) {
  const cronSecret = env("SAFETYCULTURE_CRON_SECRET");
  const receivedCronSecret = req.headers.get("x-cron-secret") || "";
  if (cronSecret && receivedCronSecret && timingSafeEqual(cronSecret, receivedCronSecret)) {
    return { kind: "cron" as const, userId: null };
  }

  const authorization = req.headers.get("authorization") || "";
  const jwt = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) throw new HttpError(401, "Sessão Supabase não informada.");

  const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
  if (userError || !userData?.user?.id) throw new HttpError(401, "Sessão Supabase inválida ou expirada.");

  const { data: profile, error: profileError } = await supabase
    .from("usuarios_app")
    .select("perfil,ativo")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile?.ativo || normalize(profile.perfil) !== "admin") {
    throw new HttpError(403, "Somente administradores podem sincronizar o SafetyCulture.");
  }
  return { kind: "user" as const, userId: userData.user.id };
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

async function safetyCultureFetch(path: string, init: RequestInit = {}) {
  const token = env("SAFETYCULTURE_API_TOKEN");
  if (!token) throw new HttpError(503, "O secret SAFETYCULTURE_API_TOKEN ainda não foi configurado.");
  let lastError = "";

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${SAFETYCULTURE_BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...(init.headers || {}),
      },
    });

    if (response.ok) {
      const contentType = response.headers.get("content-type") || "";
      return contentType.includes("application/json") ? await response.json() : await response.text();
    }

    lastError = (await response.text()).slice(0, 1200);
    if (response.status !== 429 || attempt === 3) {
      throw new HttpError(
        response.status,
        `SafetyCulture respondeu ${response.status}: ${lastError || response.statusText}`,
      );
    }

    const retryAfter = Number(response.headers.get("retry-after") || "0");
    const reset = Number(response.headers.get("x-ratelimit-reset") || "0");
    const resetDelay = reset > 0 ? Math.max(0, reset * 1000 - Date.now()) : 0;
    await delay(Math.min(10000, Math.max(1000, retryAfter * 1000, resetDelay)));
  }
  throw new Error(lastError || "Falha ao acessar o SafetyCulture.");
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function discoverTemplates(supabase: SupabaseClient) {
  const payload = await safetyCultureFetch(
    "/templates/search?field=template_id&field=name&field=modified_at&limit=1000&archived=false",
  ) as Record<string, unknown>;
  const templates = (payload?.templates || payload?.audits || []) as Array<Record<string, unknown>>;

  const { data: existing, error: existingError } = await supabase
    .from("safeculture_templates")
    .select("template_id,nome,destino,ativo,auto_classificado,mapeamento");
  if (existingError) throw existingError;
  const existingMap = new Map((existing || []).map((row) => [row.template_id, row]));

  const rows = templates
    .map((item) => {
      const templateId = String(item.template_id || item.id || "").trim();
      const name = String(item.name || item.title || templateId).trim();
      if (!templateId) return null;
      const current = existingMap.get(templateId);
      const inferred = inferDestination(name);
      const alreadyConfigured = Boolean(current?.destino);
      return {
        template_id: templateId,
        nome: name,
        destino: current?.destino || inferred,
        ativo: alreadyConfigured ? current?.ativo : Boolean(inferred),
        auto_classificado: alreadyConfigured ? current?.auto_classificado : Boolean(inferred),
        mapeamento: current?.mapeamento || {},
      };
    })
    .filter(Boolean);

  if (rows.length) {
    const { error } = await supabase
      .from("safeculture_templates")
      .upsert(rows, { onConflict: "template_id" });
    if (error) throw error;
  }

  const { data: saved, error: savedError } = await supabase
    .from("safeculture_templates")
    .select("*")
    .order("nome");
  if (savedError) throw savedError;
  return saved || [];
}

function inferDestination(text: string): Destino | null {
  const value = normalize(text);
  if (!value) return null;
  if (value.includes("CONCRETAGEM") || value.includes("SLUMP")) return "inspecoes_concretagem";
  if (value.includes("INSPECAO DE PISTA") || value.includes("INSPECAO PISTA")) return "inspecoes_pista";
  if (value.includes("ARRANCAMENTO") || (value.includes("ENSAIO") && value.includes("USP"))) {
    return "ensaios_arrancamento_usp";
  }
  if (value.includes("BITOLA") && value.includes("ENSAIO")) return "ensaios_bitola";
  if (value.includes("ACOMPANHAMENTO") || value.includes("14 DIAS") || value.includes("APOS OS 14")) {
    return "ensaios_acompanhamento";
  }
  if (
    value.includes("LIBERACAO") ||
    value.includes("ENSAIO ESTRUTURAL") ||
    value.includes("FISSURACAO") ||
    value.includes("MOMENTO DE") ||
    (value.includes("ENSAIO") && value.includes("DORMENTE DE CONCRETO"))
  ) return "ensaios_liberacao";
  return null;
}

async function getStatus(supabase: SupabaseClient) {
  const [{ data: state, error: stateError }, { data: templates, error: templatesError }, {
    data: runs,
    error: runsError,
  }] = await Promise.all([
    supabase.from("safeculture_estado_sync").select("*").eq("id", true).maybeSingle(),
    supabase.from("safeculture_templates").select("*").order("nome"),
    supabase.from("safeculture_sincronizacoes").select("*").order("iniciado_em", { ascending: false }).limit(10),
  ]);
  if (stateError) throw stateError;
  if (templatesError) throw templatesError;
  if (runsError) throw runsError;

  const { count: pending } = await supabase
    .from("safeculture_inspecoes")
    .select("*", { count: "exact", head: true })
    .in("status_processamento", ["pendente", "erro"]);

  return {
    configured: Boolean(env("SAFETYCULTURE_API_TOKEN")),
    state,
    templates: templates || [],
    runs: runs || [],
    pending: pending || 0,
  };
}

async function runSync(
  supabase: SupabaseClient,
  auth: { kind: "cron" | "user"; userId: string | null },
  input: Record<string, unknown>,
) {
  const originInput = String(input.origin || (auth.kind === "cron" ? "cron" : "manual"));
  const origin = ["manual", "cron", "reprocessamento"].includes(originInput) ? originInput : "manual";
  const { data: run, error: runError } = await supabase
    .from("safeculture_sincronizacoes")
    .insert({ origem: origin, solicitado_por: auth.userId })
    .select("*")
    .single();
  if (runError) throw runError;

  const counters = { encontrados: 0, inseridos: 0, atualizados: 0, ignorados: 0, erros: 0 };
  const errorDetails: Array<Record<string, unknown>> = [];

  try {
    let { data: templates, error: templatesError } = await supabase
      .from("safeculture_templates")
      .select("*")
      .eq("ativo", true)
      .not("destino", "is", null);
    if (templatesError) throw templatesError;

    if (!templates?.length) {
      await discoverTemplates(supabase);
      const result = await supabase
        .from("safeculture_templates")
        .select("*")
        .eq("ativo", true)
        .not("destino", "is", null);
      if (result.error) throw result.error;
      templates = result.data || [];
    }

    if (!templates.length) {
      throw new HttpError(
        409,
        "Nenhum template foi reconhecido automaticamente. Abra Dados do Sistema e indique o destino dos templates.",
      );
    }

    const { data: state, error: stateError } = await supabase
      .from("safeculture_estado_sync")
      .select("*")
      .eq("id", true)
      .single();
    if (stateError) throw stateError;

    const windowHours = positiveNumber(input.window_hours);
    const explicitSince = validDate(input.modified_after);
    const initialDays = positiveNumber(env("SAFETYCULTURE_INITIAL_DAYS")) || 30;
    const overlapMinutes = Number(state.sobreposicao_minutos || 5);
    let checkpoint = explicitSince;
    if (!checkpoint && windowHours) checkpoint = new Date(Date.now() - windowHours * 3600000).toISOString();
    if (!checkpoint && state.ultima_modificacao_lida) {
      checkpoint = new Date(
        new Date(state.ultima_modificacao_lida).getTime() - overlapMinutes * 60000,
      ).toISOString();
    }
    if (!checkpoint) checkpoint = new Date(Date.now() - initialDays * 86400000).toISOString();

    await supabase
      .from("safeculture_sincronizacoes")
      .update({ checkpoint_inicial: checkpoint })
      .eq("id", run.id);

    const audits = await searchInspections(
      checkpoint,
      (templates as TemplateConfig[]).map((template) => template.template_id),
    );
    const maxInspections = Math.min(500, positiveNumber(input.max_inspections) || 100);
    const selected = audits.slice(0, maxInspections);
    counters.encontrados = audits.length;
    const templateMap = new Map(
      (templates as TemplateConfig[]).map((template) => [template.template_id, template]),
    );

    let maxModified = checkpoint;
    for (let index = 0; index < selected.length; index += 5) {
      const batch = selected.slice(index, index + 5);
      const results = await Promise.all(batch.map(async (audit) => {
        try {
          return { audit, result: await processAudit(supabase, audit, templateMap), error: null };
        } catch (error) {
          await supabase.from("safeculture_inspecoes").upsert({
            audit_id: audit.audit_id,
            audit_uuid: auditIdToUuid(audit.audit_id),
            template_id: audit.template_id || null,
            modificado_em_safeculture: audit.modified_at || null,
            status_processamento: "erro",
            erro_processamento: errorMessage(error),
            atualizado_em: new Date().toISOString(),
          }, { onConflict: "audit_id" });
          return { audit, result: null, error };
        }
      }));

      for (const item of results) {
        if (item.error) {
          counters.erros += 1;
          errorDetails.push({
            audit_id: item.audit.audit_id,
            template_id: item.audit.template_id,
            erro: errorMessage(item.error),
          });
          continue;
        }
        if (item.result === "inserted") counters.inseridos += 1;
        else if (item.result === "updated") counters.atualizados += 1;
        else counters.ignorados += 1;
        if (item.audit.modified_at && item.audit.modified_at > maxModified) {
          maxModified = item.audit.modified_at;
        }
      }
    }

    if (audits.length > maxInspections) {
      counters.erros += 1;
      errorDetails.push({
        erro: `A API retornou ${audits.length} inspeções; esta execução processou ${maxInspections}. Execute novamente para continuar.`,
      });
    }

    const status = counters.erros ? "parcial" : "sucesso";
    const checkpointFinal = counters.erros ? null : maxModified;
    const advancesCheckpoint = status === "sucesso" && origin !== "reprocessamento";
    const now = new Date().toISOString();
    await supabase.from("safeculture_sincronizacoes").update({
      ...counters,
      status,
      finalizado_em: now,
      checkpoint_final: checkpointFinal,
      detalhes_erros: errorDetails,
      mensagem: status === "sucesso"
        ? "Sincronização concluída."
        : "Sincronização concluída com pendências; o checkpoint não avançou.",
    }).eq("id", run.id);

    await supabase.from("safeculture_estado_sync").update({
      ultima_execucao_id: run.id,
      ultima_sincronizacao_ok: status === "sucesso" ? now : state.ultima_sincronizacao_ok,
      ultima_modificacao_lida: advancesCheckpoint ? maxModified : state.ultima_modificacao_lida,
      atualizado_em: now,
    }).eq("id", true);

    return { run_id: run.id, status, ...counters, detalhes_erros: errorDetails };
  } catch (error) {
    await supabase.from("safeculture_sincronizacoes").update({
      ...counters,
      status: "erro",
      finalizado_em: new Date().toISOString(),
      erros: Math.max(1, counters.erros),
      detalhes_erros: [...errorDetails, { erro: errorMessage(error) }],
      mensagem: errorMessage(error),
    }).eq("id", run.id);
    throw error;
  }
}

async function searchInspections(modifiedAfter: string, templateIds: string[]) {
  const params = new URLSearchParams();
  params.append("field", "audit_id");
  params.append("field", "modified_at");
  params.append("field", "template_id");
  params.set("modified_after", modifiedAfter);
  params.set("completed", "true");
  params.set("archived", "false");
  params.set("order", "asc");
  params.set("limit", "1000");
  templateIds.forEach((id) => params.append("template", id));
  const payload = await safetyCultureFetch(`/audits/search?${params.toString()}`) as Record<string, unknown>;
  return ((payload?.audits || []) as AuditSearchRow[]).filter((audit) => audit?.audit_id);
}

async function getInspection(auditId: string) {
  const uuid = auditIdToUuid(auditId);
  if (uuid) {
    try {
      return await safetyCultureFetch(
        `/inspections/v1/inspections/${uuid}/details?include_media_url=false`,
      ) as Record<string, unknown>;
    } catch (error) {
      if (!(error instanceof HttpError) || ![400, 403, 404, 405].includes(error.status)) throw error;
    }
  }
  return await safetyCultureFetch(`/audits/${encodeURIComponent(auditId)}`) as Record<string, unknown>;
}

async function getWebReportLink(auditId: string) {
  try {
    const payload = await safetyCultureFetch(
      `/audits/${encodeURIComponent(auditId)}/web_report_link`,
    ) as Record<string, unknown>;
    return String(payload?.url || payload?.web_report_link || payload?.link || "").trim();
  } catch {
    return "";
  }
}

async function processAudit(
  supabase: SupabaseClient,
  audit: AuditSearchRow,
  templateMap: Map<string, TemplateConfig>,
) {
  const inspection = await getInspection(audit.audit_id);
  const templateId = String(
    audit.template_id ||
    getDeep(inspection, ["template_id"]) ||
    getDeep(inspection, ["inspection", "template_id"]) ||
    "",
  );
  const template = templateMap.get(templateId);
  if (!template?.destino || !DESTINOS.includes(template.destino)) {
    await supabase.from("safeculture_inspecoes").upsert({
      audit_id: audit.audit_id,
      audit_uuid: auditIdToUuid(audit.audit_id),
      template_id: templateId || null,
      destino: null,
      nome: inspectionName(inspection),
      status_processamento: "ignorado",
      modificado_em_safeculture: audit.modified_at || inspectionModifiedAt(inspection),
      payload: inspection as Json,
      erro_processamento: "Template sem destino ativo.",
      atualizado_em: new Date().toISOString(),
    }, { onConflict: "audit_id" });
    return "ignored";
  }

  const answers = flattenAnswers(inspection);
  const reportLink = await getWebReportLink(audit.audit_id);
  const mapped = await mapToDestination(supabase, template, audit, inspection, answers, reportLink);
  const auditData = rootInspection(inspection);

  const { error: pendingRawError } = await supabase.from("safeculture_inspecoes").upsert({
    audit_id: audit.audit_id,
    audit_uuid: auditIdToUuid(audit.audit_id),
    template_id: templateId,
    destino: template.destino,
    nome: inspectionName(inspection),
    status_processamento: "pendente",
    criado_em_safeculture: validDate(auditData?.created_at) || null,
    modificado_em_safeculture: audit.modified_at || inspectionModifiedAt(inspection) || null,
    concluido_em_safeculture: inspectionCompletedAt(inspection) || null,
    web_report_url: reportLink || null,
    payload: inspection as Json,
    erro_processamento: null,
    atualizado_em: new Date().toISOString(),
  }, { onConflict: "audit_id" });
  if (pendingRawError) throw pendingRawError;

  const { data: existing } = await supabase
    .from(template.destino)
    .select("id")
    .eq("safeculture_audit_id", audit.audit_id)
    .maybeSingle();

  const { data: saved, error: saveError } = await supabase
    .from(template.destino)
    .upsert(mapped, { onConflict: "safeculture_audit_id" })
    .select("id")
    .single();
  if (saveError) throw saveError;

  const { error: rawError } = await supabase.from("safeculture_inspecoes").upsert({
    audit_id: audit.audit_id,
    audit_uuid: auditIdToUuid(audit.audit_id),
    template_id: templateId,
    destino: template.destino,
    nome: inspectionName(inspection),
    status_processamento: "processado",
    criado_em_safeculture: validDate(auditData?.created_at) || null,
    modificado_em_safeculture: audit.modified_at || inspectionModifiedAt(inspection) || null,
    concluido_em_safeculture: inspectionCompletedAt(inspection) || null,
    web_report_url: reportLink || null,
    payload: inspection as Json,
    registro_destino_id: saved.id,
    erro_processamento: null,
    processado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
  }, { onConflict: "audit_id" });
  if (rawError) throw rawError;
  return existing?.id ? "updated" : "inserted";
}

async function mapToDestination(
  supabase: SupabaseClient,
  template: TemplateConfig,
  audit: AuditSearchRow,
  inspection: Record<string, unknown>,
  answers: Answer[],
  reportLink: string,
) {
  const field = (name: string, defaults: string[]) =>
    answerForField(answers, template.mapeamento || {}, name, defaults);
  const auditData = rootInspection(inspection);
  const completedDate = toDateISO(inspectionCompletedAt(inspection)) || todayIso();
  const lote = clean(field("lote", ["lote do dormente", "lote ensaiado", "lote"]));
  const fornecedor = normalizeSupplier(field("fornecedor", ["fornecedor", "fabrica", "empresa"]));
  const projeto = normalizeProject(field("projeto", ["projeto", "destino", "malha"]));
  const bitola = normalizeGauge(field("bitola", ["tipo de dormente", "bitola", "projeto"]) || projeto);
  const responsavel = clean(field("responsavel", [
    "fiscal responsavel",
    "responsavel",
    "preparado por",
    "autor",
  ]));
  const result = inferResult(answers, inspection);
  const production = await findProductionLot(supabase, lote, fornecedor);
  const modifiedAt = audit.modified_at || inspectionModifiedAt(inspection) || new Date().toISOString();
  const common = {
    producao_lote_id: production?.id || null,
    origem_dados: "safeculture",
    safeculture_audit_id: audit.audit_id,
    safeculture_template_id: template.template_id,
    safeculture_modified_at: modifiedAt,
  };
  const observations = buildObservations(audit.audit_id, template.nome, answers, production);
  const sourceName = `SafetyCulture ${audit.audit_id}`;

  if (template.destino === "inspecoes_pista") {
    return {
      ...common,
      data_inspecao: toDateISO(field("data_inspecao", [
        "data da fabricacao inspecao",
        "data da fabricacao",
        "data da inspecao",
        "data de producao",
      ])) || completedDate,
      lote: lote || null,
      projeto: projeto || null,
      bitola,
      fornecedor: fornecedor || null,
      pista: clean(field("pista", ["pista"])) || null,
      trecho_posicao: clean(field("trecho_posicao", ["trecho posicao", "posicao", "trecho"])) || null,
      molde: clean(field("molde", ["molde"])) || null,
      cavidade: clean(field("cavidade", ["cavidade"])) || null,
      atividade: clean(field("atividade", ["atividade"])) || null,
      itens_inspecionados: summarizeAnswers(answers, 25),
      nao_conformidades: failedAnswers(answers),
      acoes_corretivas: clean(field("acoes_corretivas", ["acoes corretivas", "acao corretiva"])) || null,
      dormentes_reprovados: integerValue(field("dormentes_reprovados", [
        "quantidade reprovada",
        "dormentes reprovados",
        "quantidade de dormentes reprovados",
      ])),
      resultado: result,
      responsavel: responsavel || null,
      link_relatorio: reportLink || null,
      arquivo_origem: sourceName,
      observacoes: observations,
    };
  }

  if (template.destino === "inspecoes_concretagem") {
    return {
      ...common,
      data_inspecao: toDateISO(field("data_inspecao", [
        "data da concretagem",
        "data da fabricacao inspecao",
        "data da fabricacao",
        "data de producao",
      ])) || completedDate,
      lote: lote || null,
      projeto: projeto || null,
      bitola,
      fornecedor: fornecedor || null,
      pista: clean(field("pista", ["pista"])) || null,
      molde: clean(field("molde", ["molde"])) || null,
      cavidade: clean(field("cavidade", ["cavidade"])) || null,
      quantidade_produzida: clean(field("quantidade_produzida", ["quantidade produzida"])) || null,
      slump_abatimento: clean(field("slump_abatimento", ["slump abatimento", "abatimento"])) || null,
      slump_espalhamento: clean(field("slump_espalhamento", ["slump espalhamento", "espalhamento"])) || null,
      temperatura_lancamento: clean(field("temperatura_lancamento", [
        "temperatura de lancamento",
        "temperatura lancamento",
      ])) || null,
      resultado: result,
      responsavel: responsavel || null,
      link_relatorio: reportLink || null,
      arquivo_origem: sourceName,
      observacoes: observations,
    };
  }

  if (template.destino === "ensaios_bitola") {
    return {
      ...common,
      data_ensaio: toDateISO(field("data_ensaio", [
        "data do ensaio",
        "data da fabricacao inspecao",
        "data da inspecao",
      ])) || completedDate,
      lote: lote || null,
      projeto: projeto || null,
      bitola,
      fornecedor: fornecedor || null,
      resultado: result,
      responsavel: responsavel || null,
      link_relatorio: reportLink || null,
      arquivo_origem: sourceName,
      observacoes: observations,
    };
  }

  if (template.destino === "ensaios_arrancamento_usp") {
    const pulloutValues = findValues(answers, ["arrancamento", "carga usp", "ensaio usp"], 3);
    return {
      ...common,
      data_ensaio: toDateISO(field("data_ensaio", ["data do ensaio", "data da inspecao"])) || completedDate,
      lote: lote || null,
      projeto: projeto || null,
      bitola,
      fornecedor: fornecedor || null,
      usp: clean(field("usp", ["com usp", "usp", "lote usp"])) || null,
      tipo_ombreira: clean(field("tipo_ombreira", ["tipo de ombreira"])) || null,
      lote_ombreira: clean(field("lote_ombreira", ["lote da ombreira", "lote da ombreira e clip"])) || null,
      arrancamento_a: pulloutValues[0] || null,
      arrancamento_b: pulloutValues[1] || null,
      arrancamento_c: pulloutValues[2] || null,
      resultado: result,
      responsavel: responsavel || null,
      link_relatorio: reportLink || null,
      arquivo_origem: sourceName,
      observacoes: observations,
    };
  }

  const dataEnsaio = toDateISO(field("data_ensaio", [
    "data do ensaio",
    "data da fabricacao inspecao",
    "data da inspecao",
  ])) || completedDate;
  const week = operationalWeekInfo(dataEnsaio);
  const quantity = integerValue(field("quantidade_ensaiada", [
    "quantidade ensaiada",
    "quantidade de dormentes ensaiados",
    "quantidade",
  ])) || 0;

  if (template.destino === "ensaios_acompanhamento") {
    return {
      ...common,
      data_ensaio: dataEnsaio,
      data_producao: toDateISO(field("data_producao", [
        "data de producao do dormente",
        "data de producao",
        "data da fabricacao",
      ])) || production?.data_fabricacao || null,
      semana: week.semana,
      ano: week.ano,
      periodo_inicio: week.ini,
      periodo_fim: week.fim,
      fornecedor: fornecedor || production?.fornecedor || null,
      projeto: projeto || production?.projeto || null,
      bitola,
      lote_ensaiado: lote || production?.lote || null,
      serie: clean(field("serie", ["serie de lotes", "serie"])) || production?.serie || null,
      resultado: result,
      quantidade_ensaiada: quantity,
      responsavel: responsavel || null,
      link_relatorio_iauditor: reportLink || null,
      arquivo_origem: sourceName,
      observacoes: observations,
    };
  }

  return {
    ...common,
    data_ensaio: dataEnsaio,
    semana: week.semana,
    ano: week.ano,
    periodo_inicio: week.ini,
    periodo_fim: week.fim,
    fornecedor: fornecedor || production?.fornecedor || null,
    projeto: projeto || production?.projeto || null,
    bitola,
    lote_ensaiado: lote || production?.lote || null,
    serie_liberada: clean(field("serie_liberada", ["serie de lotes", "serie liberada", "serie"])) ||
      production?.serie || null,
    resultado: result,
    quantidade_ensaiada: quantity,
    responsavel: responsavel || null,
    link_relatorio_iauditor: reportLink || null,
    observacoes: observations,
  };
}

async function findProductionLot(supabase: SupabaseClient, lot: string, supplier: string) {
  if (!lot) return null;
  const { data, error } = await supabase
    .from("producao_lotes")
    .select("id,lote,fornecedor,projeto,bitola,serie,data_fabricacao")
    .eq("lote", lot)
    .limit(20);
  if (error) throw error;
  const list = data || [];
  const supplierNorm = normalize(supplier);
  return list.find((row) => supplierNorm && normalize(row.fornecedor) === supplierNorm) || list[0] || null;
}

function flattenAnswers(inspection: Record<string, unknown>) {
  const root = rootInspection(inspection);
  const choiceMap = buildChoiceMap(root);
  const answers: Answer[] = [];
  const seen = new Set<string>();
  const allItems = [
    ...arrayValue(root?.header_items),
    ...arrayValue(root?.items),
    ...arrayValue(root?.responses),
  ].filter(isRecord);
  const itemById = new Map(
    allItems.map((item) => [String(item.item_id || item.id || ""), item]),
  );

  for (const item of allItems) {
    addItemAnswer(item, answers, seen, choiceMap, itemById);
  }

  walk(root, (value) => {
    if (!isRecord(value)) return;
    if (!value.label && !value.title && !value.question) return;
    addItemAnswer(value, answers, seen, choiceMap, itemById);
  });
  return answers.filter((answer) => answer.label && answer.value);
}

function addItemAnswer(
  item: Record<string, unknown>,
  answers: Answer[],
  seen: Set<string>,
  choiceMap: Map<string, string>,
  itemById: Map<string, Record<string, unknown>>,
) {
  const label = clean(String(item.label || item.title || item.question || item.name || ""));
  const itemId = String(item.item_id || item.id || "");
  const temperature = getDeep(item, ["temperature_item", "temperature"]);
  const temperatureScale = getDeep(item, ["temperature_item", "scale"]);
  const temperatureValue = temperature == null
    ? undefined
    : `${String(temperature)}${temperatureScale ? ` ${String(temperatureScale)}` : ""}`;
  const valueSource =
    getDeep(item, ["question_item", "responses"]) ??
    getDeep(item, ["text_item", "text"]) ??
    getDeep(item, ["datetime_item", "datetime"]) ??
    temperatureValue ??
    item.responses ??
    item.response ??
    item.answer ??
    item.value ??
    item.values;
  const value = responseText(valueSource, choiceMap);
  if (!label || !value || ["section", "category"].includes(String(item.type || "").toLowerCase())) return;
  const key = `${itemId}|${normalize(label)}|${normalize(value)}`;
  if (seen.has(key)) return;
  seen.add(key);
  answers.push({
    itemId,
    label,
    section: parentSection(item, itemById),
    value,
  });
}

function parentSection(
  item: Record<string, unknown>,
  itemById: Map<string, Record<string, unknown>>,
) {
  let parentId = String(item.parent_id || item.parentId || "");
  const visited = new Set<string>();
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = itemById.get(parentId);
    if (!parent) break;
    const type = String(parent.type || "").toLowerCase();
    if (["section", "category"].includes(type)) {
      return clean(String(parent.label || parent.title || parent.name || ""));
    }
    parentId = String(parent.parent_id || parent.parentId || "");
  }
  return "";
}

function buildChoiceMap(root: Record<string, unknown>) {
  const map = new Map<string, string>();
  walk(root?.template_data || root?.template || {}, (value) => {
    if (!isRecord(value)) return;
    const id = String(value.id || value.response_id || "");
    const label = clean(String(value.label || value.name || value.text || value.value || ""));
    if (id && label && label !== id) map.set(id, label);
  });
  return map;
}

function responseText(value: unknown, choiceMap: Map<string, string>, depth = 0): string {
  if (value == null || depth > 7) return "";
  if (typeof value === "string") return clean(choiceMap.get(value) || value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return unique(value.map((item) => responseText(item, choiceMap, depth + 1)).filter(Boolean)).join(", ");
  }
  if (!isRecord(value)) return "";

  const preferred = [
    "text",
    "label",
    "name",
    "display_value",
    "displayValue",
    "value",
    "answer",
    "selected",
    "selection",
    "values",
    "responses",
    "datetime",
    "date",
    "number",
  ];
  for (const key of preferred) {
    if (value[key] == null) continue;
    const text = responseText(value[key], choiceMap, depth + 1);
    if (text) return text;
  }
  return unique(
    Object.values(value).map((item) => responseText(item, choiceMap, depth + 1)).filter(Boolean),
  ).join(", ");
}

function answerForField(
  answers: Answer[],
  mapping: Record<string, string[] | string>,
  field: string,
  defaults: string[],
) {
  const configured = mapping[field];
  const terms = [
    ...(Array.isArray(configured) ? configured : configured ? [configured] : []),
    ...defaults,
  ];
  for (const term of terms) {
    const exactId = answers.find((answer) => answer.itemId && answer.itemId === term);
    if (exactId) return exactId.value;
  }
  const normalizedTerms = terms.map(normalize).filter(Boolean);
  for (const term of normalizedTerms) {
    const exact = answers.find((answer) => normalize(answer.label) === term);
    if (exact) return exact.value;
  }
  for (const term of normalizedTerms) {
    const partial = answers.find((answer) => {
      const label = normalize(answer.label);
      return label.startsWith(term) || label.includes(term);
    });
    if (partial) return partial.value;
  }
  return "";
}

function inferResult(answers: Answer[], inspection: Record<string, unknown>) {
  const conclusion = answerForField(answers, {}, "resultado", [
    "lote aprovado",
    "resultado final",
    "resultado",
    "conclusao",
    "situacao",
  ]);
  const value = normalize(conclusion);
  if (/(^| )(APROVADO|CONFORME|SIM|ACEITO)( |$)/.test(value)) return "Aprovado";
  if (/(^| )(REPROVADO|NAO CONFORME|NAO|REJEITADO)( |$)/.test(value)) return "Reprovado";
  const failed = answers.some((answer) =>
    /(REPROVADO|NAO CONFORME|FORA DO LIMITE)/.test(normalize(answer.value))
  );
  if (failed) return "Reprovado";
  const score = Number(
    getDeep(rootInspection(inspection), ["audit_data", "score_percentage"]) ||
    getDeep(rootInspection(inspection), ["score", "score_percentage"]) ||
    NaN,
  );
  if (Number.isFinite(score) && score === 100) return "Aprovado";
  return "Pendente";
}

function failedAnswers(answers: Answer[]) {
  const rows = answers.filter((answer) =>
    /(REPROVADO|NAO CONFORME|FORA DO LIMITE|FALHA)/.test(normalize(answer.value))
  );
  return rows.length
    ? rows.slice(0, 30).map((answer) => `${answer.label}: ${answer.value}`).join("\n")
    : null;
}

function summarizeAnswers(answers: Answer[], limit: number) {
  return answers.slice(0, limit).map((answer) =>
    `${answer.section ? `${answer.section} · ` : ""}${answer.label}: ${answer.value}`
  ).join("\n") || null;
}

function buildObservations(
  auditId: string,
  templateName: string,
  answers: Answer[],
  production: Record<string, unknown> | null,
) {
  const lines = [
    "Registro sincronizado automaticamente pela API do SafetyCulture.",
    `Audit ID: ${auditId}`,
    `Template: ${templateName}`,
    `Vínculo com Produção: ${production?.id ? `lote ${production.lote}` : "não encontrado automaticamente"}`,
    "",
    "Respostas:",
    ...answers.slice(0, 60).map((answer) =>
      `- ${answer.section ? `${answer.section} · ` : ""}${answer.label}: ${answer.value}`
    ),
  ];
  return lines.join("\n").slice(0, 30000);
}

function findValues(answers: Answer[], terms: string[], limit: number) {
  const normalized = terms.map(normalize);
  return answers
    .filter((answer) => {
      const text = normalize(`${answer.section} ${answer.label}`);
      return normalized.some((term) => text.includes(term));
    })
    .map((answer) => answer.value)
    .filter(Boolean)
    .slice(0, limit);
}

function rootInspection(inspection: Record<string, unknown>) {
  return (isRecord(inspection.inspection) ? inspection.inspection : inspection) as Record<string, unknown>;
}

function inspectionName(inspection: Record<string, unknown>) {
  const root = rootInspection(inspection);
  return clean(String(
    getDeep(root, ["audit_data", "name"]) ||
    root.name ||
    root.title ||
    "Inspeção SafetyCulture",
  ));
}

function inspectionModifiedAt(inspection: Record<string, unknown>) {
  const root = rootInspection(inspection);
  return validDate(
    root.modified_at ||
    getDeep(root, ["audit_data", "date_modified"]) ||
    root.updated_at,
  );
}

function inspectionCompletedAt(inspection: Record<string, unknown>) {
  const root = rootInspection(inspection);
  return validDate(
    getDeep(root, ["audit_data", "date_completed"]) ||
    root.completed_at ||
    getDeep(root, ["status", "completed_at"]),
  );
}

function auditIdToUuid(value: string) {
  const raw = String(value || "").replace(/^audit_/, "").replace(/-/g, "");
  if (!/^[0-9a-f]{32}$/i.test(raw)) return null;
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`;
}

function normalizeSupplier(value: string) {
  const text = normalize(value);
  if (text.includes("CAVAN")) return "Cavan SP";
  if (text.includes("CONPREM")) return "Conprem MG";
  return titleCase(clean(value));
}

function normalizeProject(value: string) {
  const text = normalize(value);
  if (text.includes("FERRO NORTE") || text.includes("FERRONORTE")) return "FERRO NORTE";
  if (text.includes("FMT")) return "FMT";
  if (text.includes("MALHA CENTRAL")) return "MALHA CENTRAL";
  if (text.includes("MALHA PAULISTA") && text.includes("MISTA")) return "MALHA PAULISTA BITOLA MISTA";
  if (text.includes("MALHA PAULISTA") && text.includes("LARGA")) return "MALHA PAULISTA BITOLA LARGA";
  if (text.includes("MALHA PAULISTA")) return "MALHA PAULISTA BITOLA LARGA";
  return clean(value).toUpperCase();
}

function normalizeGauge(value: string) {
  const text = normalize(value);
  if (text.includes("BITOLA MISTA") || /(^| )BM( |$)/.test(text)) return "Bitola Mista";
  if (text.includes("BITOLA LARGA") || /(^| )BL( |$)/.test(text)) return "Bitola Larga";
  return "Sem bitola definida";
}

function operationalWeekInfo(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const offset = (date.getUTCDay() - 4 + 7) % 7;
  const start = new Date(date);
  start.setUTCDate(start.getUTCDate() - offset);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  const reference = new Date(start);
  reference.setUTCDate(start.getUTCDate() + 7);
  let refYear = reference.getUTCFullYear();
  let firstThursday = firstThursdayOfYear(refYear);
  if (reference < firstThursday) {
    refYear -= 1;
    firstThursday = firstThursdayOfYear(refYear);
  }
  const week = 1 + Math.floor((reference.getTime() - firstThursday.getTime()) / 604800000);
  return { semana: week, ano: refYear, ini: dateIso(start), fim: dateIso(end) };
}

function firstThursdayOfYear(year: number) {
  const date = new Date(Date.UTC(year, 0, 1));
  const offset = (4 - date.getUTCDay() + 7) % 7;
  date.setUTCDate(date.getUTCDate() + offset);
  return date;
}

function toDateISO(value: unknown) {
  const text = clean(String(value || ""));
  if (!text) return "";
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  const months: Record<string, string> = {
    jan: "01",
    fev: "02",
    mar: "03",
    abr: "04",
    mai: "05",
    jun: "06",
    jul: "07",
    ago: "08",
    set: "09",
    out: "10",
    nov: "11",
    dez: "12",
  };
  const pt = normalize(text).match(/\b(\d{1,2})\s+([A-Z]{3})[A-Z]*\s+(\d{4})\b/);
  if (pt && months[pt[2].toLowerCase()]) {
    return `${pt[3]}-${months[pt[2].toLowerCase()]}-${pt[1].padStart(2, "0")}`;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

function integerValue(value: unknown) {
  const match = String(value || "").match(/-?\d+/);
  return match ? Number(match[0]) : null;
}

function validDate(value: unknown) {
  if (!value) return "";
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function positiveNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function getDeep(value: unknown, path: string[]): unknown {
  let current = value;
  for (const key of path) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return current;
}

function walk(value: unknown, visitor: (value: unknown) => void, depth = 0) {
  if (value == null || depth > 12) return;
  visitor(value);
  if (Array.isArray(value)) {
    value.forEach((item) => walk(item, visitor, depth + 1));
  } else if (isRecord(value)) {
    Object.values(value).forEach((item) => walk(item, visitor, depth + 1));
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function arrayValue(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function clean(value: string) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalize(value: unknown) {
  return clean(String(value || ""))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

function titleCase(value: string) {
  return value.toLocaleLowerCase("pt-BR").replace(/(^|\s)\p{L}/gu, (letter) => letter.toLocaleUpperCase("pt-BR"));
}

function dateIso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (isRecord(error)) {
    const parts = [
      error.message ? String(error.message) : "",
      error.details ? `Detalhes: ${String(error.details)}` : "",
      error.hint ? `Dica: ${String(error.hint)}` : "",
      error.code ? `Código: ${String(error.code)}` : "",
    ].filter(Boolean);
    if (parts.length) return parts.join(" | ");
    try {
      return JSON.stringify(error);
    } catch {
      return "Erro estruturado sem mensagem.";
    }
  }
  return String(error);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  try {
    const supabase = adminClient();
    const auth = await authorize(req, supabase);
    const input = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action = String(input.action || "status").toLowerCase();

    if (action === "status") return json(await getStatus(supabase));
    if (action === "discover") {
      const templates = await discoverTemplates(supabase);
      return json({ templates, total: templates.length });
    }
    if (action === "sync") return json(await runSync(supabase, auth, input));
    return json({ error: "Ação inválida. Use status, discover ou sync." }, 400);
  } catch (error) {
    console.error(error);
    const status = error instanceof HttpError ? error.status : 500;
    return json({ error: errorMessage(error) }, status);
  }
});
