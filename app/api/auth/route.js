import { accessRequired, isAuthorized, tokenFor } from "@/lib/access";

export async function GET(req) {
  return Response.json({ required: accessRequired(), ok: isAuthorized(req) });
}

export async function POST(req) {
  const { code } = await req.json().catch(() => ({}));
  if (!accessRequired()) return Response.json({ ok: true });
  if (String(code || "").trim() !== process.env.ACCESS_CODE) {
    return Response.json({ ok: false, error: "Código incorrecto." }, { status: 401 });
  }
  const res = Response.json({ ok: true });
  res.headers.set(
    "Set-Cookie",
    `salsa_access=${tokenFor(process.env.ACCESS_CODE)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`
  );
  return res;
}
