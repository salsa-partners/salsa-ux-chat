import Anthropic from "@anthropic-ai/sdk";
import { BASE_PROMPT, AGENT_PROMPT } from "@/lib/knowledge";
import { browserConfigured, createSession, connect, releaseSession } from "@/lib/browser";
import { toolDefs, Toolbox } from "@/lib/tools";
import { isAuthorized, readSession } from "@/lib/access";
import { dbConfigured } from "@/lib/db";
import { memoryIndex } from "@/lib/memory";
import {
  upsertUser, getProject, listPlatforms, createConversation, getConversation, conversationMessages,
  addMessage, startRun, finishRun, countRuns,
} from "@/lib/store";

export const runtime = "nodejs";
// En Vercel Pro con Fluid compute se puede subir a 800 (y ajustar SOFT_MS/HARD_MS). Hobby: máximo 300.
export const maxDuration = 300;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const EFFORT = process.env.AGENT_EFFORT || "medium"; // low | medium | high
const MAX_ITER = 30;
const SOFT_MS = 190_000; // desde aquí se le pide cerrar con el Excel
const HARD_MS = 270_000; // desde aquí se corta
const MAX_TURNS = 16;
const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 4.5 * 1024 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const CHATS_PER_10_MIN = Number(process.env.CHATS_PER_10_MIN || 20);
const LIVE_PER_HOUR = Number(process.env.AGENT_RUNS_PER_HOUR || 6);

// Betas: limpieza de resultados viejos del lado del servidor (en vez de editar el historial, que
// invalida el razonamiento en modelos 5.5) y respaldo automático si el modelo rechaza un pedido.
const FALLBACK = process.env.REFUSAL_FALLBACK !== "off";
const BETAS = ["context-management-2025-06-27", ...(FALLBACK ? ["server-side-fallback-2026-07-01"] : [])];
const CONTEXT_MANAGEMENT = {
  edits: [{
    type: "clear_tool_uses_20250919",
    trigger: { type: "input_tokens", value: 60000 },
    keep: { type: "tool_uses", value: 6 },
    clear_at_least: { type: "input_tokens", value: 10000 },
    exclude_tools: ["memory", "generar_excel"],
  }],
};

// Límite de respaldo por IP cuando no hay base de datos (solo vale por instancia).
const hits = new Map();
function limitedByIp(ip, max, minutes) {
  const now = Date.now(), win = minutes * 60 * 1000;
  const arr = (hits.get(ip) || []).filter((t) => now - t < win);
  arr.push(now); hits.set(ip, arr);
  return arr.length > max;
}

function imageBlocks(images) {
  const blocks = [];
  for (const img of (Array.isArray(images) ? images : []).slice(0, MAX_IMAGES)) {
    const match = /^data:(image\/[a-z]+);base64,(.+)$/.exec(String(img));
    if (!match || !IMAGE_TYPES.includes(match[1])) continue;
    if (match[2].length * 0.75 > MAX_IMAGE_BYTES) continue;
    blocks.push({ type: "image", source: { type: "base64", media_type: match[1], data: match[2] } });
  }
  return blocks;
}

// Historial en solo texto (de la base o del navegador), alternando user/assistant y empezando por user.
function textHistory(rows) {
  const out = [];
  for (const m of rows.slice(-MAX_TURNS)) {
    if (m.role !== "user" && m.role !== "assistant") continue;
    const text = String(m.text || "").slice(0, 8000).trim();
    if (!text) continue;
    const last = out[out.length - 1];
    if (last && last.role === m.role) last.content += "\n\n" + text;
    else out.push({ role: m.role, content: text });
  }
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}

function platformsBlock(platforms) {
  return "PLATAFORMAS REGISTRADAS (id: nombre · dominios · requiere sesión):\n" + platforms.map((p) =>
    `- ${p.slug}: ${p.name} · ${(p.domains || []).join(", ")} · ${p.requires_login ? "sí" : "no (pública)"}${p.in_project === false ? " · (fuera de este proyecto)" : ""}`).join("\n");
}

