import { sql, dbConfigured } from "@/lib/db";
import { budgets, costUsd } from "@/db/pricing.mjs";

export { budgets, costUsd };

// Control de gasto centralizado. Todo lo que consume dinero pasa por aquí antes y después:
//   antes  → checkBudget / checkBrowserBudget (¿se puede gastar?)
//   después → el costo queda en runs.cost_usd / browser_seconds (store.finishRun)
// Sin base de datos se lleva la cuenta en memoria (solo por instancia; es un respaldo, no un control fiable).
const mem = { month: "", usd: 0, browserSec: 0, day: "", users: new Map() };
const monthKey = () => new Date().toISOString().slice(0, 7);
const dayKey = () => new Date().toISOString().slice(0, 10);
function rollMem() {
  if (mem.month !== monthKey()) Object.assign(mem, { month: monthKey(), usd: 0, browserSec: 0 });
  if (mem.day !== dayKey()) { mem.day = dayKey(); mem.users.clear(); }
}

export function recordInMemory(userKey, usd, browserSec) {
  rollMem();
  mem.usd += usd; mem.browserSec += browserSec;
  mem.users.set(userKey, (mem.users.get(userKey) || 0) + usd);
}

// Gasto actual: mes completo, hoy por persona y minutos de navegador del mes.
export async function spendStatus(userId) {
  if (!dbConfigured()) {
    rollMem();
    return { monthUsd: mem.usd, todayUserUsd: mem.users.get(userId || "anon") || 0, browserMinutes: mem.browserSec / 60 };
  }
  const [r] = await sql()`SELECT
      coalesce(sum(cost_usd), 0)::float AS month_usd,
      coalesce(sum(cost_usd) FILTER (WHERE user_id = ${userId || null} AND created_at >= date_trunc('day', now())), 0)::float AS today_user_usd,
      coalesce(sum(browser_seconds), 0)::float / 60 AS browser_minutes
    FROM runs WHERE created_at >= date_trunc('month', now())`;
  return { monthUsd: r.month_usd, todayUserUsd: r.today_user_usd, browserMinutes: r.browser_minutes };
}

// ¿Puede empezar una respuesta? Devuelve null si sí, o { status, message } si se alcanzó un tope.
export async function checkBudget(userId) {
  const b = budgets();
  const s = await spendStatus(userId).catch(() => null);
  if (!s) return null; // si la base falla, no se bloquea el chat (queda registrado el error en logs)
  if (s.monthUsd >= b.monthlyUsd) return { status: 402, message: `Se alcanzó el presupuesto del mes (US$${b.monthlyUsd}). Pide a la persona administradora que lo revise en /admin.` };
  if (s.todayUserUsd >= b.dailyUsdPerUser) return { status: 429, message: `Llegaste a tu tope diario (US$${b.dailyUsdPerUser}). Vuelve mañana o pide que lo suban.` };
  return null;
}

// ¿Se puede abrir el navegador? Lanza un error con el motivo si no.
export async function checkBrowserBudget() {
  const b = budgets();
  const s = await spendStatus(null).catch(() => null);
  if (s && s.browserMinutes >= b.browserMinutesMonthly) {
    throw new Error(`Se usaron los ${b.browserMinutesMonthly} minutos de navegador del mes. Responde con lo guardado o pide subir BROWSER_MINUTES_MONTHLY.`);
  }
}
