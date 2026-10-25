import crypto from "node:crypto";
import { accessRequired, codeMatches, emailAllowed, sessionCookie, clearCookie, readSession, deviceId, deviceCookie } from "@/lib/access";
import { upsertUser } from "@/lib/store";
import { dbConfigured } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req) {
  const s = readSession(req);
  // Con base de datos se crea una sesión aunque no haya código, para guardar el historial de cada navegador.
  const required = accessRequired() || dbConfigured();
  return Response.json({ required, codeRequired: accessRequired(), ok: !required || Boolean(s), user: s });
}

// Entrar solo con el código. Nombre y correo son opcionales: sin correo, la identidad es el navegador
// (cookie salsa_device de larga duración), así el historial se conserva aunque se cierre sesión.
export async function POST(req) {
  const { code, email, name } = await req.json().catch(() => ({}));
  if (accessRequired() && !codeMatches(code)) {
    return Response.json({ ok: false, error: "Código incorrecto." }, { status: 401 });
  }
  const mail = String(email || "").trim().toLowerCase();
  if (mail && !emailAllowed(mail)) {
    return Response.json({ ok: false, error: "Ese correo no está permitido." }, { status: 400 });
  }
  const device = deviceId(req) || crypto.randomUUID();
  const id = mail || `navegador-${device}`;
  const nombre = String(name || "").trim().slice(0, 80);
  await upsertUser(id, nombre).catch((e) => console.error("user", e?.message));
  const res = Response.json({ ok: true, user: { email: mail || null, name: nombre } });
  res.headers.append("Set-Cookie", sessionCookie(id, nombre));
  res.headers.append("Set-Cookie", deviceCookie(device));
  return res;
}

export async function DELETE() {
  const res = Response.json({ ok: true });
  res.headers.set("Set-Cookie", clearCookie());
  return res;
}
