import ExcelJS from "exceljs";

const FONT = "Arial";
const C = { head: "FF000000", headTxt: "FFFFFFFF", green: "FFC6EFCE", yellow: "FFFFEB9C", red: "FFFFC7CE", purple: "FF7E74FD", line: "FFD9D9D9" };
const RESERVED = ["resumen", "comparativo", "journey óptimo", "ux writing", "comparativo writing"];
const SCORES = ["claridad", "esfuerzo", "feedback", "confianza", "diseno", "writing"];

const clamp = (n) => { if (n == null || n === "") return null; n = Number(n); return Number.isFinite(n) ? Math.min(5, Math.max(1, n)) : null; };
const str = (v, max = 1500) => (v == null ? "" : String(v).slice(0, max));
const avg = (a) => { const v = a.filter((x) => x != null); return v.length ? Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 10) / 10 : null; };
const slugify = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
// Columna de Excel por número (1 = A, 27 = AA).
const colL = (n) => { let s = ""; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

function headRow(ws, cols, rowNum = 1) {
  const r = ws.getRow(rowNum);
  cols.forEach((c, i) => {
    const cell = r.getCell(i + 1);
    cell.value = c;
    cell.font = { name: FONT, bold: true, color: { argb: C.headTxt }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.head } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  r.height = 28;
}
function body(cell, opts = {}) {
  cell.font = { name: FONT, size: 10, ...(opts.font || {}) };
  cell.alignment = { vertical: "top", wrapText: true, ...(opts.align || {}) };
  cell.border = { bottom: { style: "thin", color: { argb: C.line } } };
}
function scoreFormat(ws, ref) {
  ws.addConditionalFormatting({ ref, rules: [
    { type: "cellIs", operator: "greaterThanOrEqual", formulae: [4], style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: C.green } } } },
    { type: "cellIs", operator: "lessThan", formulae: [3], style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: C.red } } } },
    { type: "cellIs", operator: "between", formulae: [3, 3.99], style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: C.yellow } } } },
  ] });
}

/**
 * data: { titulo, resumen:[str], pasos:[...], journey_optimo:[...], ux_writing?:[...], comparativo_writing?:[...], pendientes?:[str] }
 * shots: Map(id -> { buf, plataforma, journey, paso })
 * names: { slug -> nombre visible } de las plataformas registradas
 */
