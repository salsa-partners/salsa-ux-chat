"use client";
import { useState } from "react";

const Ok = ({ v, yes = "lista", no = "falta" }) => <b className={v ? "good" : "bad"}>{v ? yes : no}</b>;
const fmt = (n) => Number(n || 0).toLocaleString("es-PE");

export default function Admin() {
  const [code, setCode] = useState("");
  const [st, setSt] = useState(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");
  const [ctxId, setCtxId] = useState("");
  const [sess, setSess] = useState(null);
  const [check, setCheck] = useState(null);
  const [ev, setEv] = useState(null);
  const [np, setNp] = useState({ nombre: "", url: "", app: "", login: false, proyecto: "" });
  const [pr, setPr] = useState({ nombre: "", cliente: "", sector: "", brief: "" });

  async function call(action, extra = {}) {
    setBusy(action); setMsg("");
    try {
      const r = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json", "x-admin-code": code }, body: JSON.stringify({ action, ...extra }) });
      const j = await r.json();
      if (!r.ok) { setMsg(j.error || "Error"); return null; }
      return j;
    } catch { setMsg("No pude conectar."); return null; }
    finally { setBusy(""); }
  }
  const refresh = async () => { const j = await call("status"); if (j) setSt(j); };

  async function entrar(e) { e.preventDefault(); await refresh(); }
  async function initDb() { const j = await call("init_db"); if (j) { setMsg("Base lista. Proyecto inicial: " + j.project); refresh(); } }
  async function crearCtx() { const j = await call("crear_contexto"); if (j) setCtxId(j.id); }
  async function iniciar() { const j = await call("iniciar"); if (j) setSess(j); }
  async function ir(p) { await call("ir", { sessionId: sess.sessionId, connectUrl: sess.connectUrl, plataforma: p }); }
  async function terminar() { const j = await call("terminar", { sessionId: sess.sessionId }); if (j) { setSess(null); setMsg("Sesión guardada. Pulsa «Revisar sesiones» para confirmar."); } }
  async function revisar() { setCheck(null); const j = await call("revisar"); if (j) setCheck(j.resultado); }
  async function agregar(e) { e.preventDefault(); const j = await call("agregar_plataforma", np); if (j) { setSt((s) => ({ ...s, platforms: j.platforms })); setNp({ nombre: "", url: "", app: "", login: false, proyecto: np.proyecto }); } }
  async function activar(slug, activa) { const j = await call("activar_plataforma", { slug, activa }); if (j) setSt((s) => ({ ...s, platforms: j.platforms })); }
  async function crearProyecto(e) { e.preventDefault(); const j = await call("crear_proyecto", pr); if (j) { setSt((s) => ({ ...s, projects: j.projects })); setPr({ nombre: "", cliente: "", sector: "", brief: "" }); } }
  async function evals() { setEv(null); const j = await call("evals"); if (j) { setEv(j); refresh(); } }

  const Btn = ({ k, onClick, children, ghost, type = "button" }) => (
    <button type={type} className={"abtn" + (ghost ? " ghost" : "")} disabled={!!busy} onClick={onClick}>{busy === k ? "Un momento…" : children}</button>
  );
  const loginPlatforms = (st?.platforms || []).filter((p) => p.requires_login && p.active);

  return (
    <main className="adm">
      <div className="ahead"><span className="alogo">S</span><div><h1>Administración del agente</h1><p>Configuración, plataformas, sesiones del navegador y calidad. El agente nunca conoce contraseñas: tú inicias sesión y él reutiliza esa sesión.</p></div></div>

      {!st ? (
        <form onSubmit={entrar} className="acard">
          <label>Código de administrador</label>
          <input type="password" value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
          <Btn k="status" type="submit">Entrar</Btn>
          {msg && <p className="aerr">{msg}</p>}
        </form>
      ) : (
        <>
          <section className="acard">
            <h2>1. Estado</h2>
            <ul className="chk">
              <li>Anthropic (ANTHROPIC_API_KEY): <Ok v={st.anthropic} /> · modelo <code>{st.model}</code> · investigación web: <Ok v={st.web} yes="activa" no="apagada" /></li>
              <li>Base de datos (DATABASE_URL, Neon): <Ok v={st.db} /> · archivos (BLOB_READ_WRITE_TOKEN): <Ok v={st.blob} /></li>
              <li>Navegador (BROWSERBASE_API_KEY): <Ok v={st.apiKey} /> · contexto (BROWSERBASE_CONTEXT_ID): <Ok v={st.contextId} /></li>
            </ul>
            {st.spend && st.budgets && <p><b>Este mes:</b> US${st.spend.monthUsd.toFixed(2)} de US${st.budgets.monthlyUsd} · navegador {st.spend.browserMinutes.toFixed(1)} de {st.budgets.browserMinutesMonthly} min · tope por persona US${st.budgets.dailyUsdPerUser}/día · por respuesta US${st.budgets.runUsd}</p>}
            {st.usage && <p className="note">Últimos 30 días: {fmt(st.usage.ejecuciones)} respuestas ({fmt(st.usage.en_vivo)} en vivo, {fmt(st.usage.errores)} con error) · {fmt(st.usage.input_tokens)} tokens de entrada ({fmt(st.usage.cache_read_tokens)} desde caché) · {fmt(st.usage.output_tokens)} de salida · {st.usage.segundos_promedio ?? "–"} s promedio. Costo: US${st.usage.costo_usd ?? 0} · {st.usage.busquedas_web ?? 0} búsquedas web · {st.usage.minutos_navegador ?? 0} min de navegador.</p>}
            {st.db && <Btn k="init_db" ghost onClick={initDb}>Preparar / actualizar base de datos</Btn>}
            {!st.db && <p className="note">Sin base de datos el chat funciona, pero no guarda historial, hallazgos ni memoria. Conecta Neon desde Vercel → Storage y haz Redeploy.</p>}
          </section>

          <section className="acard">
            <h2>2. Plataformas</h2>
            <p>Solo se puede navegar en los dominios de plataformas activas. Las públicas también las puede registrar el agente desde el chat.</p>
            <ul className="chk">
              {(st.platforms || []).map((p) => (
                <li key={p.slug}><b>{p.name}</b> <small>({p.slug} · {(p.domains || []).join(", ")} · {p.requires_login ? "requiere sesión" : "pública"})</small>{" "}
                  {st.db && <button type="button" className="link" onClick={() => activar(p.slug, !p.active)}>{p.active ? "Desactivar" : "Activar"}</button>}
                  {!p.active && <span className="bad"> inactiva</span>}
                </li>
              ))}
            </ul>
            {st.db && (
              <form onSubmit={agregar} className="agrid">
                <input placeholder="Nombre (ej. Rappi)" value={np.nombre} onChange={(e) => setNp({ ...np, nombre: e.target.value })} required />
                <input placeholder="Sitio https://..." value={np.url} onChange={(e) => setNp({ ...np, url: e.target.value })} required />
                <input placeholder="URL de la app con sesión (opcional)" value={np.app} onChange={(e) => setNp({ ...np, app: e.target.value })} />
                <select value={np.proyecto} onChange={(e) => setNp({ ...np, proyecto: e.target.value })}>
                  <option value="">Sin proyecto</option>
                  {(st.projects || []).map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
                </select>
                <label className="chkbox"><input type="checkbox" checked={np.login} onChange={(e) => setNp({ ...np, login: e.target.checked })} /> Requiere iniciar sesión</label>
                <Btn k="agregar_plataforma" type="submit">Agregar plataforma</Btn>
              </form>
            )}
          </section>

          <section className="acard">
            <h2>3. Proyectos</h2>
            <p>Cada proyecto es un estudio (cliente + plataformas). Su resumen se le da al agente como contexto y sus hallazgos se guardan aparte.</p>
            <ul className="chk">{(st.projects || []).map((p) => <li key={p.slug}><b>{p.name}</b> <small>({p.slug}{p.client ? ` · ${p.client}` : ""}{p.sector ? ` · ${p.sector}` : ""})</small></li>)}</ul>
            {st.db && (
              <form onSubmit={crearProyecto} className="agrid">
                <input placeholder="Nombre del proyecto" value={pr.nombre} onChange={(e) => setPr({ ...pr, nombre: e.target.value })} required />
                <input placeholder="Cliente" value={pr.cliente} onChange={(e) => setPr({ ...pr, cliente: e.target.value })} />
                <input placeholder="Sector" value={pr.sector} onChange={(e) => setPr({ ...pr, sector: e.target.value })} />
                <textarea placeholder="Brief: objetivo, público, journeys a evaluar, resultados previos…" value={pr.brief} onChange={(e) => setPr({ ...pr, brief: e.target.value })} rows={4} />
                <Btn k="crear_proyecto" type="submit">Crear o actualizar proyecto</Btn>
              </form>
            )}
          </section>

          <section className="acard">
            <h2>4. Sesiones del navegador</h2>
            {!st.apiKey && <p className="note">Crea la cuenta en browserbase.com, copia tu API Key y pégala en Vercel como BROWSERBASE_API_KEY. Luego haz Redeploy.</p>}
            {st.apiKey && !st.contextId && (
              <>
                <Btn k="crear_contexto" onClick={crearCtx}>Crear espacio de sesión</Btn>
                {ctxId && <p className="note">Copia este ID y pégalo en Vercel como <b>BROWSERBASE_CONTEXT_ID</b>. Luego haz Redeploy y vuelve aquí.<br /><code>{ctxId}</code></p>}
              </>
            )}
            {st.apiKey && st.contextId && (
              <>
                {!sess ? (
                  <>
                    <p>Se abre un navegador en la nube. Entra a cada plataforma que requiere sesión, inicia sesión tú y pulsa «Guardar sesión».</p>
                    <Btn k="iniciar" onClick={iniciar}>Abrir navegador</Btn>
                  </>
                ) : (
                  <>
                    <div className="arow">
                      {loginPlatforms.map((p) => <Btn key={p.slug} k="ir" ghost onClick={() => ir(p.slug)}>Ir a {p.name}</Btn>)}
                      <Btn k="terminar" onClick={terminar}>Guardar sesión y cerrar</Btn>
                    </div>
                    <iframe className="live" src={sess.liveUrl} title="Navegador en vivo" allow="clipboard-read; clipboard-write" />
                    <p className="note">Escribe tus datos directamente en esta ventana. Usa cuentas de prueba siempre que se pueda.</p>
                  </>
                )}
                <p style={{ marginTop: 16 }}>Revisa si las sesiones siguen activas. Repite el paso anterior cuando alguna venza.</p>
                <Btn k="revisar" ghost onClick={revisar}>Revisar sesiones</Btn>
                {check && <ul className="chk">{loginPlatforms.map((p) => <li key={p.slug}><b>{p.name}</b>: {check[p.slug]?.ok ? <span className="good">sesión activa</span> : <span className="bad">{check[p.slug]?.error ? "error: " + check[p.slug].error : "pide iniciar sesión"}</span>}</li>)}</ul>}
              </>
            )}
          </section>

          <section className="acard">
            <h2>5. Calidad (evals)</h2>
            <p>Corre 12 preguntas de control (conocimiento, honestidad, privacidad, seguridad, método UX) y otro modelo califica. Hazlo después de cambiar el prompt, el modelo o el contexto del proyecto. Tarda ~1 minuto y consume tokens.</p>
            <Btn k="evals" onClick={evals}>Correr evals</Btn>
            {ev && (
              <>
                <p><b className={ev.passed === ev.total ? "good" : "bad"}>{ev.passed}/{ev.total} aprobadas</b> · modelo {ev.model} · juez {ev.judgeModel}</p>
                <ul className="chk">{ev.results.map((r) => <li key={r.id}><b className={r.passed ? "good" : "bad"}>{r.passed ? "✓" : "✗"}</b> <b>{r.id}</b>: {r.reason}<details><summary>Ver respuesta</summary><p className="note" style={{ whiteSpace: "pre-wrap" }}>{r.answer}</p></details></li>)}</ul>
              </>
            )}
            {st.evals?.length > 0 && <p className="note">Historial: {st.evals.map((e) => `${e.batch.slice(0, 16).replace("T", " ")} → ${e.aprobados}/${e.total}`).join(" · ")}</p>}
          </section>
          {msg && <p className="aerr">{msg}</p>}
        </>
      )}
    </main>
  );
}
