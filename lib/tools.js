import { allowedUrl, platformFor } from "@/lib/platforms";
import { pageLooksLikeLogin } from "@/lib/browser";
import { buildWorkbook } from "@/lib/excel";
import { MEMORY_TOOL, runMemory } from "@/lib/memory";
import { saveBlob, dbConfigured } from "@/lib/db";
import { addPlatform, queryFindings, scoreboard, saveCapture, saveFindings, saveDeliverable } from "@/lib/store";

export const MAX_SHOTS = 18;

// Acciones que el agente NUNCA puede hacer con un clic (pagos, envíos, cuentas, borrado).
const CLICK_BLOCK = /(pagar|pago ahora|comprar|confirmar (pedido|compra|pago)|realizar pedido|finalizar (compra|pedido)|enviar|submit|guardar|cerrar sesi|salir|logout|log out|sign out|eliminar|borrar|delete|cancelar (cita|plan|suscrip)|suscrib|contratar|reservar|agendar ahora|aceptar y continuar|pay\b|buy\b|checkout now|place order)/i;

const SCORE = { type: "number", description: "1 a 5" };

// ---------- Definiciones de herramientas ----------
const BROWSER_TOOLS = [
  {
    name: "navegar",
    description: "Abre una URL de una plataforma registrada (solo sus dominios). Devuelve la URL final, el título y si la página pide iniciar sesión (sesión vencida).",
    input_schema: { type: "object", properties: { url: { type: "string", description: "URL completa (https://...)" }, plataforma: { type: "string", description: "Alternativa a url: id de la plataforma registrada (p. ej. axo)" }, destino: { type: "string", enum: ["app", "web"], description: "Con plataforma: app (por defecto) o sitio web" } } },
  },
  {
    name: "leer",
    description: "Devuelve el texto visible EXACTO de la pantalla actual y la lista de botones/enlaces visibles (para saber qué se puede abrir con clic).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "capturar",
    description: "Toma una captura de la pantalla actual y la guarda para el Excel. Devuelve la imagen, el id de captura (c1, c2...) y el texto visible. Escribe en 'observacion' lo importante que ves (textos exactos clave), porque la imagen se descarta del contexto más adelante.",
    input_schema: { type: "object", properties: { plataforma: { type: "string", description: "id de la plataforma registrada" }, journey: { type: "string", description: "Ej: Inicio, Registro, Cuestionario, Resultados, Recomendaciones, Pagos, Cita" }, paso: { type: "string", description: "Nombre corto del paso" }, observacion: { type: "string" } }, required: ["plataforma", "journey", "paso", "observacion"] },
  },
  {
    name: "clic",
    description: "Hace clic en un botón, enlace o pestaña por su texto visible (para ABRIR pantallas). No puedes escribir, enviar formularios, pagar ni cerrar sesión; esos clics se bloquean.",
    input_schema: { type: "object", properties: { texto: { type: "string" } }, required: ["texto"] },
  },
  {
    name: "scroll",
    description: "Desplaza la página hacia abajo o arriba (aprox. una pantalla).",
    input_schema: { type: "object", properties: { direccion: { type: "string", enum: ["abajo", "arriba"] } }, required: ["direccion"] },
  },
  {
    name: "generar_excel",
    description: "Genera el Excel final con capturas incrustadas y lo entrega a la persona. Llámalo UNA sola vez al terminar. Los pasos que envíes quedan guardados como hallazgos del proyecto. Con incluir_guardados=true suma los hallazgos de revisiones anteriores del proyecto (para el consolidado).",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: {
        titulo: { type: "string" },
        resumen: { type: "array", items: { type: "string" }, description: "5 a 8 hallazgos clave, frases cortas" },
        pendientes: { type: "array", items: { type: "string" }, description: "Qué no se pudo ver y por qué" },
        incluir_guardados: { type: "boolean", description: "Suma hallazgos guardados del proyecto de revisiones anteriores" },
        pasos: {
          type: "array",
          items: {
            type: "object",
            properties: {
              plataforma: { type: "string", description: "Nombre de la plataforma (p. ej. Axo)" }, journey: { type: "string" }, paso: { type: "string" }, captura_id: { type: "string" },
              usuario_hace: { type: "string" }, ve: { type: "string" }, texto_clave: { type: "string", description: "Texto exacto entre comillas" }, clics: { type: "number" },
              claridad: SCORE, esfuerzo: SCORE, feedback: SCORE, confianza: SCORE, diseno: SCORE, writing: SCORE,
              friccion: { type: "string", description: "Empieza con GRAVE si bloquea o confunde" }, hallazgo_writing: { type: "string" }, emocion: { type: "string", description: "😊 😐 o 😟" }, recomendacion: { type: "string" },
            },
            required: ["plataforma", "journey", "paso", "claridad", "esfuerzo", "feedback", "confianza", "diseno", "writing"],
          },
        },
        journey_optimo: { type: "array", items: { type: "object", properties: { paso: { type: "string" }, plataforma: { type: "string" }, por_que: { type: "string" } }, required: ["paso", "plataforma", "por_que"] } },
        ux_writing: { type: "array", description: "SOLO si piden comparar cuestionarios, onboardings o textos", items: { type: "object", properties: { plataforma: { type: "string" }, pantalla: { type: "string" }, captura_id: { type: "string" }, elemento: { type: "string" }, texto_exacto: { type: "string" }, estructura: { type: "string" }, trato: { type: "string" }, voz_marca: { type: "string" }, genero: { type: "string" }, idioma: { type: "string" }, por_que_lo_pide: { type: "string" }, lo_explica: { type: "string" }, hallazgo: { type: "string" }, reescritura: { type: "string" } } } },
        comparativo_writing: { type: "array", description: "SOLO si piden análisis de texto", items: { type: "object", properties: { criterio: { type: "string" }, valores: { type: "array", items: { type: "object", properties: { plataforma: { type: "string" }, texto: { type: "string" } } } }, mejor: { type: "string" }, por_que: { type: "string" } } } },
      },
      required: ["titulo", "resumen", "pasos", "journey_optimo"],
    },
  },
];

