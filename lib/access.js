import crypto from "node:crypto";

// Si ACCESS_CODE está vacío, el chat es abierto.
export function accessRequired() {
  return Boolean(process.env.ACCESS_CODE);
}

export function tokenFor(code) {
  return crypto.createHmac("sha256", process.env.ANTHROPIC_API_KEY || "salsa").update(String(code)).digest("hex");
}

export function isAuthorized(req) {
  if (!accessRequired()) return true;
  const cookie = req.headers.get("cookie") || "";
  const m = cookie.match(/(?:^|;\s*)salsa_access=([a-f0-9]+)/);
  return Boolean(m && m[1] === tokenFor(process.env.ACCESS_CODE));
}
