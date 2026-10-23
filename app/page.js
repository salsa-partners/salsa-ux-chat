"use client";
import { useEffect, useRef, useState } from "react";

const SUGGESTIONS = [
  { c: "p", tag: "Comparar", q: "¿Qué app tiene la mejor experiencia y por qué?" },
  { c: "g", tag: "UX writing", q: "Compara cómo tratan al usuario: ¿tú o usted?" },
  { c: "b", tag: "Cuestionarios", q: "¿Cómo son las primeras preguntas de cada cuestionario?" },
  { c: "y", tag: "Pagos", q: "¿Qué copiamos del journey de pagos de cada una?" },
];

const STORE = "salsa-ux-chats-v1";
const uid = () => Math.random().toString(36).slice(2, 10);

function esc(s) { return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function inline(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
}
function md(src) {
  const lines = String(src).replace(/\r/g, "").split("\n");
  const out = []; let i = 0;
  const isRow = (l) => /^\s*\|.*\|\s*$/.test(l);
  while (i < lines.length) {
    const l = lines[i];
    if (isRow(l) && i + 1 < lines.length && /^\s*\|[\s:\-|]+\|\s*$/.test(lines[i + 1])) {
      const cells = (r) => r.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = cells(l); i += 2; const rows = [];
      while (i < lines.length && isRow(lines[i])) rows.push(cells(lines[i++]));
      out.push('<div class="tw"><table><thead><tr>' + head.map((h) => "<th>" + inline(h) + "</th>").join("") +
        "</tr></thead><tbody>" + rows.map((r) => "<tr>" + r.map((c) => "<td>" + inline(c) + "</td>").join("") + "</tr>").join("") + "</tbody></table></div>");
      continue;
    }
    if (/^\s*[-*•]\s+/.test(l)) { const it = []; while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) it.push(lines[i++].replace(/^\s*[-*•]\s+/, "")); out.push("<ul>" + it.map((x) => "<li>" + inline(x) + "</li>").join("") + "</ul>"); continue; }
    if (/^\s*\d+[.)]\s+/.test(l)) { const it = []; while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) it.push(lines[i++].replace(/^\s*\d+[.)]\s+/, "")); out.push("<ol>" + it.map((x) => "<li>" + inline(x) + "</li>").join("") + "</ol>"); continue; }
    if (/^#{1,4}\s+/.test(l)) { out.push("<p><strong>" + inline(l.replace(/^#{1,4}\s+/, "")) + "</strong></p>"); i++; continue; }
    if (!l.trim()) { i++; continue; }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^\s*([-*•]|\d+[.)]|#{1,4})\s+/.test(lines[i]) && !isRow(lines[i])) para.push(lines[i++]);
    out.push("<p>" + inline(para.join("\n")).replace(/\n/g, "<br>") + "</p>");
  }
  return out.join("");
}

function readFile(file) {
  return new Promise((res, rej) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 1568; let { width: w, height: h } = img;
      const k = Math.min(1, max / Math.max(w, h)); w = Math.round(w * k); h = Math.round(h * k);
      const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
      cv.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      res(cv.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("img")); };
    img.src = url;
  });
}

