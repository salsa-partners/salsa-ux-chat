import crypto from "node:crypto";

// Acceso: un código compartido (ACCESS_CODE). La identidad es el correo si la persona lo da, o su navegador.
// La sesión va en una cookie firmada (HMAC con SESSION_SECRET); no se guarda nada sensible en ella.
const COOKIE = "salsa_session";
const MAX_AGE = 60 * 60 * 24 * 30;

const secret = () => process.env.SESSION_SECRET || process.env.ANTHROPIC_API_KEY || "salsa";
const sign = (v) => crypto.createHmac("sha256", secret()).update(v).digest("base64url");

function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// Si ACCESS_CODE está vacío, el chat es abierto (útil solo en desarrollo).
export function accessRequired() {
  return Boolean(process.env.ACCESS_CODE);
}

export function codeMatches(code) {
  return safeEqual(String(code || "").trim(), process.env.ACCESS_CODE || "");
}

// Dominios de correo permitidos, separados por coma (opcional). Ej: salsagrowth.la,salsa.partners
export function emailAllowed(email) {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return false;
  const list = (process.env.ALLOWED_EMAIL_DOMAINS || "").split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);
  return !list.length || list.includes(email.split("@")[1].toLowerCase());
}

export function sessionCookie(email, name) {
  const payload = Buffer.from(JSON.stringify({ e: email, n: name || "", x: Date.now() + MAX_AGE * 1000 })).toString("base64url");
  return `${COOKIE}=${payload}.${sign(payload)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`;
}

// Identificador del navegador (1 año): mantiene el historial aunque se cierre sesión y se vuelva a entrar.
const DEVICE = "salsa_device";
export function deviceId(req) {
  const m = (req.headers.get("cookie") || "").match(new RegExp(`(?:^|;\\s*)${DEVICE}=([0-9a-f-]{36})`));
  return m ? m[1] : null;
}
export function deviceCookie(id) {
  return `${DEVICE}=${id}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 365}`;
}

export function clearCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

// Devuelve { email, name } si la cookie es válida; si no, null.
export function readSession(req) {
  const m = (req.headers.get("cookie") || "").match(new RegExp(`(?:^|;\\s*)${COOKIE}=([A-Za-z0-9_-]+)\\.([A-Za-z0-9_-]+)`));
  if (!m || !safeEqual(sign(m[1]), m[2])) return null;
  try {
    const s = JSON.parse(Buffer.from(m[1], "base64url").toString());
    if (!s.e || s.x < Date.now()) return null;
    return { email: s.e, name: s.n };
  } catch { return null; }
}

export function isAuthorized(req) {
  return !accessRequired() || Boolean(readSession(req));
}