export async function POST(req) {
  if (!isAuthorized(req)) return new Response("Necesitas el código de acceso.", { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return new Response("Falta configurar ANTHROPIC_API_KEY en el servidor.", { status: 500 });

  const ip = (req.headers.get("x-forwarded-for") || "anon").split(",")[0].trim();
  const session = readSession(req);
  const user = session ? await upsertUser(session.email, session.name).catch(() => null) : null;

  // Límites de uso: por persona si hay base, por IP si no.
  const recent = user ? await countRuns(user.id, 10).catch(() => null) : null;
  if (recent != null ? recent >= CHATS_PER_10_MIN : limitedByIp(ip, CHATS_PER_10_MIN, 10)) {
    return new Response("Muchos mensajes seguidos. Espera unos minutos.", { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const userText = String(body?.message?.text || "").slice(0, 8000).trim();
  const images = imageBlocks(body?.message?.images);
  if (!userText && !images.length) return new Response("Mensaje vacío.", { status: 400 });

  // Conversación: con base, el historial sale del servidor; sin base, lo manda el navegador.
  let conversation = user ? await getConversation(body?.conversationId, user.id) : null;
  const project = await getProject(body?.project || null).catch(() => null);
  if (!project) return new Response("Proyecto no encontrado. Prepara la base en /admin.", { status: 500 });
  let prior = [];
  if (conversation) prior = await conversationMessages(conversation.id);
  else if (user && dbConfigured()) conversation = await createConversation(user.id, project.id, (userText || "Análisis de capturas").slice(0, 60));
  else prior = Array.isArray(body?.history) ? body.history : [];

  const history = textHistory(prior);
  history.push({ role: "user", content: [...images, { type: "text", text: userText || "Analiza estas capturas." }] });
  if (history.length > 1 && history[history.length - 2].role === "user") {
    // Si el último guardado también era del usuario (respuesta anterior falló), se unen.
    const prev = history.splice(history.length - 2, 1)[0];
    history[history.length - 1].content.unshift({ type: "text", text: prev.content });
  }
  await addMessage(conversation?.id, "user", userText || "Analiza estas capturas.", { images: images.length }).catch(() => {});

  const platforms = await listPlatforms(project.id).catch(() => []);
  const browser = browserConfigured();
  const tools = toolDefs({ browser, web: process.env.WEB_TOOLS !== "off" });
  const today = new Date().toISOString().slice(0, 10);

  // Orden pensado para el caché: lo fijo primero (identidad + método), luego el proyecto, al final lo variable.
  const system = [
    { type: "text", text: BASE_PROMPT + (browser ? AGENT_PROMPT : "\n\nNo tienes navegador en esta instalación: trabaja con hallazgos guardados, investigación web y capturas adjuntas."), cache_control: { type: "ephemeral" } },
    { type: "text", text: `CONTEXTO DEL PROYECTO: ${project.name}${project.client ? ` · cliente: ${project.client}` : ""}${project.sector ? ` · sector: ${project.sector}` : ""}\n${project.brief || "(sin resultados previos cargados)"}`, cache_control: { type: "ephemeral" } },
    { type: "text", text: `${platformsBlock(platforms)}\n\nMEMORIA (archivos disponibles):\n${await memoryIndex()}\n\nPERSONA: ${session?.name || "sin nombre"}${session?.email ? ` <${session.email}> (sus preferencias van en /memories/personas/${session.email}/)` : ""}\nPROYECTO ACTUAL: ${project.slug} (memoria en /memories/proyectos/${project.slug}/)\nFECHA DE HOY: ${today}` },
  ];

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const encoder = new TextEncoder();
  const runId = await startRun({ conversationId: conversation?.id || null, userId: user?.id || null, projectId: project.id, model: MODEL }).catch(() => null);

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const emit = (ev) => { if (closed) return; try { controller.enqueue(encoder.encode(JSON.stringify(ev) + "\n")); } catch { closed = true; } };
      const started = Date.now();
      const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
      const steps = [];
      let answer = "", status = "ok", error = null, bbSession = null, conn = null;
      const say = (d) => { answer += d; emit({ t: "text", d }); };
      const emitStatus = (ev) => { if (ev.t === "status") steps.push(ev.d); emit(ev); };

      if (conversation) emit({ t: "meta", conversationId: conversation.id, project: project.slug });

      // El navegador se abre solo si el agente lo necesita.
      async function openPage() {
        const n = user ? await countRuns(user.id, 60, "live").catch(() => null) : null;
        if (n != null ? n >= LIVE_PER_HOUR : limitedByIp("live:" + ip, LIVE_PER_HOUR, 60)) throw new Error("Se alcanzó el límite de revisiones en vivo por hora. Intenta más tarde.");
        emitStatus({ t: "status", d: "Abriendo el navegador con la sesión guardada…" });
        bbSession = await createSession({ timeoutSec: 330 });
        conn = await connect(bbSession.connectUrl);
        return conn.page;
      }
      const box = new Toolbox({ emit: emitStatus, openPage, platforms, project, runId, user: session });

      try {
        let wroteText = false, nudged = false, jsonRetries = 0;
        for (let iter = 0; iter < MAX_ITER; iter++) {
          if (req.signal?.aborted) { status = "aborted"; break; }
          if (Date.now() - started > HARD_MS) { say("\n\nSe acabó el tiempo de esta revisión. Pídeme menos pantallas por consulta (por ejemplo, una plataforma o un journey a la vez)."); status = "timeout"; break; }

          const s = client.beta.messages.stream({
            model: MODEL,
            max_tokens: 32000,
            system,
            messages: history,
            tools,
            cache_control: { type: "ephemeral" }, // cachea el historial que crece en cada vuelta del loop
            thinking: { type: "adaptive" },
            output_config: { effort: EFFORT },
            betas: BETAS,
            context_management: CONTEXT_MANAGEMENT,
            ...(FALLBACK ? { fallbacks: "default" } : {}),
          });
          let firstText = true;
          let final;
          try {
            for await (const ev of s) {
              if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") {
                if (firstText && wroteText) say("\n\n");
                firstText = false; wroteText = true;
                say(ev.delta.text);
              }
            }
            final = await s.finalMessage();
            jsonRetries = 0;
          } catch (e) {
            // Con eager_input_streaming, un input de herramienta ilegible se reintenta (máx. 2). Errores de la API no.
            // Si ya se mostró texto de esta vuelta, no se reintenta (se duplicaría en el chat).
            if (e instanceof Anthropic.APIError || !firstText || jsonRetries++ >= 2) throw e;
            continue;
          }

          const u = final.usage || {};
          usage.input += u.input_tokens || 0; usage.output += u.output_tokens || 0;
          usage.cacheRead += u.cache_read_input_tokens || 0; usage.cacheWrite += u.cache_creation_input_tokens || 0;

          // Historial solo crece (append-only): nunca se editan turnos anteriores.
          history.push({ role: "assistant", content: final.content });
          if (final.stop_reason === "pause_turn") continue; // una herramienta del servidor (web) pidió seguir
          if (final.stop_reason === "refusal") { say("\n\nNo puedo ayudar con este pedido. Reformúlalo o pregunta por otro aspecto de la experiencia."); status = "refusal"; break; }
          if (final.stop_reason === "max_tokens") { say("\n\n[La respuesta fue demasiado larga y se cortó. Pide menos pantallas por consulta.]"); status = "max_tokens"; break; }
          if (final.stop_reason !== "tool_use") break;

          const results = [];
          for (const b of final.content) {
            if (b.type !== "tool_use") continue;
            const r = await box.exec(b.name, b.input || {});
            results.push(r?.error
              ? { type: "tool_result", tool_use_id: b.id, is_error: true, content: r.error }
              : { type: "tool_result", tool_use_id: b.id, content: r });
          }
          if (!nudged && box.usedBrowser && Date.now() - started > SOFT_MS && !box.file) {
            nudged = true;
            results.push({ type: "text", text: "TIEMPO: quedan pocos segundos. Llama ya a generar_excel con lo capturado y marca lo pendiente." });
          }
          history.push({ role: "user", content: results });
        }
      } catch (e) {
        console.error(e);
        status = "error"; error = String(e.message || e).slice(0, 300);
        say("\n\n[Error: no pude responder ahora (" + error.slice(0, 160) + "). Intenta de nuevo en un momento.]");
      } finally {
        try { await conn?.browser.close(); } catch {}
        if (bbSession) await releaseSession(bbSession.id);
        const files = box.file ? [{ name: box.file.name, url: box.file.url || null }] : [];
        await addMessage(conversation?.id, "assistant", answer || "(sin respuesta)", { steps, files }).catch(() => {});
        await finishRun(runId, { kind: box.usedBrowser ? "live" : "chat", status, usage, toolCalls: box.calls, durationMs: Date.now() - started, error }).catch(() => {});
        closed = true;
        try { controller.close(); } catch {}
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
