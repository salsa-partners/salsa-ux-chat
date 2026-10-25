import { sql, dbConfigured } from "@/lib/db";
import { neonDb, migrate, seed } from "@/db/runner.mjs";
import { PLATFORMS } from "@/lib/platforms";
import { LONGEVIDAD_2026 } from "@/lib/knowledge";

// Acceso a datos. Cada función funciona (devolviendo vacío/nulo) aunque no haya base configurada.
const DEFAULT_PROJECT = process.env.DEFAULT_PROJECT || "longevidad-2026";
const SCORE_KEYS = ["claridad", "esfuerzo", "feedback", "confianza", "diseno", "writing"];

const one = (rows) => rows[0] || null;
const slugify = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

// ---------- Inicialización ----------
// Mismo motor que `npm run db:setup` (db/runner.mjs): aplica migraciones pendientes y datos iniciales.
export async function initDb() {
  const db = neonDb(process.env.DATABASE_URL);
  const applied = await migrate(db);
  await seed(db);
  return { ok: true, project: DEFAULT_PROJECT, applied };
}

// ---------- Personas ----------
export async function upsertUser(email, name) {
  if (!dbConfigured() || !email) return null;
  return one(await sql()`INSERT INTO users (email, name) VALUES (${email}, ${name || null})
    ON CONFLICT (email) DO UPDATE SET name = COALESCE(EXCLUDED.name, users.name) RETURNING id, email, name, role`);
}

// ---------- Proyectos ----------
export async function getProject(slug) {
  if (!dbConfigured()) return { id: null, slug: DEFAULT_PROJECT, name: "Benchmark Longevidad 2026", brief: LONGEVIDAD_2026 };
  return one(await sql()`SELECT id, slug, name, client, sector, brief FROM projects WHERE slug = ${slug || DEFAULT_PROJECT}`)
    || one(await sql()`SELECT id, slug, name, client, sector, brief FROM projects WHERE slug = ${DEFAULT_PROJECT}`);
}

export async function listProjects() {
  if (!dbConfigured()) return [{ slug: DEFAULT_PROJECT, name: "Benchmark Longevidad 2026" }];
  return sql()`SELECT slug, name, client, sector FROM projects ORDER BY created_at`;
}

export async function createProject({ name, client, sector, brief }) {
  const slug = slugify(name);
  if (!slug) throw new Error("Falta el nombre del proyecto.");
  return one(await sql()`INSERT INTO projects (slug, name, client, sector, brief) VALUES (${slug}, ${name}, ${client || null}, ${sector || null}, ${brief || null})
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, client = EXCLUDED.client, sector = EXCLUDED.sector, brief = COALESCE(EXCLUDED.brief, projects.brief)
    RETURNING id, slug, name`);
}

// ---------- Plataformas ----------
const fromStatic = () => Object.entries(PLATFORMS).map(([slug, p]) => ({ slug, name: p.nombre, domains: p.dominios, app_url: p.app, web_url: p.web, requires_login: true }));

// Plataformas activas. Con proyecto: primero las del proyecto, luego el resto del registro.
export async function listPlatforms(projectId) {
  if (!dbConfigured()) return fromStatic();
  const rows = await sql()`SELECT pl.slug, pl.name, pl.domains, pl.app_url, pl.web_url, pl.requires_login, pl.notes,
      (pp.project_id IS NOT NULL) AS in_project
    FROM platforms pl LEFT JOIN project_platforms pp ON pp.platform_id = pl.id AND pp.project_id = ${projectId || null}
    WHERE pl.active ORDER BY in_project DESC, pl.created_at`;
  return rows.length ? rows : fromStatic();
}

export function domainOf(url) {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch { return null; }
}

