import { accessRequired, codeMatches, emailAllowed, sessionCookie, clearCookie, readSession } from "@/lib/access";
import { upsertUser } from "@/lib/store";
import { dbConfigured } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req) {
  const s = readSession(req);
  // Con base de datos se pide el correo aunque no haya código, para guardar el historial de cada persona.
  const required = accessRequired() || dbConfigured();
  return Response.json({ required, codeRequired: accessRequired(), ok: !required || Boolean(s), user: s });
}

export async function POST(req) {
  const { code, email, name } = await req.json().catch(() => ({}));
  const mail = String(email || "").trim().toLowerCase();
  if (accessRequired() && !codeMatches(code)) {
    return Response.json({ ok: false, error: "Código incorrecto." }, { status: 401 });
  }
  if (!emailAllowed(mail)) {
    return Response.json({ ok: false, error: "Escribe tu correo de trabajo." }, { status: 400 });
  }
  const nombre = String(name || "").trim().slice(0, 80);
  await upsertUser(mail, nombre).catch((e) => console.error("user", e?.message));
  const res = Response.json({ ok: true, user: { email: mail, name: nombre } });
  res.headers.set("Set-Cookie", sessionCookie(mail, nombre));
  return res;
}

export async function DELETE() {
  const res = Response.json({ ok: true });
  res.headers.set("Set-Cookie", clearCookie());
  return res;
}
