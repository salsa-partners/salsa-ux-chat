#!/usr/bin/env node
// Comandos de la base de datos. Lee DATABASE_URL de .env.local (o del archivo que pases con --env).
//   npm run db:migrate   aplica migraciones pendientes
//   npm run db:seed      carga datos iniciales (proyecto, plataformas, memoria)
//   npm run db:setup     migrate + seed
//   npm run db:status    muestra migraciones y filas por tabla
// Para otro entorno:  node scripts/db.mjs migrate --env .env.production.local
import { loadEnv } from "./env.mjs";
import { neonDb, migrate, seed, status } from "../db/runner.mjs";

const [cmd = "status"] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const envFile = loadEnv();

function target() {
  try { return new URL(process.env.DATABASE_URL).hostname; } catch { return "(sin DATABASE_URL)"; }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    if (process.argv.includes("--if-configured")) { console.log("db: sin DATABASE_URL, se omite."); return; }
    throw new Error(`Falta DATABASE_URL${envFile ? ` en ${envFile}` : ""}. Corre \`npm run env:pull\` primero.`);
  }
  const db = neonDb(process.env.DATABASE_URL);
  console.log(`Base: ${target()}${envFile ? ` (variables de ${envFile})` : ""}`);

  if (cmd === "migrate" || cmd === "setup") {
    const applied = await migrate(db, console.log);
    console.log(applied.length ? `✓ Migraciones aplicadas: ${applied.join(", ")}` : "✓ No había migraciones pendientes.");
  }
  if (cmd === "seed" || cmd === "setup") {
    const r = await seed(db);
    console.log(`✓ Datos iniciales: proyecto ${r.project}, plataformas ${r.platforms.join(", ")}, ${r.memories} archivo(s) de memoria.`);
  }
  if (cmd === "status" || cmd === "setup") {
    const s = await status(db);
    console.log(`Postgres: ${s.version}`);
    console.log(`Migraciones aplicadas: ${s.applied.map((m) => m.id).join(", ") || "ninguna"}${s.pending.length ? ` · PENDIENTES: ${s.pending.join(", ")}` : ""}`);
    if (Object.keys(s.counts).length) console.table(s.counts);
  }
  if (!["migrate", "seed", "setup", "status"].includes(cmd)) throw new Error(`Comando desconocido: ${cmd}`);
}

main().catch((e) => { console.error("✗", e.message); process.exit(1); });
