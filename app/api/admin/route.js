import crypto from "node:crypto";
import { bb, createSession, releaseSession, connectById, checkSessions } from "@/lib/browser";
import { dbConfigured, blobConfigured } from "@/lib/db";
import { initDb, listAllPlatforms, addPlatform, setPlatformActive, listProjects, createProject, getProject, usageSummary } from "@/lib/store";
import { runEvals, evalHistory } from "@/lib/evals";
import { spendStatus, budgets, checkBudget } from "@/lib/usage";

export const runtime = "nodejs";
export const maxDuration = 300;

function ok(req) {
  const want = process.env.ADMIN_CODE;
  if (!want) return false; // sin ADMIN_CODE, el panel está apagado
  const got = String(req.headers.get("x-admin-code") || "");
  const a = Buffer.from(got), b = Buffer.from(want);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const needDb = () => (dbConfigured() ? null : json({ error: "Falta DATABASE_URL (conecta Neon en Vercel → Storage)." }, 400));

export async function POST(req) {
  if (!process.env.ADMIN_CODE) return json({ error: "Falta configurar ADMIN_CODE en Vercel." }, 403);
  if (!ok(req)) return json({ error: "Código de administrador incorrecto." }, 401);
  const body = await req.json().catch(() => ({}));
  const apiKey = Boolean(process.env.BROWSERBASE_API_KEY);
  const contextId = Boolean(process.env.BROWSERBASE_CONTEXT_ID);

  try {
    switch (body.action) {
      case "status":
        return json({
          apiKey, contextId, db: dbConfigured(), blob: blobConfigured(), anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
          model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5", web: process.env.WEB_TOOLS !== "off",
          platforms: await listAllPlatforms().catch(() => []), projects: await listProjects().catch(() => []),
          usage: await usageSummary().catch(() => null), evals: await evalHistory().catch(() => []),
          spend: await spendStatus(null).catch(() => null), budgets: budgets(),
        });

      // ---------- Base de datos ----------
      case "init_db":
        return needDb() || json(await initDb());

      // ---------- Plataformas y proyectos ----------
      case "agregar_plataforma": {
        const err = needDb(); if (err) return err;
        const project = body.proyecto ? await getProject(body.proyecto) : null;
        const p = await addPlatform({ name: String(body.nombre || "").trim(), url: String(body.url || "").trim(), appUrl: String(body.app || "").trim() || null, requiresLogin: Boolean(body.login), notes: body.notas, createdBy: "admin", projectId: project?.id });
        return json({ ok: true, platform: p, platforms: await listAllPlatforms() });
      }
      case "activar_plataforma": {
        const err = needDb(); if (err) return err;
        await setPlatformActive(String(body.slug), Boolean(body.activa));
        return json({ ok: true, platforms: await listAllPlatforms() });
      }
      case "crear_proyecto": {
        const err = needDb(); if (err) return err;
        const p = await createProject({ name: String(body.nombre || "").trim(), client: body.cliente, sector: body.sector, brief: body.brief });
        return json({ ok: true, project: p, projects: await listProjects() });
      }

      // ---------- Sesiones del navegador (Browserbase) ----------
      case "crear_contexto": {
        if (!apiKey) return json({ error: "Falta BROWSERBASE_API_KEY en Vercel." }, 400);
        const c = await bb().contexts.create({ name: "salsa-ux-chat" });
        return json({ id: c.id });
      }
      case "iniciar": {
        if (!apiKey || !contextId) return json({ error: "Faltan BROWSERBASE_API_KEY o BROWSERBASE_CONTEXT_ID." }, 400);
        const s = await createSession({ keepAlive: true, timeoutSec: 1200 });
        const live = await bb().sessions.debug(s.id);
        return json({ sessionId: s.id, connectUrl: s.connectUrl, liveUrl: live.debuggerFullscreenUrl });
      }
      case "ir": {
        const p = (await listAllPlatforms()).find((x) => x.slug === body.plataforma);
        if (!p || !body.sessionId) return json({ error: "Plataforma o sesión inválida." }, 400);
        const { browser, page } = await connectById(body.sessionId, body.connectUrl);
        try { await page.goto(p.app_url || p.web_url, { waitUntil: "domcontentloaded", timeout: 25000 }); }
        finally { try { await browser.close(); } catch {} }
        return json({ ok: true });
      }
      case "terminar":
        await releaseSession(body.sessionId);
        return json({ ok: true });
      case "revisar": {
        if (!apiKey || !contextId) return json({ error: "Faltan BROWSERBASE_API_KEY o BROWSERBASE_CONTEXT_ID." }, 400);
        const platforms = (await listAllPlatforms()).filter((p) => p.active);
        return json({ resultado: await checkSessions(platforms) });
      }

      // ---------- Calidad ----------
      case "evals": {
        if (!process.env.ANTHROPIC_API_KEY) return json({ error: "Falta ANTHROPIC_API_KEY." }, 400);
        const over = await checkBudget(null);
        if (over) return json({ error: over.message }, over.status);
        const project = await getProject(body.proyecto || null);
        return json(await runEvals(project));
      }

      default:
        return json({ error: "Acción desconocida." }, 400);
    }
  } catch (e) {
    console.error("admin", e);
    return json({ error: String(e.message || e).slice(0, 300) }, 500);
  }
}
