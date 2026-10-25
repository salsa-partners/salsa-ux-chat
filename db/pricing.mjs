// Precios y topes de gasto: UN solo lugar para todo lo que consume dinero (modelo, búsquedas web, navegador).
// Lo usan el chat, las evals, /admin y `npm run usage`. Precios en US$ por millón de tokens (lista pública de
// Anthropic, oct-2026). Si cambian, se actualizan aquí.
export const MODEL_PRICES = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
};
// Modelo desconocido: se cobra como el más caro, para no subestimar.
const FALLBACK_PRICE = MODEL_PRICES["claude-opus-5-5"];
export const WEB_SEARCH_USD = 0.01; // US$10 por 1.000 búsquedas

// Topes (se pueden cambiar con variables de entorno sin tocar código).
export function budgets(env = process.env) {
  return {
    monthlyUsd: Number(env.BUDGET_MONTHLY_USD || 20), // gasto total del mes en modelo + búsquedas
    dailyUsdPerUser: Number(env.BUDGET_DAILY_USD_PER_USER || 3), // por persona por día
    runUsd: Number(env.BUDGET_RUN_USD || 1.5), // una sola respuesta del agente
    browserMinutesMonthly: Number(env.BROWSER_MINUTES_MONTHLY || 60), // minutos de navegador (Browserbase Free es limitado)
  };
}

// usage = { input, output, cacheRead, cacheWrite, webSearches }
export function costUsd(model, usage) {
  const p = MODEL_PRICES[model] || FALLBACK_PRICE;
  const m = 1e6;
  return (
    ((usage.input || 0) * p.input + (usage.output || 0) * p.output + (usage.cacheRead || 0) * p.cacheRead + (usage.cacheWrite || 0) * p.cacheWrite) / m +
    (usage.webSearches || 0) * WEB_SEARCH_USD
  );
}