const KNOWLEDGE_TOOLS = [
  {
    name: "consultar_benchmark",
    description: "Consulta los hallazgos guardados del proyecto actual (revisiones en vivo anteriores): pasos evaluados, textos exactos, fricciones, puntajes y fecha. Con resumen=true devuelve el puntaje promedio por plataforma y journey. Úsala antes de navegar para no repetir trabajo.",
    input_schema: { type: "object", properties: { plataforma: { type: "string", description: "id de la plataforma (opcional)" }, journey: { type: "string", description: "Journey (opcional)" }, texto: { type: "string", description: "Buscar una palabra en textos y fricciones (opcional)" }, resumen: { type: "boolean" } } },
  },
  {
    name: "agregar_plataforma",
    description: "Registra una plataforma PÚBLICA (sin inicio de sesión) para poder revisarla en vivo y la suma al proyecto actual. Úsala cuando la persona pida revisar un sitio o app web que no está en PLATAFORMAS REGISTRADAS.",
    input_schema: { type: "object", properties: { nombre: { type: "string" }, url: { type: "string", description: "URL pública https://" } }, required: ["nombre", "url"] },
  },
];

// Herramientas de Anthropic que corren en sus servidores (investigación pública).
const WEB_TOOLS = [
  { type: "web_search_20260209", name: "web_search", max_uses: 5 },
  { type: "web_fetch_20260209", name: "web_fetch", max_uses: 5 },
];

export function toolDefs({ browser, web }) {
  return [
    ...(dbConfigured() ? KNOWLEDGE_TOOLS : []),
    MEMORY_TOOL,
    ...(web ? WEB_TOOLS : []),
    ...(browser ? BROWSER_TOOLS : []),
  ];
}

const txt = (text) => [{ type: "text", text }];

// Ejecuta las herramientas de una respuesta. El navegador se abre solo cuando hace falta (openPage).
export class Toolbox {
  constructor({ emit, openPage, platforms, project, runId, user }) {
    Object.assign(this, { emit, openPage, platforms, project, runId, user });
    this.page = null;
    this.shots = new Map(); // c1 -> { buf, plataforma, journey, paso, observacion }
    this.captureIds = new Map(); // c1 -> uuid en la base
    this.file = null; this.n = 0; this.calls = {};
  }

  get usedBrowser() { return Boolean(this.page); }

  async browser() {
    if (!this.page) this.page = await this.openPage();
    return this.page;
  }

  async exec(name, input) {
    this.calls[name] = (this.calls[name] || 0) + 1;
    try {
      switch (name) {
        case "navegar": return await this.navegar(input);
        case "leer": return await this.leer();
        case "capturar": return await this.capturar(input);
        case "clic": return await this.clic(input);
        case "scroll": return await this.scroll(input);
        case "generar_excel": return await this.excel(input);
        case "consultar_benchmark": return await this.consultar(input);
        case "agregar_plataforma": return await this.agregar(input);
        case "memory": return txt(await runMemory(input, this.user?.email));
        default: return { error: `Herramienta desconocida: ${name}` };
      }
    } catch (e) {
      return { error: `Error: ${String(e.message || e).slice(0, 300)}` };
    }
  }

