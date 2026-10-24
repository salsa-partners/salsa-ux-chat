# Agente UX · Salsa

Agente experto en UX con memoria: responde preguntas de UX, hace benchmarks de las plataformas que le pidas (en vivo, con capturas y Excel), investiga en la web y recuerda hallazgos, proyectos y preferencias del equipo.

**Documentación completa en [`docs/`](docs/README.md).**

## Arranque rápido

1. `npm install` y `npm run build` (requiere Node.js 20+; verificado con v24.22.1).
2. En Vercel: conectar **Neon** y **Blob** (Storage) y cargar las variables de `.env.example`.
3. Abrir `/admin` → *Preparar base de datos* → configurar sesiones del navegador → *Correr evals*.

Guía paso a paso: [docs/06-despliegue-vercel.md](docs/06-despliegue-vercel.md).

## Qué hay dentro

- `app/api/chat/route.js` — el harness: contexto, loop del agente, herramientas, guardado y métricas.
- `lib/knowledge.js` — identidad y método UX del agente + datos del benchmark Longevidad 2026.
- `lib/tools.js` — navegador (solo lectura), hallazgos guardados, registro de plataformas, memoria, web, Excel.
- `lib/memory.js`, `lib/store.js` — memoria y datos en Neon Postgres + Vercel Blob.
- `db/` — migraciones versionadas, motor y datos iniciales; `scripts/` — bootstrap, comandos de base y doctor.
- `lib/evals.js` — control de calidad con juez automático.

## Seguridad del agente (solo lectura)

No puede escribir en formularios, pagar, enviar ni cerrar sesión; solo navega dominios de plataformas registradas y activas; nunca conoce contraseñas (las sesiones se inician a mano en `/admin`). Usa cuentas de prueba: las capturas pueden mostrar datos de la cuenta.