export async function addPlatform({ name, url, appUrl, requiresLogin = false, notes, createdBy, projectId }) {
  const domain = domainOf(url);
  if (!domain || !/^https:\/\//i.test(url)) throw new Error("La URL debe empezar con https://");
  // Sitios que no se deben recorrer con el agente (bancos, gobierno, redes con login de terceros, etc.).
  if (/(^|\.)(gob\.|gov\.|bank|banco|paypal|google\.com$|facebook\.com$|instagram\.com$|linkedin\.com$)/i.test(domain)) throw new Error("Ese dominio no se puede registrar para revisión automática.");
  const slug = slugify(name) || slugify(domain);
  const row = one(await sql()`INSERT INTO platforms (slug, name, domains, app_url, web_url, requires_login, notes, created_by)
    VALUES (${slug}, ${name}, ${JSON.stringify([domain])}::jsonb, ${appUrl || url}, ${url}, ${requiresLogin}, ${notes || null}, ${createdBy || null})
    ON CONFLICT (slug) DO UPDATE SET active = true RETURNING id, slug, name, domains, app_url, web_url, requires_login`);
  if (projectId) await sql()`INSERT INTO project_platforms (project_id, platform_id) VALUES (${projectId}, ${row.id}) ON CONFLICT DO NOTHING`;
  return row;
}

export async function listAllPlatforms() {
  if (!dbConfigured()) return fromStatic().map((p) => ({ ...p, active: true }));
  return sql()`SELECT slug, name, domains, app_url, web_url, requires_login, active, created_by FROM platforms ORDER BY created_at`;
}

export async function setPlatformActive(slug, active) {
  await sql()`UPDATE platforms SET active = ${active} WHERE slug = ${slug}`;
}

// ---------- Conversaciones ----------
export async function createConversation(userId, projectId, title) {
  if (!dbConfigured() || !userId) return null;
  return one(await sql()`INSERT INTO conversations (user_id, project_id, title) VALUES (${userId}, ${projectId}, ${title}) RETURNING id`);
}

export async function getConversation(id, userId) {
  if (!dbConfigured() || !id || !userId || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  return one(await sql()`SELECT id, title, project_id FROM conversations WHERE id = ${id} AND user_id = ${userId}`);
}

export async function listConversations(userId) {
  if (!dbConfigured() || !userId) return [];
  return sql()`SELECT c.id, c.title, c.updated_at, p.slug AS project FROM conversations c LEFT JOIN projects p ON p.id = c.project_id
    WHERE c.user_id = ${userId} ORDER BY c.updated_at DESC LIMIT 50`;
}

export async function conversationMessages(id) {
  return sql()`SELECT role, text, meta FROM messages WHERE conversation_id = ${id} ORDER BY id`;
}

export async function addMessage(conversationId, role, text, meta = {}) {
  if (!dbConfigured() || !conversationId) return;
  await sql()`INSERT INTO messages (conversation_id, role, text, meta) VALUES (${conversationId}, ${role}, ${text}, ${JSON.stringify(meta)}::jsonb)`;
  await sql()`UPDATE conversations SET updated_at = now() WHERE id = ${conversationId}`;
}

export async function deleteConversation(id, userId) {
  if (!dbConfigured() || !/^[0-9a-f-]{36}$/i.test(String(id))) return;
  await sql()`DELETE FROM conversations WHERE id = ${id} AND user_id = ${userId}`;
}

// ---------- Ejecuciones (observabilidad y límites) ----------
export async function startRun({ conversationId, userId, projectId, model }) {
  if (!dbConfigured()) return null;
  return one(await sql()`INSERT INTO runs (conversation_id, user_id, project_id, model) VALUES (${conversationId}, ${userId}, ${projectId}, ${model}) RETURNING id`)?.id;
}

export async function finishRun(id, { kind, status, usage, toolCalls, durationMs, error, cost = 0, browserSeconds = 0 }) {
  if (!dbConfigured() || !id) return;
  await sql()`UPDATE runs SET kind = ${kind}, status = ${status}, input_tokens = ${usage.input}, output_tokens = ${usage.output},
    cache_read_tokens = ${usage.cacheRead}, cache_write_tokens = ${usage.cacheWrite}, tool_calls = ${JSON.stringify(toolCalls)}::jsonb,
    duration_ms = ${durationMs}, error = ${error || null}, cost_usd = ${cost}, browser_seconds = ${browserSeconds},
    web_searches = ${usage.webSearches || 0} WHERE id = ${id}`;
}

// Cuántas ejecuciones hizo una persona en la ventana (minutos). kind = 'live' cuenta solo revisiones con navegador.
export async function countRuns(userId, minutes, kind) {
  if (!dbConfigured() || !userId) return null;
  const r = one(await sql()`SELECT count(*)::int AS n FROM runs WHERE user_id = ${userId}
    AND created_at > now() - make_interval(mins => ${minutes}) AND (${kind || null}::text IS NULL OR kind = ${kind || null})`);
  return r?.n ?? 0;
}

// ---------- Conocimiento del benchmark ----------
export async function saveCapture({ runId, projectId, platform, journey, step, url, blobUrl, observation }) {
  if (!dbConfigured() || !projectId) return null;
  return one(await sql()`INSERT INTO captures (run_id, project_id, platform_slug, journey, step, url, blob_url, observation)
    VALUES (${runId}, ${projectId}, ${platform}, ${journey}, ${step}, ${url}, ${blobUrl}, ${observation}) RETURNING id`)?.id;
}

// Guarda los pasos que el agente evaluó (los mismos que van al Excel) como hallazgos consultables.
export async function saveFindings({ projectId, runId, pasos, captureIds }) {
  if (!dbConfigured() || !projectId || !Array.isArray(pasos)) return 0;
  let n = 0;
  for (const p of pasos) {
    const platform = slugify(p.plataforma);
    if (!platform || !p.journey) continue;
    const scores = Object.fromEntries(SCORE_KEYS.map((k) => [k, Number(p[k]) || null]));
    const severity = /^\s*grave/i.test(p.friccion || "") ? "grave" : p.friccion ? "media" : null;
    await sql()`INSERT INTO findings (project_id, platform_slug, journey, step, capture_id, user_action, sees, key_text, clicks, scores,
        friction, severity, writing_finding, emotion, recommendation, source, run_id)
      VALUES (${projectId}, ${platform}, ${p.journey}, ${p.paso || null}, ${captureIds.get(p.captura_id) || null}, ${p.usuario_hace || null},
        ${p.ve || null}, ${p.texto_clave || null}, ${Number.isFinite(Number(p.clics)) ? Number(p.clics) : null}, ${JSON.stringify(scores)}::jsonb,
        ${p.friccion || null}, ${severity}, ${p.hallazgo_writing || null}, ${p.emocion || null}, ${p.recomendacion || null}, 'live', ${runId})`;
    n++;
  }
  return n;
}

// Busca hallazgos guardados. Devuelve los más recientes primero.
export async function queryFindings({ projectId, platform, journey, text, limit = 40 }) {
  if (!dbConfigured() || !projectId) return [];
  const like = text ? `%${text}%` : null;
  return sql()`SELECT f.platform_slug AS plataforma, f.journey, f.step AS paso, f.key_text AS texto_clave, f.sees AS ve, f.scores,
      f.friction AS friccion, f.writing_finding AS hallazgo_writing, f.recommendation AS recomendacion, to_char(f.observed_at, 'YYYY-MM-DD') AS fecha,
      c.blob_url AS captura
    FROM findings f LEFT JOIN captures c ON c.id = f.capture_id
    WHERE f.valid AND f.project_id = ${projectId}
      AND (${platform || null}::text IS NULL OR f.platform_slug = ${platform || null})
      AND (${journey || null}::text IS NULL OR f.journey ILIKE ${journey || null})
      AND (${like}::text IS NULL OR f.key_text ILIKE ${like} OR f.friction ILIKE ${like} OR f.writing_finding ILIKE ${like} OR f.sees ILIKE ${like})
    ORDER BY f.observed_at DESC LIMIT ${Math.min(Number(limit) || 40, 80)}`;
}

// Promedio por plataforma y journey (para comparar sin volver a navegar).
export async function scoreboard(projectId) {
  if (!dbConfigured() || !projectId) return [];
  return sql()`SELECT f.platform_slug AS plataforma, f.journey, count(*)::int AS pasos, round(avg(s.prom), 1) AS promedio,
      max(f.observed_at)::date AS ultima_revision
    FROM findings f CROSS JOIN LATERAL (SELECT avg(v::numeric) AS prom FROM jsonb_each_text(f.scores) AS e(k, v) WHERE v ~ '^[0-9.]+$') s
    WHERE f.valid AND f.project_id = ${projectId} GROUP BY 1, 2 ORDER BY 2, 1`;
}

export async function saveDeliverable({ runId, projectId, name, blobUrl }) {
  if (!dbConfigured() || !projectId) return;
  await sql()`INSERT INTO deliverables (run_id, project_id, name, blob_url) VALUES (${runId}, ${projectId}, ${name}, ${blobUrl})`;
}

export async function usageSummary(days = 30) {
  if (!dbConfigured()) return null;
  return one(await sql()`SELECT count(*)::int AS ejecuciones, count(*) FILTER (WHERE kind = 'live')::int AS en_vivo,
      count(*) FILTER (WHERE status = 'error')::int AS errores, coalesce(sum(input_tokens), 0)::bigint AS input_tokens,
      coalesce(sum(output_tokens), 0)::bigint AS output_tokens, coalesce(sum(cache_read_tokens), 0)::bigint AS cache_read_tokens,
      round(avg(duration_ms) / 1000.0, 1) AS segundos_promedio, round(sum(cost_usd), 2)::float AS costo_usd,
      round(sum(browser_seconds) / 60.0, 1)::float AS minutos_navegador, coalesce(sum(web_searches), 0)::int AS busquedas_web
    FROM runs WHERE created_at > now() - make_interval(days => ${days})`);
}
