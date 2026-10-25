import Browserbase from "@browserbasehq/sdk";
import { chromium } from "playwright-core";
import { LOGIN_URL_RE } from "@/lib/platforms";

// Basta la API key: el proyecto se deduce de ella. El contexto (sesión guardada) solo hace falta para
// plataformas con login; sin él, el agente revisa sitios públicos.
export function browserConfigured() {
  return Boolean(process.env.BROWSERBASE_API_KEY);
}

// "Keep alive" (sesiones que sobreviven a la desconexión) es de planes pagos; en Free se deja apagado.
const KEEP_ALIVE_OK = process.env.BROWSERBASE_KEEP_ALIVE === "on";
// Free: 300 s por sesión. Subir con BROWSERBASE_MAX_SESSION_SEC en planes pagos.
const MAX_SESSION_SEC = Number(process.env.BROWSERBASE_MAX_SESSION_SEC || 300);

export function bb() {
  return new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });
}

const VIEWPORT = { width: 1280, height: 800 };

// Abre una sesión; si hay contexto, reutiliza (y guarda) las cookies de las plataformas con login.
export async function createSession({ keepAlive = false, timeoutSec = 300 } = {}) {
  const client = bb();
  const params = {
    keepAlive: keepAlive && KEEP_ALIVE_OK,
    api_timeout: Math.min(timeoutSec, MAX_SESSION_SEC),
    browserSettings: {
      ...(process.env.BROWSERBASE_CONTEXT_ID ? { context: { id: process.env.BROWSERBASE_CONTEXT_ID, persist: true } } : {}),
      viewport: VIEWPORT,
      solveCaptchas: false,
      recordSession: false,
    },
  };
  return client.sessions.create(params);
}

export async function releaseSession(sessionId) {
  if (!sessionId) return;
  const body = { status: "REQUEST_RELEASE" };
  try { await bb().sessions.update(sessionId, body); } catch (e) { console.error("release", e?.message); }
}

export async function connect(connectUrl) {
  const browser = await chromium.connectOverCDP(connectUrl);
  const ctx = browser.contexts()[0] || (await browser.newContext());
  const page = ctx.pages()[0] || (await ctx.newPage());
  try { await page.setViewportSize(VIEWPORT); } catch {}
  return { browser, page };
}

// Conecta a una sesión ya creada (por id) para moverla a una URL. retrieve() no siempre trae connectUrl:
// en ese caso se usa la que devolvió create() (solo si es de Browserbase).
export async function connectById(sessionId, knownUrl) {
  const s = await bb().sessions.retrieve(sessionId);
  let url = s.connectUrl;
  if (!url && knownUrl) { try { if (/(^|\.)browserbase\.io$/.test(new URL(knownUrl).hostname)) url = knownUrl; } catch {} }
  if (!url) throw new Error("No pude reconectar con el navegador; ciérralo y ábrelo de nuevo.");
  return connect(url);
}

export async function pageLooksLikeLogin(page) {
  try {
    if (LOGIN_URL_RE.test(new URL(page.url()).pathname)) return true;
    return (await page.locator('input[type="password"]:visible').count()) > 0;
  } catch { return false; }
}

// Revisa si las sesiones de las plataformas con login siguen activas (solo abre las URLs, no escribe nada).
export async function checkSessions(platforms) {
  const s = await createSession({ timeoutSec: 180 });
  const out = {};
  let conn;
  try {
    conn = await connect(s.connectUrl);
    for (const p of platforms.filter((x) => x.requires_login)) {
      const key = p.slug;
      try {
        await conn.page.goto(p.app_url, { waitUntil: "domcontentloaded", timeout: 25000 });
        await conn.page.waitForTimeout(2500);
        const login = await pageLooksLikeLogin(conn.page);
        out[key] = { ok: !login, url: conn.page.url() };
      } catch (e) {
        out[key] = { ok: false, error: String(e.message || e).slice(0, 120) };
      }
    }
  } finally {
    try { await conn?.browser.close(); } catch {}
    await releaseSession(s.id);
  }
  return out;
}
