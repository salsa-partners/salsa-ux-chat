# Agente Benchmark UX · Salsa

Chat estilo ChatGPT que responde solo sobre el benchmark UX y UX writing de **Axo, Lucis y Zentum**. Usa Claude (API de Anthropic) y se publica en Vercel.

## Variables de entorno (en Vercel → Settings → Environment Variables)

| Variable | ¿Obligatoria? | Para qué |
|---|---|---|
| `ANTHROPIC_API_KEY` | Sí | Clave de console.anthropic.com. Cada mensaje se cobra a esta cuenta. |
| `ACCESS_CODE` | Recomendada | Código que deben escribir las personas para usar el chat. Si la dejas vacía, cualquiera con el link puede usarlo. |
| `ANTHROPIC_MODEL` | No | Por defecto `claude-sonnet-5-5`. |

## Actualizar el conocimiento del agente

Todo lo que sabe está en `lib/knowledge.js`. Si haces un benchmark nuevo, reemplaza la sección "RESULTADOS DEL BENCHMARK" y vuelve a publicar.

## Correr en tu computador (opcional)

```
npm install
cp .env.example .env.local   # y completa ANTHROPIC_API_KEY
npm run dev
```
