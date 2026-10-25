import { existsSync } from "node:fs";

// Carga variables de entorno para los scripts. Acepta varios --env (se cargan en orden; el primero gana),
// o .env.local si no se pasa ninguno. Las variables que ya están en el entorno (p. ej. en el build de
// Vercel) no se pisan.
//   node scripts/doctor.mjs --env .env.local --env .env
export function loadEnv() {
  const files = [];
  process.argv.forEach((a, i) => { if (a === "--env") files.push(process.argv[i + 1]); });
  if (!files.length) files.push(".env.local");
  const explicit = process.argv.includes("--env");
  const loaded = [];
  for (const file of files) {
    if (!file || !existsSync(file)) {
      if (explicit) throw new Error(`No existe el archivo ${file}`);
      continue;
    }
    const before = { ...process.env };
    process.loadEnvFile(file);
    for (const [k, v] of Object.entries(before)) process.env[k] = v;
    loaded.push(file);
  }
  return loaded.length ? loaded.join(" + ") : null;
}
