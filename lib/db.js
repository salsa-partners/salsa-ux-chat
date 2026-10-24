import { neon } from "@neondatabase/serverless";
import { put } from "@vercel/blob";

// La app funciona sin base de datos (modo demo): sin DATABASE_URL no guarda nada en el servidor.
export function dbConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function blobConfigured() {
  // OIDC (BLOB_STORE_ID, lo crea Vercel al conectar el store) o token estático (BLOB_READ_WRITE_TOKEN).
  return Boolean(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);
}

let _sql = null;
export function sql() {
  if (!_sql) _sql = neon(process.env.DATABASE_URL);
  return _sql;
}

// Sube un archivo a Vercel Blob. El nombre lleva un sufijo aleatorio: la URL no se puede adivinar.
export async function saveBlob(path, body, contentType) {
  if (!blobConfigured()) return null;
  try {
    const b = await put(path, body, { access: "public", contentType, addRandomSuffix: true });
    return b.url;
  } catch (e) {
    console.error("blob", e?.message);
    return null;
  }
}
