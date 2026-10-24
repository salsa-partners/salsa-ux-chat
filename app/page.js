"use client";
import { useEffect, useRef, useState } from "react";

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


function download(f) {
  const bin = atob(f.b64); const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([u8], { type: f.mime }));
  const a = document.createElement("a"); a.href = url; a.download = f.name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
function FileCard({ f }) {
  return (
    <div className="file">
      <div className="fi">XLSX</div>
      <div className="fn"><strong>{f.name}</strong><small>{f.b64 || f.url ? "Excel con capturas incrustadas" : "Generado antes. Pide la revisión de nuevo para descargarlo."}</small></div>
      {f.b64 ? <button type="button" onClick={() => download(f)}>Descargar</button> : f.url ? <a href={f.url} download={f.name}>Descargar</a> : null}
    </div>
  );
}
function Steps({ steps, live }) {
  const shown = steps.slice(-8);
  return (
    <div className={"steps" + (live ? " live" : "")}>
      {shown.map((t, i) => <div key={i} className={i === shown.length - 1 && live ? "now" : ""}>{t}</div>)}
      {steps.length > 8 && <div className="more">+{steps.length - 8} pasos anteriores</div>}
    </div>
  );
}

const CHIP = ["var(--purple-pale)", "var(--green-pale)", "var(--blue-pale)", "var(--yellow-pale)"];

