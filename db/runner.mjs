import { neon } from "@neondatabase/serverless";
import { MIGRATIONS } from "./migrations.mjs";
import { LONGEVIDAD_2026, PLATFORMS, DEFAULT_PROJECT, SEED_MEMORIES } from "./seed-data.mjs";

// Motor de migraciones y datos iniciales. Lo usan los scripts (npm run db:*) y el botón de /admin.
// Trabaja sobre un "db" mínimo con dos operaciones, para poder probarlo con otro Postgres:
//   all(text, params)  -> filas
//   run([[text, params], ...]) -> ejecuta todo en una sola transacción
export function neonDb(url) {
  if (!url) throw new Error("Falta DATABASE_URL. Corre `npm run env:pull` o conecta Neon en Vercel.");
  const sql = neon(url);
  return {
    all: (text, params = []) => sql.query(text, params),
    run: (stmts) => sql.transaction(stmts.map(([text, params = []]) => sql.query(text, params))),
  };
}

const LEDGER = `CREATE TABLE IF NOT EXISTS schema_migrations (
  id text PRIMARY KEY,
  name text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
)`;

export async function appliedMigrations(db) {
  await db.all(LEDGER);
  return (await db.all("SELECT id, name, applied_at FROM schema_migrations ORDER BY id"));
}

// Aplica las migraciones pendientes en orden. Devuelve los ids aplicados en esta corrida.
export async function migrate(db, log = () => {}) {
  const done = new Set((await appliedMigrations(db)).map((r) => r.id));
  const applied = [];
  for (const m of MIGRATIONS) {
    if (done.has(m.id)) continue;
    log(`→ aplicando ${m.id} (${m.name})`);
    await db.run([...m.statements.map((s) => [s]), ["INSERT INTO schema_migrations (id, name) VALUES ($1, $2)", [m.id, m.name]]]);
    applied.push(m.id);
  }
  return applied;
}

// Datos iniciales. Idempotente: no pisa lo que ya existe (si editaste el proyecto o la memoria, se respeta).
export async function seed(db) {
  const p = DEFAULT_PROJECT;
  const stmts = [[
    `INSERT INTO projects (slug, name, client, sector, brief) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (slug) DO NOTHING`,
    [p.slug, p.name, p.client, p.sector, LONGEVIDAD_2026],
  ]];
  for (const [slug, pl] of Object.entries(PLATFORMS)) {
    stmts.push([
      `INSERT INTO platforms (slug, name, domains, app_url, web_url, requires_login, created_by)
       VALUES ($1, $2, $3::jsonb, $4, $5, true, 'seed') ON CONFLICT (slug) DO NOTHING`,
      [slug, pl.nombre, JSON.stringify(pl.dominios), pl.app, pl.web],
    ]);
    stmts.push([
      `INSERT INTO project_platforms (project_id, platform_id)
       SELECT pr.id, pl.id FROM projects pr, platforms pl WHERE pr.slug = $1 AND pl.slug = $2 ON CONFLICT DO NOTHING`,
      [p.slug, slug],
    ]);
  }
  for (const [path, content] of Object.entries(SEED_MEMORIES)) {
    stmts.push([`INSERT INTO memories (path, content, updated_by) VALUES ($1, $2, 'seed') ON CONFLICT (path) DO NOTHING`, [path, content]]);
  }
  await db.run(stmts);
  return { project: p.slug, platforms: Object.keys(PLATFORMS), memories: Object.keys(SEED_MEMORIES).length };
}

// Estado: migraciones aplicadas/pendientes y cuántas filas tiene cada tabla principal.
export async function status(db) {
  const applied = await appliedMigrations(db);
  const ids = new Set(applied.map((r) => r.id));
  const pending = MIGRATIONS.filter((m) => !ids.has(m.id)).map((m) => m.id);
  const counts = {};
  if (!pending.length) {
    for (const t of ["users", "projects", "platforms", "conversations", "messages", "runs", "captures", "findings", "deliverables", "memories", "eval_results"]) {
      counts[t] = Number((await db.all(`SELECT count(*)::int AS n FROM ${t}`))[0].n);
    }
  }
  const [{ version }] = await db.all("SELECT version()");
  return { version: version.split(" on ")[0], applied, pending, counts };
}
