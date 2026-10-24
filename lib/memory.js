import { sql, dbConfigured } from "@/lib/db";

// Backend de la herramienta "memory" de Claude (memory_20250818) guardado en Postgres.
// Claude ve un directorio /memories con archivos de texto; aquí cada archivo es una fila.
// Convención (ver docs/03-memoria-y-datos.md):
//   /memories/equipo/...                 cómo trabaja Salsa, preferencias del equipo
//   /memories/proyectos/<slug>/...       contexto y aprendizajes de cada proyecto
//   /memories/personas/<correo>/...      preferencias de cada persona
export const MEMORY_TOOL = { type: "memory_20250818", name: "memory" };

const MAX_FILE = 20_000;
const MAX_FILES = 300;
const local = new Map(); // solo si no hay base: no persiste entre despliegues

function clean(p) {
  const s = String(p || "").trim().replace(/\/+$/, "") || "/memories";
  if (!(s === "/memories" || s.startsWith("/memories/")) || s.includes("..") || /%2e/i.test(s) || /[\0\\]/.test(s)) throw new Error("Ruta inválida: debe estar dentro de /memories");
  return s;
}

async function getFile(path) {
  if (!dbConfigured()) return local.has(path) ? local.get(path) : null;
  const r = await sql()`SELECT content FROM memories WHERE path = ${path}`;
  return r[0] ? r[0].content : null;
}
async function putFile(path, content, by) {
  if (content.length > MAX_FILE) throw new Error(`El archivo supera ${MAX_FILE} caracteres; resume o divide en varios archivos.`);
  if (!dbConfigured()) { local.set(path, content); return; }
  await sql()`INSERT INTO memories (path, content, updated_by) VALUES (${path}, ${content}, ${by || null})
    ON CONFLICT (path) DO UPDATE SET content = EXCLUDED.content, updated_by = EXCLUDED.updated_by, updated_at = now()`;
}
async function listUnder(prefix) {
  if (!dbConfigured()) return [...local.entries()].filter(([p]) => p.startsWith(prefix + "/")).map(([path, content]) => ({ path, size: content.length }));
  return sql()`SELECT path, length(content) AS size FROM memories WHERE path LIKE ${prefix + "/%"} ORDER BY path LIMIT ${MAX_FILES}`;
}
async function countFiles() {
  if (!dbConfigured()) return local.size;
  return (await sql()`SELECT count(*)::int AS n FROM memories`)[0].n;
}

// Ejecuta un comando de la herramienta memory y devuelve el texto para el tool_result.
export async function runMemory(input, by) {
  const cmd = input?.command;
  switch (cmd) {
    case "view": {
      const path = clean(input.path);
      const file = await getFile(path);
      if (file != null) {
        let lines = file.split("\n");
        let start = 1;
        if (Array.isArray(input.view_range) && input.view_range.length === 2) {
          const [a, b] = input.view_range.map(Number);
          start = Math.max(1, a);
          lines = lines.slice(start - 1, b === -1 ? undefined : b);
        }
        return `Here's the content of ${path} with line numbers:\n` + lines.map((l, i) => `${String(i + start).padStart(6)}\t${l}`).join("\n");
      }
      const files = await listUnder(path);
      if (!files.length && path !== "/memories") throw new Error(`The path ${path} does not exist. Please provide a valid path.`);
      return `Here're the files and directories up to 2 levels deep in ${path}:\n` + [`-\t${path}`, ...files.map((f) => `${f.size}\t${f.path}`)].join("\n");
    }
    case "create": {
      const path = clean(input.path);
      if ((await getFile(path)) == null && (await countFiles()) >= MAX_FILES) throw new Error("La memoria está llena; borra o consolida archivos.");
      await putFile(path, String(input.file_text ?? ""), by);
      return `Archivo guardado: ${path}`;
    }
    case "str_replace": {
      const path = clean(input.path);
      const file = await getFile(path);
      if (file == null) throw new Error(`No existe ${path}.`);
      const old = String(input.old_str ?? "");
      const count = old ? file.split(old).length - 1 : 0;
      if (count !== 1) throw new Error(count === 0 ? "No encontré el texto a reemplazar." : `El texto aparece ${count} veces; usa un fragmento único.`);
      await putFile(path, file.replace(old, () => String(input.new_str ?? "")), by);
      return `Archivo actualizado: ${path}`;
    }
    case "insert": {
      const path = clean(input.path);
      const file = await getFile(path);
      if (file == null) throw new Error(`No existe ${path}.`);
      const lines = file.split("\n");
      const at = Math.max(0, Math.min(lines.length, Number(input.insert_line) || 0));
      lines.splice(at, 0, String(input.insert_text ?? "").replace(/\n$/, ""));
      await putFile(path, lines.join("\n"), by);
      return `Texto insertado en ${path} (línea ${at}).`;
    }
    case "delete": {
      const path = clean(input.path);
      if (path === "/memories") throw new Error("No se puede borrar toda la memoria.");
      if (!dbConfigured()) { for (const p of [...local.keys()]) if (p === path || p.startsWith(path + "/")) local.delete(p); return `Borrado: ${path}`; }
      await sql()`DELETE FROM memories WHERE path = ${path} OR path LIKE ${path + "/%"}`;
      return `Borrado: ${path}`;
    }
    case "rename": {
      const from = clean(input.old_path), to = clean(input.new_path);
      const file = await getFile(from);
      if (file == null) throw new Error(`No existe ${from}.`);
      if ((await getFile(to)) != null) throw new Error(`Ya existe ${to}.`);
      await putFile(to, file, by);
      if (dbConfigured()) await sql()`DELETE FROM memories WHERE path = ${from}`; else local.delete(from);
      return `Renombrado: ${from} → ${to}`;
    }
    default:
      throw new Error(`Comando de memoria desconocido: ${cmd}`);
  }
}

// Índice de la memoria (rutas, sin contenido) para que el agente sepa qué hay sin gastar una llamada.
export async function memoryIndex() {
  try {
    const files = await listUnder("/memories");
    return files.length ? files.map((f) => f.path).join("\n") : "(vacía)";
  } catch { return "(no disponible)"; }
}
