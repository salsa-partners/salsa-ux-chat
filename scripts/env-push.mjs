#!/usr/bin/env node
// Sube las claves de producción desde .env a Vercel (production y preview como secretos).
//   npm run env:push                 sube lo que tenga valor
//   npm run env:push -- --dry-run    muestra qué haría, sin cambiar nada
//   npm run env:push -- --file .env.otra
// Lo vacío no se toca. Las variables que manejan las integraciones (Neon, Blob) se ignoran.
import { readFileSync, existsSync } from "node:fs";
import { parseEnv } from "node:util";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";

const args = process.argv.slice(2);
const dry = args.includes("--dry-run");
const fi = args.indexOf("--file");
const file = fi > -1 ? args[fi + 1] : ".env";
const TARGETS = ["production", "preview"];
const MANAGED = /^(DATABASE_URL.*|POSTGRES_.*|PG.*|NEON_.*|BLOB_.*|VERCEL_.*)$/;

const vercelBin = new URL("../node_modules/.bin/vercel", import.meta.url).pathname;
const vercel = (a, input) => execFileSync(vercelBin, a, { input, encoding: "utf8", stdio: [input == null ? "ignore" : "pipe", "pipe", "pipe"] });

if (!existsSync(file)) { console.error(`✗ No existe ${file}`); process.exit(1); }
const vars = parseEnv(readFileSync(file, "utf8"));

// Qué existe ya en Vercel (solo nombres; los valores secretos no se pueden leer).
const remote = new Set();
for (const t of TARGETS) {
  for (const line of vercel(["env", "ls", t]).split("\n")) {
    const m = line.match(/^\s*([A-Z][A-Z0-9_]*)\s+/);
    if (m) remote.add(`${t}:${m[1]}`);
  }
}

if (!vars.SESSION_SECRET && !TARGETS.every((t) => remote.has(`${t}:SESSION_SECRET`))) {
  vars.SESSION_SECRET = randomBytes(48).toString("base64url");
  console.log("· SESSION_SECRET vacía: se generó una al azar.");
}

let pushed = 0, skipped = [];
for (const [name, value] of Object.entries(vars)) {
  if (MANAGED.test(name)) { skipped.push(`${name} (la maneja Vercel)`); continue; }
  if (!value) { skipped.push(`${name} (vacía)`); continue; }
  for (const t of TARGETS) {
    const exists = remote.has(`${t}:${name}`);
    if (dry) { console.log(`  ${exists ? "actualizaría" : "agregaría"} ${name} en ${t}`); continue; }
    // El valor va por stdin: no queda en el historial ni en la lista de procesos.
    vercel(["env", "add", name, t, "--sensitive", "--force", "--yes"], value);
    console.log(`  ✓ ${name} → ${t}${exists ? " (actualizada)" : ""}`);
  }
  pushed++;
}
if (skipped.length) console.log(`· Sin cambios: ${skipped.join(", ")}`);
console.log(dry ? "\n(simulación: no se cambió nada)" : `\n✓ ${pushed} variable(s) en Vercel. Para que producción las use: npm run deploy:prod (o un nuevo push a main).`);
