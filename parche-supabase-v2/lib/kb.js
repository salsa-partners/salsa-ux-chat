// Base de conocimiento en Supabase (solo servidor). Usa la API REST (PostgREST), sin dependencias.
export function kbConfigured() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export const KB_TOOL = {
  name: "consultar_base",
  description:
    "Busca en la base de datos de Salsa con la revisión detallada de Axo, Lucis y Zentum (textos exactos de cada sección, catálogos, precios, journeys, cómo se calcula el score). Úsala PRIMERO para cualquier pregunta sobre qué dice o hace una sección; no hace falta abrir el navegador. Devuelve fecha de revisión.",
  input_schema: {
    type: "object",
    properties: {
      consulta: { type: "string", description: "Palabras clave, p. ej. 'referidos' o 'precio panel hierro'. Vacío = lista todo de la plataforma." },
      plataforma: { type: "string", enum: ["axo", "lucis", "zentum", "comparativo"], description: "Opcional." },
    },
    required: ["consulta"],
  },
};

export async function consultarBase({ consulta = "", plataforma = null }) {
  const base = process.env.SUPABASE_URL.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const r = await fetch(`${base}/rest/v1/rpc/kb_search`, {
    method: "POST",
    headers: { apikey: key, ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}), "Content-Type": "application/json" },
    body: JSON.stringify({ q: String(consulta).slice(0, 200), plat: plataforma || null, lim: 12 }),
  });
  if (!r.ok) throw new Error("Base de datos: " + r.status);
  const rows = await r.json();
  if (!rows.length) return "Sin resultados en la base para esa consulta. Prueba con menos palabras o revisa en vivo.";
  return rows
    .map((e) => `[${e.platform} · ${e.section} · ${e.type}] ${e.title}${e.price != null ? ` (${e.price})` : ""}\n${e.content}\n(revisado ${e.reviewed_on}${e.path ? `, ${e.path}` : ""})`)
    .join("\n\n");
}