export default function Home() {
  const [chats, setChats] = useState([]);
  const [cur, setCur] = useState(null);
  const [input, setInput] = useState("");
  const [imgs, setImgs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [side, setSide] = useState(false);
  const [gate, setGate] = useState({ checked: false, required: false, codeRequired: false, ok: true, user: null });
  const [form, setForm] = useState({ code: "", name: "", email: "" });
  const [gateErr, setGateErr] = useState("");
  const [ws, setWs] = useState({ server: false, projects: [], platforms: [] });
  const [project, setProject] = useState("");
  const [hydrated, setHydrated] = useState(false); // evita borrar los chats locales antes de leerlos
  const ctl = useRef(null);
  const scroller = useRef(null);
  const ta = useRef(null);

  // Carga el espacio de trabajo: con servidor, el historial viene de la base; sin él, del navegador.
  async function loadWorkspace(slug) {
    try {
      const r = await fetch("/api/conversations" + (slug ? `?project=${encodeURIComponent(slug)}` : ""));
      if (!r.ok) return;
      const j = await r.json();
      setWs({ server: j.server, projects: j.projects || [], platforms: j.platforms || [] });
      if (!slug && j.projects?.[0]) setProject((p) => p || j.projects[0].slug);
      if (j.server) setChats((cs) => {
        const known = new Map(cs.map((c) => [c.id, c]));
        return j.conversations.map((c) => known.get(c.id) || { id: c.id, title: c.title, project: c.project, messages: [], loaded: false });
      });
      else { try { const s = JSON.parse(localStorage.getItem(STORE) || "[]"); if (Array.isArray(s)) setChats(s); } catch {} setHydrated(true); }
    } catch {}
  }

  useEffect(() => {
    fetch("/api/auth").then((r) => r.json()).then((j) => {
      setGate({ checked: true, required: j.required, codeRequired: j.codeRequired, ok: j.ok, user: j.user });
      if (j.ok) loadWorkspace();
    }).catch(() => setGate({ checked: true, required: false, ok: true }));
  }, []);
  useEffect(() => { if (project) loadWorkspace(project); }, [project]);
  useEffect(() => {
    if (ws.server || !hydrated) return;
    try { localStorage.setItem(STORE, JSON.stringify(chats.slice(0, 30).map((c) => ({ ...c, messages: c.messages.map((m) => ({ ...m, images: [], status: "", files: (m.files || []).map((f) => ({ name: f.name, url: f.url })) })) })))); } catch {}
  }, [chats, ws.server, hydrated]);
  useEffect(() => { if (!cur) { scroller.current?.scrollTo({ top: 0 }); return; } scroller.current?.scrollTo({ top: scroller.current.scrollHeight }); }, [chats, cur]);

  const chat = chats.find((c) => c.id === cur);
  const messages = chat?.messages || [];

  function update(id, fn) { setChats((cs) => cs.map((c) => (c.id === id ? fn(c) : c))); }

  async function openChat(c) {
    setCur(c.id); setSide(false);
    if (ws.server && !c.loaded) {
      const r = await fetch(`/api/conversations?id=${c.id}`);
      if (r.ok) { const j = await r.json(); update(c.id, (x) => ({ ...x, messages: j.messages, loaded: true })); }
    }
  }

  async function removeChat(c) {
    if (!confirm(`¿Borrar el chat «${c.title}»?`)) return;
    if (ws.server) await fetch(`/api/conversations?id=${c.id}`, { method: "DELETE" });
    setChats((cs) => cs.filter((x) => x.id !== c.id));
    if (cur === c.id) setCur(null);
  }

  async function send(text) {
    const t = (text ?? input).trim();
    if ((!t && !imgs.length) || busy) return;
    let id = cur;
    const isNew = !id;
    const userMsg = { role: "user", text: t || "Analiza estas capturas.", images: imgs };
    if (isNew) {
      id = uid();
      setChats((cs) => [{ id, title: (t || "Análisis de capturas").slice(0, 60), project, messages: [userMsg], loaded: true }, ...cs]);
      setCur(id);
    } else update(id, (c) => ({ ...c, messages: [...c.messages, userMsg] }));
    const history = messages.map(({ role, text }) => ({ role, text }));
    setInput(""); setImgs([]); setBusy(true); setSide(false);
    update(id, (c) => ({ ...c, messages: [...c.messages, { role: "assistant", text: "", pending: true }] }));

    ctl.current = new AbortController();
    let acc = "";
    const meta = { steps: [], files: [], status: "" };
    try {
      const r = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: ctl.current.signal,
        body: JSON.stringify({ conversationId: isNew ? null : id, project: chat?.project || project, message: { text: t, images: userMsg.images }, history }),
      });
      if (!r.ok) {
        acc = r.status === 401 ? "Necesitas el código de acceso." : (await r.text()) || "No pude responder ahora.";
        if (r.status === 401) setGate((g) => ({ ...g, required: true, ok: false }));
      } else {
        const reader = r.body.getReader(); const dec = new TextDecoder();
        let buf = "";
        const push = () => {
          const snap = { text: acc, steps: [...meta.steps], files: [...meta.files], status: meta.status };
          update(id, (c) => ({ ...c, messages: c.messages.map((m, k, arr) => (k === arr.length - 1 ? { ...m, ...snap, pending: !snap.text && !snap.status } : m)) }));
        };
        const handle = (line) => {
          if (!line.trim()) return;
          let ev; try { ev = JSON.parse(line); } catch { return; }
          if (ev.t === "text") acc += ev.d;
          else if (ev.t === "status") { meta.status = ev.d; meta.steps.push(ev.d); }
          else if (ev.t === "file") { meta.files.push({ name: ev.name, mime: ev.mime, b64: ev.b64, url: ev.url }); meta.status = "Excel listo"; }
          else if (ev.t === "meta" && ev.conversationId && ev.conversationId !== id) {
            // El servidor creó la conversación: se usa su id desde ahora.
            const old = id; id = ev.conversationId;
            setChats((cs) => cs.map((c) => (c.id === old ? { ...c, id, project: ev.project } : c)));
            setCur(id);
          }
        };
        for (;;) {
          const { value, done } = await reader.read(); if (done) break;
          buf += dec.decode(value, { stream: true });
          const parts = buf.split("\n"); buf = parts.pop();
          parts.forEach(handle); push();
        }
        handle(buf); meta.status = ""; push();
      }
    } catch (e) {
      if (e.name !== "AbortError") acc = acc || "Se cortó la conexión. Intenta de nuevo.";
    } finally {
      const fin = acc || "(Detenido)";
      update(id, (c) => ({ ...c, messages: c.messages.map((m, k, arr) => (k === arr.length - 1 ? { role: "assistant", text: fin, steps: meta.steps, files: meta.files } : m)) }));
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
    const r = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { setGate((g) => ({ ...g, ok: true, user: j.user })); loadWorkspace(); }
    else setGateErr(j.error === "Código incorrecto." ? "Código incorrecto. Pídeselo a quien te compartió el link." : j.error || "No pude entrar.");
  }

  async function logout() {
    await fetch("/api/auth", { method: "DELETE" });
    setChats([]); setCur(null); setGate((g) => ({ ...g, ok: false, user: null }));
  }

  const names = ws.platforms.slice(0, 6).map((p) => p.name);
  const list = names.length > 1 ? names.slice(0, -1).join(", ") + " o " + names[names.length - 1] : names[0] || "cualquier plataforma";

  return (
    <div className="app">
      {gate.checked && gate.required && !gate.ok && (
        <div className="gate">
          <form onSubmit={enter}>
            <div className="s" aria-hidden="true">S</div>
            <h2>Agente UX</h2>
            <p>Entra con tu correo de trabajo para guardar tu historial.</p>
            <input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Tu nombre" aria-label="Tu nombre" />
            <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Correo de trabajo" aria-label="Correo de trabajo" />
            {gate.codeRequired && <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Código de acceso" aria-label="Código de acceso" />}
            {gateErr && <div className="err">{gateErr}</div>}
            <button type="submit">Entrar</button>
          </form>
        </div>
      )}

      <div className={"scrim" + (side ? " on" : "")} onClick={() => setSide(false)} />
      <aside className={"side" + (side ? " open" : "")}>
        <div className="brand"><span className="s" aria-hidden="true">S</span><span><b>Agente UX</b><small>Salsa</small></span></div>
        <button className="newchat" onClick={() => { setCur(null); setSide(false); }}>+ Nuevo chat</button>
        {ws.projects.length > 1 && (
          <select value={project} onChange={(e) => { setProject(e.target.value); setCur(null); }} aria-label="Proyecto">
            {ws.projects.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
          </select>
        )}
        <div className="apps">{ws.platforms.slice(0, 8).map((p, i) => <span key={p.slug} style={{ background: CHIP[i % CHIP.length] }}>{p.name}</span>)}</div>
        <div className="hist">
          {chats.length > 0 && <div className="lab">Tus chats</div>}
          {chats.map((c) => (
            <div className="row" key={c.id}>
              <button className={c.id === cur ? "on" : ""} style={{ flex: 1 }} onClick={() => openChat(c)} title={c.title}>{c.title}</button>
              <button className="del" aria-label="Borrar chat" onClick={() => removeChat(c)}>×</button>
            </div>
          ))}
        </div>
        <div className="foot who">
          <span>{ws.server ? (gate.user?.name || gate.user?.email || "Tus chats se guardan en tu cuenta.") : "Tus chats se guardan solo en este navegador."}</span>
          {gate.user && <button onClick={logout}>Salir</button>}
        </div>
      </aside>

      <section className="main">
        <div className="top">
          <button className="menu" onClick={() => setSide(true)} aria-label="Abrir menú">☰</button>
          <h1>{chat ? chat.title : "Agente UX"}</h1>
        </div>

        <div className="scroll" ref={scroller}>
          {!chat ? (
            <div className="empty">
              <h2>¿Qué quieres saber de <em>{list}</em>?</h2>
              <p>Soy el agente UX de Salsa. Comparo experiencias y UX writing, reviso plataformas en vivo con capturas, investigo en la web y respondo dudas de UX. También analizo capturas que subas.</p>
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
                  <div className="body">
                    {m.steps?.length > 0 && <Steps steps={m.steps} live={!!m.status && m.status !== "Excel listo"} />}
                    {m.pending ? <span className="dots"><span /><span /><span /></span> : m.text ? <div dangerouslySetInnerHTML={{ __html: md(m.text) }} /> : null}
                    {m.files?.map((f, j) => <FileCard key={j} f={f} />)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="compwrap">
          <form className="comp" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <textarea ref={ta} id="msg" rows={1} value={input} placeholder="Pregunta, pide un benchmark o una revisión en vivo…" aria-label="Tu mensaje"
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
          <div className="hint">Agente UX de Salsa. Cita la fuente de cada dato y puede equivocarse: revisa los datos clave.</div>
        </div>
      </section>
    </div>
  );
}