  // ---------- Conocimiento ----------
  async consultar({ plataforma, journey, texto, resumen }) {
    if (resumen) {
      const rows = await scoreboard(this.project.id);
      return txt(rows.length ? JSON.stringify(rows) : "Aún no hay hallazgos guardados en este proyecto.");
    }
    const rows = await queryFindings({ projectId: this.project.id, platform: plataforma, journey, text: texto });
    if (!rows.length) return txt("No hay hallazgos guardados que coincidan.");
    return txt(`${rows.length} hallazgos (más recientes primero):\n` + JSON.stringify(rows));
  }

  async agregar({ nombre, url }) {
    if (!dbConfigured()) return txt("No hay base de datos configurada: no puedo registrar plataformas nuevas.");
    const p = await addPlatform({ name: nombre, url, requiresLogin: false, createdBy: this.user?.email, projectId: this.project.id });
    this.platforms = [...this.platforms.filter((x) => x.slug !== p.slug), p];
    this.emit({ t: "status", d: `Plataforma registrada: ${p.name}` });
    return txt(`Registrada: ${p.name} (id ${p.slug}, dominio ${p.domains.join(", ")}). Ya puedes navegar a ${p.web_url}.`);
  }

  // ---------- Navegador ----------
  async visibleText(max = 5000) {
    const t = await this.page.evaluate(() => document.body?.innerText || "").catch(() => "");
    return t.replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
  }

