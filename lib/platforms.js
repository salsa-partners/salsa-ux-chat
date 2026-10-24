// Plataformas iniciales (las del benchmark Longevidad 2026); viven en db/seed-data.mjs. El registro completo
// está en la base (tabla platforms) y se administra en /admin o con la herramienta agregar_plataforma.
export { PLATFORMS } from "@/db/seed-data.mjs";

// ¿La URL pertenece a alguna plataforma registrada? (lista = filas de listPlatforms)
export function allowedUrl(u, list) {
  let url;
  try { url = new URL(u); } catch { return false; }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  const h = url.hostname.toLowerCase();
  const domains = list.flatMap((p) => p.domains || []);
  return domains.some((d) => h === d || h.endsWith("." + d));
}

export function platformFor(u, list) {
  let h;
  try { h = new URL(u).hostname.toLowerCase(); } catch { return null; }
  return list.find((p) => (p.domains || []).some((d) => h === d || h.endsWith("." + d))) || null;
}

// Heurística: ¿la página parece pedir iniciar sesión?
export const LOGIN_URL_RE = /(login|log-in|signin|sign-in|sign_in|auth|acceso|ingres|iniciar)/i;
