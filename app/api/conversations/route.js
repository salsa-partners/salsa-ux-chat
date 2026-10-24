import { isAuthorized, readSession } from "@/lib/access";
import { dbConfigured } from "@/lib/db";
import { upsertUser, listConversations, getConversation, conversationMessages, deleteConversation, listProjects, getProject, listPlatforms } from "@/lib/store";

export const runtime = "nodejs";

const json = (o, status = 200) => Response.json(o, { status, headers: { "Cache-Control": "no-store" } });

async function currentUser(req) {
  const s = readSession(req);
  return s ? upsertUser(s.email, s.name) : null;
}

// GET            -> { server, projects, platforms, conversations }
// GET ?id=...    -> { messages } de esa conversación (solo si es tuya)
export async function GET(req) {
  if (!isAuthorized(req)) return json({ error: "Sin acceso" }, 401);
  const url = new URL(req.url);
  const user = await currentUser(req).catch(() => null);
  const id = url.searchParams.get("id");
  if (id) {
    const c = user && (await getConversation(id, user.id));
    if (!c) return json({ error: "No encontrada" }, 404);
    const rows = await conversationMessages(c.id);
    return json({ messages: rows.map((m) => ({ role: m.role, text: m.text, steps: m.meta?.steps || [], files: m.meta?.files || [] })) });
  }
  const project = await getProject(url.searchParams.get("project")).catch(() => null);
  return json({
    server: dbConfigured(),
    projects: await listProjects().catch(() => []),
    platforms: project ? (await listPlatforms(project.id).catch(() => [])).map((p) => ({ slug: p.slug, name: p.name, login: p.requires_login })) : [],
    conversations: user ? await listConversations(user.id) : [],
  });
}

export async function DELETE(req) {
  if (!isAuthorized(req)) return json({ error: "Sin acceso" }, 401);
  const user = await currentUser(req);
  const id = new URL(req.url).searchParams.get("id");
  if (user && id) await deleteConversation(id, user.id);
  return json({ ok: true });
}
