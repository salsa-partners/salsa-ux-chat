#!/usr/bin/env node
// Gasto del mes en un solo lugar: modelo (tokens), búsquedas web, navegador, contra los topes configurados.
//   npm run usage
//   node scripts/usage.mjs --env .env.production.local
import Browserbase from "@browserbasehq/sdk";
import { loadEnv } from "./env.mjs";
import { neonDb } from "../db/runner.mjs";
import { budgets } from "../db/pricing.mjs";

loadEnv();
const b = budgets();
const money = (n) => `US$${Number(n || 0).toFixed(2)}`;

console.log("Topes:", `mes ${money(b.monthlyUsd)} · persona/día ${money(b.dailyUsdPerUser)} · respuesta ${money(b.runUsd)} · navegador ${b.browserMinutesMonthly} min/mes`);

if (process.env.DATABASE_URL) {
  const db = neonDb(process.env.DATABASE_URL);
  const rows = await db.all(`SELECT kind AS tipo, model AS modelo, ejecuciones, input_tokens, output_tokens, cache_read_tokens AS cache,
      busquedas_web, minutos_navegador, costo_usd FROM usage_monthly WHERE mes = date_trunc('month', now())::date ORDER BY costo_usd DESC`);
  const total = rows.reduce((s, r) => s + Number(r.costo_usd || 0), 0);
  const mins = rows.reduce((s, r) => s + Number(r.minutos_navegador || 0), 0);
  console.log(`\nEste mes (registrado por la app): ${money(total)} de ${money(b.monthlyUsd)} (${Math.round((total / b.monthlyUsd) * 100)}%) · navegador ${mins.toFixed(1)} de ${b.browserMinutesMonthly} min`);
  if (rows.length) console.table(rows);
  const people = await db.all(`SELECT u.email, round(sum(r.cost_usd), 4)::float AS costo_usd, count(*)::int AS ejecuciones FROM runs r JOIN users u ON u.id = r.user_id
      WHERE r.created_at >= date_trunc('month', now()) GROUP BY 1 ORDER BY 2 DESC LIMIT 10`);
  if (people.length) { console.log("Por persona:"); console.table(people); }
} else {
  console.log("\nSin DATABASE_URL: no hay registro de gasto. Corre `npm run env:pull`.");
}

if (process.env.BROWSERBASE_API_KEY) {
  try {
    const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });
    for (const p of await bb.projects.list()) {
      const u = await bb.projects.usage(p.id);
      console.log(`\nBrowserbase (dato oficial del proveedor): ${u.browserMinutes} min de navegador, ${u.proxyBytes} bytes de proxy · máx. ${p.concurrency} navegadores a la vez`);
    }
  } catch (e) { console.log("\nBrowserbase: no pude leer el uso:", e.message); }
}

console.log("\nTopes duros del proveedor (recomendado): fija un límite de gasto mensual en console.anthropic.com → Settings → Limits.");
