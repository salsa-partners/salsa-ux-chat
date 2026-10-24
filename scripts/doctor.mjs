#!/usr/bin/env node
// Revisa que todo lo que necesita el agente esté configurado y responda. No gasta tokens del modelo.
//   npm run doctor                      (usa .env.local)
//   node scripts/doctor.mjs --env .env.production.local
import Anthropic from "@anthropic-ai/sdk";
import { list } from "@vercel/blob";
import { loadEnv } from "./env.mjs";
import { neonDb, status } from "../db/runner.mjs";

const envFile = loadEnv();
const e = process.env;
let failed = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => { failed++; console.log(`  ✗ ${m}`); };
const warn = (m) => console.log(`  · ${m}`);

console.log(`Variables${envFile ? ` (${envFile})` : " (entorno)"}`);
for (const k of ["ANTHROPIC_API_KEY", "SESSION_SECRET", "ACCESS_CODE", "ADMIN_CODE", "DATABASE_URL"]) e[k] ? ok(k) : bad(`${k} falta (obligatoria)`);
(e.BLOB_STORE_ID || e.BLOB_READ_WRITE_TOKEN) ? ok("Blob (BLOB_STORE_ID o BLOB_READ_WRITE_TOKEN)") : bad("Blob falta: capturas y Excel no se guardarán");
for (const k of ["BROWSERBASE_API_KEY", "BROWSERBASE_CONTEXT_ID"]) e[k] ? ok(k) : warn(`${k} falta (opcional: sin ella no hay revisión en vivo)`);
if (e.SESSION_SECRET && e.SESSION_SECRET.length < 32) bad("SESSION_SECRET es corta: usa 32+ caracteres");

console.log("\nBase de datos (Neon)");
if (e.DATABASE_URL) {
  try {
    const s = await status(neonDb(e.DATABASE_URL));
    ok(`Conecta: ${s.version}`);
    s.pending.length ? bad(`Migraciones pendientes: ${s.pending.join(", ")} → npm run db:setup`) : ok(`Migraciones al día (${s.applied.map((m) => m.id).join(", ")})`);
    if (s.counts.projects === 0) bad("No hay proyectos → npm run db:seed");
    else if (s.counts.projects != null) ok(`${s.counts.projects} proyecto(s), ${s.counts.platforms} plataforma(s), ${s.counts.memories} archivo(s) de memoria`);
  } catch (err) { bad(`No conecta: ${err.message}`); }
}

console.log("\nAnthropic");
if (e.ANTHROPIC_API_KEY) {
  const model = e.ANTHROPIC_MODEL || "claude-sonnet-5-5";
  try {
    const m = await new Anthropic({ apiKey: e.ANTHROPIC_API_KEY }).models.retrieve(model);
    ok(`Clave válida y acceso a ${m.id}`);
  } catch (err) { bad(`No pude usar ${model}: ${err.status || ""} ${err.message}`); }
}

console.log("\nVercel Blob");
if (e.BLOB_STORE_ID || e.BLOB_READ_WRITE_TOKEN) {
  try { await list({ limit: 1 }); ok("Responde"); }
  catch (err) { bad(`No responde: ${err.message}`); }
}

console.log(failed ? `\n${failed} problema(s). Ver docs/10-bootstrap-base-de-datos.md` : "\nTodo listo para que el agente funcione.");
process.exit(failed ? 1 : 0);
