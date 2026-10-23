import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "@/lib/knowledge";
import { isAuthorized } from "@/lib/access";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const MAX_TURNS = 16;
const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 4.5 * 1024 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

// Límite simple por IP (por instancia): 20 mensajes cada 10 minutos.
const hits = new Map();
function limited(ip) {
  const now = Date.now(), win = 10 * 60 * 1000;
  const arr = (hits.get(ip) || []).filter((t) => now - t < win);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > 20;
}

function toApiMessages(messages) {
  const out = [];
  for (const m of messages.slice(-MAX_TURNS)) {
    if (m.role !== "user" && m.role !== "assistant") continue;
    const text = String(m.text || "").slice(0, 8000);
    if (m.role === "user" && Array.isArray(m.images) && m.images.length) {
      const blocks = [];
      for (const img of m.images.slice(0, MAX_IMAGES)) {
        const match = /^data:(image\/[a-z]+);base64,(.+)$/.exec(String(img));
        if (!match || !IMAGE_TYPES.includes(match[1])) continue;
        if (match[2].length * 0.75 > MAX_IMAGE_BYTES) continue;
        blocks.push({ type: "image", source: { type: "base64", media_type: match[1], data: match[2] } });
      }
      blocks.push({ type: "text", text: text || "Analiza estas capturas." });
      out.push({ role: "user", content: blocks });
    } else if (text) {
      out.push({ role: m.role, content: text });
    }
  }
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}

export async function POST(req) {
  if (!isAuthorized(req)) return new Response("Necesitas el código de acceso.", { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return new Response("Falta configurar ANTHROPIC_API_KEY en el servidor.", { status: 500 });

  const ip = (req.headers.get("x-forwarded-for") || "anon").split(",")[0].trim();
  if (limited(ip)) return new Response("Muchos mensajes seguidos. Espera unos minutos.", { status: 429 });

  const body = await req.json().catch(() => null);
  const messages = toApiMessages(Array.isArray(body?.messages) ? body.messages : []);
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return new Response("Mensaje vacío.", { status: 400 });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const s = client.messages.stream({
          model: MODEL,
          max_tokens: 1500,
          system: SYSTEM_PROMPT,
          messages,
        });
        for await (const ev of s) {
          if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") {
            controller.enqueue(encoder.encode(ev.delta.text));
          }
        }
      } catch (e) {
        console.error(e);
        controller.enqueue(encoder.encode("\n\n[Error: no pude responder ahora. Intenta de nuevo en un momento.]"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
