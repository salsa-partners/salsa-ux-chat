import { existsSync } from "node:fs";

// Carga variables de entorno para los scripts: --env <archivo>, o .env.local si existe.
// Las variables que ya están en el entorno (p. ej. en el build de Vercel) no se pisan.
export function loadEnv() {
  const i = process.argv.indexOf("--env");
  const file = i > -1 ? process.argv[i + 1] : ".env.local";
  if (!file || !existsSync(file)) {
    if (i > -1) throw new Error(`No existe el archivo ${file}`);
    return null;
  }
  const before = { ...process.env };
  process.loadEnvFile(file);
  for (const [k, v] of Object.entries(before)) process.env[k] = v;
  return file;
}