  async clickables() {
    return this.page.evaluate(() => {
      const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 4 && r.height > 4 && s.visibility !== "hidden" && s.display !== "none" && r.bottom > 0 && r.top < innerHeight; };
      const seen = new Set(), out = [];
      for (const e of document.querySelectorAll('a,button,[role="button"],[role="tab"],summary')) {
        if (!vis(e)) continue;
        const t = (e.innerText || e.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 60);
        if (t && !seen.has(t)) { seen.add(t); out.push(t); }
        if (out.length >= 40) break;
      }
      return out;
    }).catch(() => []);
  }

  async navegar({ url, plataforma, destino }) {
    const p = plataforma && this.platforms.find((x) => x.slug === String(plataforma).toLowerCase());
    const target = url || (p && (destino === "web" ? p.web_url : p.app_url || p.web_url));
    if (!target || !allowedUrl(target, this.platforms)) return txt("URL no permitida: solo dominios de PLATAFORMAS REGISTRADAS. Si es pública, regístrala con agregar_plataforma.");
    const page = await this.browser();
    this.emit({ t: "status", d: `Abriendo ${new URL(target).hostname}…` });
    await page.goto(target, { waitUntil: "domcontentloaded", timeout: 25000 });
    await page.waitForTimeout(2500);
    if (!allowedUrl(page.url(), this.platforms)) {
      await page.goBack().catch(() => {});
      return txt("La página redirigió fuera de los dominios permitidos; no la abrí.");
    }
    const needsLogin = platformFor(page.url(), this.platforms)?.requires_login;
    const login = needsLogin && (await pageLooksLikeLogin(page));
    const title = await page.title().catch(() => "");
    return txt(`URL: ${page.url()}\nTítulo: ${title}\n${login ? "⚠ SESIÓN VENCIDA: la página pide iniciar sesión. No puedes continuar en esta plataforma; avisa que la persona administradora debe renovar la sesión en /admin." : "Lista."}`);
  }

  async leer() {
    if (!this.page) return txt("Aún no hay ninguna página abierta. Usa navegar primero.");
    const [text, links] = await Promise.all([this.visibleText(), this.clickables()]);
    return txt(`TEXTO VISIBLE:\n${text || "(vacío)"}\n\nBOTONES/ENLACES VISIBLES:\n${links.map((l) => `- ${l}`).join("\n") || "(ninguno)"}`);
  }

  async capturar({ plataforma, journey, paso, observacion }) {
    if (!this.page) return txt("Aún no hay ninguna página abierta. Usa navegar primero.");
    if (this.shots.size >= MAX_SHOTS) return txt(`Límite de ${MAX_SHOTS} capturas alcanzado. Pasa a generar_excel.`);
    const name = this.platforms.find((x) => x.slug === plataforma)?.name || plataforma;
    this.emit({ t: "status", d: `Captura: ${name} · ${paso}` });
    const buf = await this.page.screenshot({ type: "jpeg", quality: 60 });
    const id = `c${++this.n}`;
    this.shots.set(id, { buf, plataforma: name, journey, paso, observacion });
    // Se guarda en Blob + base para que sirva en revisiones futuras (no bloquea si falla).
    const blobUrl = await saveBlob(`capturas/${this.project.slug}/${plataforma}/${id}.jpg`, buf, "image/jpeg");
    const dbId = await saveCapture({ runId: this.runId, projectId: this.project.id, platform: plataforma, journey, step: paso, url: this.page.url(), blobUrl, observation: observacion }).catch(() => null);
    if (dbId) this.captureIds.set(id, dbId);
    const text = await this.visibleText(2500);
    return [
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: buf.toString("base64") } },
      { type: "text", text: `Captura guardada: ${id} (${this.shots.size}/${MAX_SHOTS}).\nTEXTO VISIBLE:\n${text}` },
    ];
  }

  async clic({ texto }) {
    if (!this.page) return txt("Aún no hay ninguna página abierta. Usa navegar primero.");
    if (CLICK_BLOCK.test(texto)) return txt(`Clic bloqueado por seguridad ("${texto}"): puede pagar, enviar o cambiar datos. Describe la pantalla sin pulsarlo.`);
    this.emit({ t: "status", d: `Abriendo: ${texto}` });
    const loc = this.page.getByText(texto, { exact: false }).filter({ visible: true }).first();
    const el = await loc.elementHandle({ timeout: 4000 }).catch(() => null);
    if (!el) return txt(`No encontré "${texto}" visible. Usa leer para ver las opciones.`);
    const info = await el.evaluate((e) => ({ type: (e.closest("button,input,a") || e).getAttribute("type") || "", label: (e.innerText || "").slice(0, 80) }));
    if (info.type === "submit") return txt("Clic bloqueado: es un botón de envío de formulario.");
    if (CLICK_BLOCK.test(info.label)) return txt(`Clic bloqueado por seguridad ("${info.label}").`);
    await el.click({ timeout: 5000 });
    await this.page.waitForTimeout(2000);
    if (!allowedUrl(this.page.url(), this.platforms)) { await this.page.goBack().catch(() => {}); return txt("Esa acción salía de los dominios permitidos; volví atrás."); }
    return txt(`Clic hecho. URL actual: ${this.page.url()}`);
  }

  async scroll({ direccion }) {
    if (!this.page) return txt("Aún no hay ninguna página abierta. Usa navegar primero.");
    await this.page.mouse.wheel(0, direccion === "arriba" ? -700 : 700);
    await this.page.waitForTimeout(700);
    return txt("Listo.");
  }

  // ---------- Entregable ----------
  async excel(data) {
    if (!data || !Array.isArray(data.pasos) || !Array.isArray(data.resumen)) {
      return { error: "Entrada incompleta: faltan pasos o resumen. Vuelve a llamar generar_excel con todos los campos requeridos." };
    }
    this.emit({ t: "status", d: "Armando el Excel con las capturas…" });
    let pasos = data.pasos;
    const shots = new Map(this.shots);
    // Primero se leen los hallazgos anteriores y después se guardan los nuevos, para no duplicarlos.
    if (data.incluir_guardados && dbConfigured()) {
      const prev = await this.previousSteps(shots);
      pasos = [...prev, ...pasos];
    }
    const saved = await saveFindings({ projectId: this.project.id, runId: this.runId, pasos: data.pasos, captureIds: this.captureIds }).catch((e) => { console.error("findings", e?.message); return 0; });
    const names = Object.fromEntries(this.platforms.map((p) => [p.slug, p.name]));
    const buf = await buildWorkbook({ ...data, pasos }, shots, names);
    const stamp = new Date().toISOString().slice(0, 10);
    const name = `Benchmark_UX_${this.project.slug}_${stamp}.xlsx`;
    const mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    const url = await saveBlob(`entregables/${this.project.slug}/${name}`, buf, mime);
    if (url) await saveDeliverable({ runId: this.runId, projectId: this.project.id, name, blobUrl: url }).catch(() => {});
    this.file = { name, mime, b64: buf.toString("base64"), url };
    this.emit({ t: "file", ...this.file });
    return txt(`Excel entregado a la persona (ya aparece para descargar). ${saved} pasos quedaron guardados como hallazgos del proyecto. Ahora responde en el chat con un resumen corto: ganador por journey, 3 mejoras por plataforma (UX y writing) y qué faltó.`);
  }

  // Hallazgos de revisiones anteriores (sin los de esta respuesta) en el formato de pasos del Excel.
  async previousSteps(shots) {
    const rows = await queryFindings({ projectId: this.project.id, limit: 80 });
    const out = [];
    let g = 0;
    for (const r of rows) {
      let captura_id = "";
      if (r.captura) {
        try {
          const res = await fetch(r.captura);
          if (res.ok) { captura_id = `g${++g}`; shots.set(captura_id, { buf: Buffer.from(await res.arrayBuffer()) }); }
        } catch {}
      }
      out.push({ plataforma: r.plataforma, journey: r.journey, paso: `${r.paso || ""} (${r.fecha})`, captura_id, ve: r.ve, texto_clave: r.texto_clave, friccion: r.friccion, hallazgo_writing: r.hallazgo_writing, recomendacion: r.recomendacion, ...(r.scores || {}) });
    }
    return out;
  }
}