export async function buildWorkbook(data, shots, names = {}) {
  const display = (v) => names[slugify(v)] || str(v, 40).trim();
  const wb = new ExcelJS.Workbook();
  wb.creator = "Agente Benchmark UX · Salsa";
  wb.calcProperties.fullCalcOnLoad = true;

  const pasos = (Array.isArray(data.pasos) ? data.pasos : []).map((p) => ({
    plataforma: display(p.plataforma) || null,
    journey: str(p.journey, 80), paso: str(p.paso, 120), captura_id: str(p.captura_id, 20),
    usuario_hace: str(p.usuario_hace), ve: str(p.ve), texto_clave: str(p.texto_clave), clics: p.clics ?? "",
    friccion: str(p.friccion), hallazgo_writing: str(p.hallazgo_writing), emocion: str(p.emocion, 20), recomendacion: str(p.recomendacion),
    s: Object.fromEntries(SCORES.map((k) => [k, clamp(p[k])])),
  })).filter((p) => p.plataforma);

  // Plataformas en el orden en que aparecen (máximo 12 hojas) y nombres de hoja válidos para Excel.
  const PLAT = [...new Set(pasos.map((p) => p.plataforma))].slice(0, 12);
  const sheet = {};
  for (const pl of PLAT) {
    let n = pl.replace(/[\[\]:*?\/\\]/g, " ").trim().slice(0, 28) || "Plataforma";
    const taken = (x) => RESERVED.includes(x.toLowerCase()) || Object.values(sheet).some((v) => v.toLowerCase() === x.toLowerCase());
    for (let k = 2, base = n; taken(n); k++) n = base.slice(0, 25) + " " + k;
    sheet[pl] = n;
  }
  const ref = (pl) => `'${sheet[pl].replace(/'/g, "''")}'`;

  // ---------- Resumen ----------
  const wsR = wb.addWorksheet("Resumen", { views: [{ showGridLines: false }] });
  wsR.columns = [{ width: 4 }, { width: 120 }];
  wsR.getCell("B1").value = str(data.titulo, 120) || `Benchmark UX · ${PLAT.join(", ")}`;
  wsR.getCell("B1").font = { name: FONT, bold: true, size: 16 };
  let r = 3;
  const section = (title, items, fill) => {
    wsR.getCell(`B${r}`).value = title; wsR.getCell(`B${r}`).font = { name: FONT, bold: true, size: 11 }; r++;
    for (const t of items) {
      const c = wsR.getCell(`B${r}`); c.value = "• " + str(t, 600); c.font = { name: FONT, size: 10 };
      c.alignment = { wrapText: true, vertical: "top" };
      if (fill) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
      r++;
    }
    r++;
  };
  section("Hallazgos clave", (data.resumen || []).slice(0, 10));
  section("Pendiente / no se pudo ver", (data.pendientes || []).slice(0, 10), C.yellow);

  // Se crean en orden para que las pestañas queden: Resumen, Comparativo, Journey óptimo, plataformas.
  const wsC = wb.addWorksheet("Comparativo", { views: [{ state: "frozen", ySplit: 1 }] });
  const wsJ = wb.addWorksheet("Journey óptimo", { views: [{ state: "frozen", ySplit: 1 }] });

  // ---------- Hojas por plataforma ----------
  const COLS = ["Journey", "Paso", "Captura", "Qué hace el usuario", "Qué ve", "Texto clave (exacto)", "Clics", "Claridad", "Esfuerzo", "Feedback", "Confianza", "Diseño", "Writing", "Puntaje promedio", "Fricciones", "Hallazgo de writing", "Emoción", "Recomendación"];
  const WIDTH = [16, 24, 44, 30, 30, 40, 7, 9, 9, 9, 9, 9, 9, 11, 34, 34, 10, 38];
  const platAvg = {}; // plat -> journey -> [avgs]
  const wsByPlat = {};
  for (const plat of PLAT) {
    const ws = wb.addWorksheet(sheet[plat], { views: [{ state: "frozen", ySplit: 1 }] });
    wsByPlat[plat] = ws;
    ws.columns = WIDTH.map((w) => ({ width: w }));
    headRow(ws, COLS);
    const rows = pasos.filter((p) => p.plataforma === plat);
    platAvg[plat] = {};
    rows.forEach((p, i) => {
      const rn = i + 2, row = ws.getRow(rn);
      const vals = SCORES.map((k) => p.s[k]);
      const a = avg(vals);
      (platAvg[plat][p.journey] ||= []).push(a);
      row.values = [p.journey, p.paso, "", p.usuario_hace, p.ve, p.texto_clave, p.clics, ...vals, { formula: `IFERROR(ROUND(AVERAGE(H${rn}:M${rn}),1),"")`, result: a ?? "" }, p.friccion, p.hallazgo_writing, p.emocion, p.recomendacion];
      row.eachCell({ includeEmpty: true }, (c) => body(c));
      for (let c = 7; c <= 14; c++) row.getCell(c).alignment = { horizontal: "center", vertical: "top" };
      row.height = 150;
      const shot = shots.get(p.captura_id);
      if (shot?.buf) {
        const id = wb.addImage({ buffer: shot.buf, extension: "jpeg" });
        ws.addImage(id, { tl: { col: 2.05, row: rn - 1 + 0.04 }, ext: { width: 300, height: 188 } });
      } else {
        row.getCell(3).value = p.captura_id ? "(captura no disponible)" : "(sin captura)";
      }
      if (/grave/i.test(p.friccion)) row.getCell(15).fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.red } };
    });
    if (!rows.length) { ws.getCell("A2").value = "No se revisó esta plataforma en esta consulta."; ws.getCell("A2").font = { name: FONT, italic: true, size: 10 }; }
    scoreFormat(ws, `H2:N${Math.max(2, rows.length + 1)}`);
  }

  // ---------- Comparativo (con fórmulas) ----------
  const journeys = [...new Set(pasos.map((p) => p.journey))];
  // Una columna por plataforma (B, C, D...) y al final "Gana".
  const L = colL(PLAT.length + 1); // última columna de plataformas
  wsC.columns = [{ width: 28 }, ...PLAT.map(() => ({ width: 12 })), { width: 16 }];
  headRow(wsC, ["Journey", ...PLAT, "Gana"]);
  journeys.forEach((j, i) => {
    const rn = i + 2, row = wsC.getRow(rn);
    const res = PLAT.map((pl) => avg(platAvg[pl][j] || []));
    const best = Math.max(...res.filter((x) => x != null), -1);
    const winner = best < 0 ? "" : PLAT.filter((_, k) => res[k] === best).join(" / ");
    const span = `B${rn}:${L}${rn}`;
    row.values = [j, ...PLAT.map((pl, k) => ({ formula: `IFERROR(ROUND(AVERAGEIFS(${ref(pl)}!$N:$N,${ref(pl)}!$A:$A,$A${rn}),1),"")`, result: res[k] ?? "" })),
      { formula: `IF(COUNT(${span})=0,"",IF(COUNTIF(${span},MAX(${span}))>1,"Empate",INDEX($B$1:$${L}$1,MATCH(MAX(${span}),${span},0))))`, result: winner.includes("/") ? "Empate" : winner }];
    row.eachCell((c) => body(c));
    for (let c = 2; c <= PLAT.length + 2; c++) row.getCell(c).alignment = { horizontal: "center", vertical: "middle" };
  });
  const lastC = journeys.length + 1;
  if (journeys.length) {
    const tr = lastC + 1, row = wsC.getRow(tr);
    const tot = PLAT.map((pl) => avg(pasos.filter((p) => p.plataforma === pl).map((p) => avg(SCORES.map((k) => p.s[k])))));
    row.values = ["PROMEDIO GENERAL", ...PLAT.map((pl, k) => { const c = colL(k + 2); return { formula: `IFERROR(ROUND(AVERAGE(${c}2:${c}${lastC}),1),"")`, result: tot[k] ?? "" }; })];
    row.eachCell((c) => body(c, { font: { bold: true } }));
    for (let c = 2; c <= PLAT.length + 1; c++) row.getCell(c).alignment = { horizontal: "center" };
    scoreFormat(wsC, `B2:${L}${tr}`);
  }

  // ---------- Journey óptimo ----------
  wsJ.columns = [{ width: 6 }, { width: 34 }, { width: 14 }, { width: 70 }];
  headRow(wsJ, ["#", "Paso ideal", "Sale de", "Por qué"]);
  (data.journey_optimo || []).slice(0, 25).forEach((p, i) => {
    const row = wsJ.getRow(i + 2);
    row.values = [i + 1, str(p.paso, 200), str(p.plataforma, 30), str(p.por_que, 500)];
    row.eachCell((c) => body(c, { font: { bold: true } }));
    row.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.green } }; });
  });

  // ---------- Solo si piden análisis de texto ----------
  if (Array.isArray(data.ux_writing) && data.ux_writing.length) {
    const ws = wb.addWorksheet("UX Writing", { views: [{ state: "frozen", ySplit: 1 }] });
    const cols = ["Plataforma", "Pantalla", "Captura", "Elemento", "Texto exacto", "Estructura", "Trato", "Voz de marca", "Género", "Idioma", "Por qué lo pide", "¿Lo explica?", "Palabras", "Hallazgo", "Reescritura sugerida"];
    ws.columns = [12, 20, 40, 14, 44, 18, 18, 22, 22, 14, 28, 12, 9, 34, 40].map((w) => ({ width: w }));
    headRow(ws, cols);
    data.ux_writing.slice(0, 120).forEach((t, i) => {
      const rn = i + 2, row = ws.getRow(rn);
      const texto = str(t.texto_exacto);
      row.values = [str(t.plataforma, 20), str(t.pantalla, 80), "", str(t.elemento, 30), texto, str(t.estructura, 120), str(t.trato, 120), str(t.voz_marca, 160), str(t.genero, 160), str(t.idioma, 80), str(t.por_que_lo_pide, 300), str(t.lo_explica, 30), { formula: `IF(E${rn}="","",LEN(TRIM(E${rn}))-LEN(SUBSTITUTE(TRIM(E${rn})," ",""))+1)`, result: texto ? texto.trim().split(/\s+/).length : "" }, str(t.hallazgo, 400), str(t.reescritura, 400)];
      row.eachCell({ includeEmpty: true }, (c) => body(c));
      const shot = shots.get(str(t.captura_id, 20));
      if (shot?.buf) {
        const id = wb.addImage({ buffer: shot.buf, extension: "jpeg" });
        ws.addImage(id, { tl: { col: 2.05, row: rn - 1 + 0.04 }, ext: { width: 240, height: 150 } });
        row.height = 125;
      } else { row.getCell(3).value = "(sin captura)"; row.height = 70; }
    });
  }
  if (Array.isArray(data.comparativo_writing) && data.comparativo_writing.length) {
    const ws = wb.addWorksheet("Comparativo Writing", { views: [{ state: "frozen", ySplit: 1 }] });
    // valores: [{ plataforma, texto }]. Columnas = plataformas que aparezcan en los criterios.
    const items = data.comparativo_writing.slice(0, 20);
    const cols = [...new Set(items.flatMap((c) => (Array.isArray(c.valores) ? c.valores : []).map((v) => display(v.plataforma))))].filter(Boolean).slice(0, 12);
    ws.columns = [26, ...cols.map(() => 38), 16, 44].map((w) => ({ width: w }));
    headRow(ws, ["Criterio", ...cols, "Mejor", "Por qué"]);
    items.forEach((c, i) => {
      const row = ws.getRow(i + 2);
      const val = (pl) => str((c.valores || []).find((v) => display(v.plataforma) === pl)?.texto, 400);
      row.values = [str(c.criterio, 80), ...cols.map(val), str(c.mejor, 30), str(c.por_que, 400)];
      row.eachCell((cell) => body(cell));
      row.height = 70;
      if (c.mejor) row.getCell(cols.length + 2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.green } };
    });
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