export default function Home() {
  const [chats, setChats] = useState([]);
  const [cur, setCur] = useState(null);
  const [input, setInput] = useState("");
  const [imgs, setImgs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [side, setSide] = useState(false);
  const [gate, setGate] = useState({ checked: false, required: false, ok: true });
  const [code, setCode] = useState("");
  const [gateErr, setGateErr] = useState("");
  const ctl = useRef(null);
  const scroller = useRef(null);
  const ta = useRef(null);

  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem(STORE) || "[]"); if (Array.isArray(s)) setChats(s); } catch {}
    fetch("/api/auth").then((r) => r.json()).then((j) => setGate({ checked: true, required: j.required, ok: j.ok })).catch(() => setGate({ checked: true, required: false, ok: true }));
  }, []);
  useEffect(() => {
    try { localStorage.setItem(STORE, JSON.stringify(chats.slice(0, 30).map((c) => ({ ...c, messages: c.messages.map((m) => ({ ...m, images: [] })) })))); } catch {}
  }, [chats]);
  useEffect(() => { if (!cur) { scroller.current?.scrollTo({ top: 0 }); return; } scroller.current?.scrollTo({ top: scroller.current.scrollHeight }); }, [chats, cur]);

  const chat = chats.find((c) => c.id === cur);
  const messages = chat?.messages || [];

  function update(id, fn) { setChats((cs) => cs.map((c) => (c.id === id ? fn(c) : c))); }

  async function send(text) {
    const t = (text ?? input).trim();
    if ((!t && !imgs.length) || busy) return;
    let id = cur;
    const userMsg = { role: "user", text: t || "Analiza estas capturas.", images: imgs };
    if (!id) {
      id = uid();
      setChats((cs) => [{ id, title: (t || "Análisis de capturas").slice(0, 60), messages: [userMsg] }, ...cs]);
      setCur(id);
    } else update(id, (c) => ({ ...c, messages: [...c.messages, userMsg] }));
    const history = [...messages, userMsg];
    setInput(""); setImgs([]); setBusy(true); setSide(false);
    setChats((cs) => cs.map((c) => (c.id === id ? { ...c, messages: [...c.messages, { role: "assistant", text: "", pending: true }] } : c)));

    ctl.current = new AbortController();
    let acc = "";
    try {
      const r = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: ctl.current.signal,
        body: JSON.stringify({ messages: history.map(({ role, text, images }) => ({ role, text, images })) }),
      });
      if (!r.ok) {
        acc = r.status === 401 ? "Necesitas el código de acceso." : (await r.text()) || "No pude responder ahora.";
        if (r.status === 401) setGate((g) => ({ ...g, required: true, ok: false }));
      } else {
        const reader = r.body.getReader(); const dec = new TextDecoder();
        for (;;) {
          const { value, done } = await reader.read(); if (done) break;
          acc += dec.decode(value, { stream: true });
          const snap = acc;
          setChats((cs) => cs.map((c) => (c.id === id ? { ...c, messages: c.messages.map((m, k, arr) => (k === arr.length - 1 ? { ...m, text: snap, pending: false } : m)) } : c)));
        }
      }
    } catch (e) {
      if (e.name !== "AbortError") acc = acc || "Se cortó la conexión. Intenta de nuevo.";
    } finally {
      const fin = acc || "(Detenido)";
      setChats((cs) => cs.map((c) => (c.id === id ? { ...c, messages: c.messages.map((m, k, arr) => (k === arr.length - 1 ? { role: "assistant", text: fin } : m)) } : c)));
      setBusy(false); ctl.current = null; ta.current?.focus();
    }
  }

  async function onFiles(e) {
    const files = [...(e.target.files || [])].slice(0, 4 - imgs.length);
    const urls = [];
    for (const f of files) { try { urls.push(await readFile(f)); } catch {} }
    setImgs((x) => [...x, ...urls].slice(0, 4));
    e.target.value = "";
  }

  async function enter(e) {
    e.preventDefault(); setGateErr("");
    const r = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    if (r.ok) setGate((g) => ({ ...g, ok: true })); else setGateErr("Código incorrecto. Pídeselo a quien te compartió el link.");
  }

  return (
    <div className="app">
      {gate.checked && gate.required && !gate.ok && (
        <div className="gate">
          <form onSubmit={enter}>
            <div className="s" aria-hidden="true">S</div>
            <h2>Benchmark UX</h2>
            <p>Escribe el código de acceso que te compartió Salsa.</p>
            <input id="code" autoFocus value={code} onChange={(e) => setCode(e.target.value)} placeholder="Código de acceso" aria-label="Código de acceso" />
            {gateErr && <div className="err">{gateErr}</div>}
            <button type="submit">Entrar</button>
          </form>
        </div>
      )}

      <div className={"scrim" + (side ? " on" : "")} onClick={() => setSide(false)} />
      <aside className={"side" + (side ? " open" : "")}>
        <div className="brand"><span className="s" aria-hidden="true">S</span><span><b>Benchmark UX</b><small>Salsa</small></span></div>
        <button className="newchat" onClick={() => { setCur(null); setSide(false); }}>+ Nuevo chat</button>
        <div className="apps"><span style={{ background: "var(--purple-pale)" }}>Axo</span><span style={{ background: "var(--green-pale)" }}>Lucis</span><span style={{ background: "var(--blue-pale)" }}>Zentum</span></div>
        <div className="hist">
          {chats.length > 0 && <div className="lab">Tus chats</div>}
          {chats.map((c) => (
            <button key={c.id} className={c.id === cur ? "on" : ""} onClick={() => { setCur(c.id); setSide(false); }} title={c.title}>{c.title}</button>
          ))}
        </div>
        <div className="foot">Tus chats se guardan solo en este navegador.</div>
      </aside>

      <section className="main">
        <div className="top">
          <button className="menu" onClick={() => setSide(true)} aria-label="Abrir menú">☰</button>
          <h1>{chat ? chat.title : "Agente Benchmark UX"}</h1>
        </div>

        <div className="scroll" ref={scroller}>
          {!chat ? (
            <div className="empty">
              <h2>¿Qué quieres saber de <em>Axo, Lucis o Zentum</em>?</h2>
              <p>Soy el agente de benchmark UX de Salsa. Comparo la experiencia y el UX writing de las tres apps. También puedo analizar capturas que subas.</p>
              <div className="sugs">
                {SUGGESTIONS.map((s) => (
                  <button key={s.q} className={"sug " + s.c} onClick={() => send(s.q)}><small>{s.tag}</small>{s.q}</button>
                ))}
              </div>
            </div>
          ) : (
            <div className="thread">
              {messages.map((m, k) => m.role === "user" ? (
                <div className="m user" key={k}>
                  <div className="bub">{m.text}{m.images?.length > 0 && <div className="thumbs">{m.images.map((src, j) => <img key={j} src={src} alt="Captura adjunta" />)}</div>}</div>
                </div>
              ) : (
                <div className="m bot" key={k}>
                  <div className="av" aria-hidden="true">S</div>
                  <div className="body">{m.pending ? <span className="dots"><span /><span /><span /></span> : <div dangerouslySetInnerHTML={{ __html: md(m.text) }} />}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="compwrap">
          <form className="comp" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <textarea ref={ta} id="msg" rows={1} value={input} placeholder="Pregunta sobre Axo, Lucis o Zentum…" aria-label="Tu mensaje"
              onChange={(e) => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
            <div className="row">
              <div className="attach">
                <label htmlFor="files">Adjuntar capturas</label>
                <input id="files" type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={onFiles} />
                {imgs.map((_, j) => <span className="chipf" key={j}>Captura {j + 1}<button type="button" aria-label="Quitar" onClick={() => setImgs((x) => x.filter((__, n) => n !== j))}>×</button></span>)}
              </div>
              {busy
                ? <button type="button" className="send stop" onClick={() => ctl.current?.abort()}>Detener</button>
                : <button type="submit" className="send" disabled={!input.trim() && !imgs.length}>Enviar</button>}
            </div>
          </form>
          <div className="hint">Responde solo sobre el benchmark de Axo, Lucis y Zentum hecho por Salsa. Puede equivocarse: revisa los datos clave.</div>
        </div>
      </section>
    </div>
  );
}
