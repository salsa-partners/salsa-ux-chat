# 10 · Bootstrap: inicializar la base en Vercel desde el repo

Objetivo de esta etapa: que con **un solo comando** quede creada y lista la base de datos que necesita el agente, sin entrar al dashboard de Vercel. El frente (chat, flujo de trabajo) se define después.

## Plan técnico

| Pieza | Decisión | Por qué |
|---|---|---|
| Base de datos | **Neon Postgres** vía Vercel Marketplace | Se crea y conecta desde el CLI (`vercel integration add neon`); serverless; rama gratuita; Vercel inyecta `DATABASE_URL` en los 3 entornos. |
| Archivos | **Vercel Blob** (`vercel blob create-store`) | Capturas y Excel. Vercel crea `BLOB_STORE_ID` y la app se autentica con OIDC (sin token fijo). |
| Esquema | **Migraciones versionadas en código** (`db/migrations.mjs`) | El esquema vive en el repo, se revisa en cada cambio y se aplica igual en local, preview y producción. Tabla `schema_migrations` registra qué se aplicó. |
| Motor | `db/runner.mjs` (sin ORM) | ~100 líneas, sin dependencias nuevas; lo usan los scripts y el botón de `/admin`. Cada migración corre en una transacción: o se aplica completa o nada. |
| Datos iniciales | `db/seed-data.mjs` + `seed()` | Proyecto Longevidad 2026, Axo/Lucis/Zentum y memoria base. Idempotente: no pisa ediciones. |
| Herramientas | **Vercel CLI como dependencia del repo** (`vercel@63.1.2`) | Misma versión para todo el equipo; no hace falta instalarlo global. |
| Secretos | `vercel env add` (sensibles en production/preview) + `vercel env pull` a `.env.local` | Nada sensible en el repo; `.env*.local` está en `.gitignore`. |
| Despliegue | `vercel-build` aplica migraciones antes de `next build` | Cada despliegue deja la base al día con el código. Si una migración falla, el despliegue falla y producción no cambia. |
| Verificación | `npm run doctor` | Revisa variables, conexión, migraciones, acceso al modelo y Blob, sin gastar tokens. |

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run bootstrap` | **Todo de una vez** (ver abajo). Se puede repetir: salta lo que ya existe. |
| `npm run env:pull` | Trae las variables de Vercel a `.env.local` |
| `npm run db:setup` | Migraciones pendientes + datos iniciales + estado |
| `npm run db:migrate` | Solo migraciones pendientes |
| `npm run db:seed` | Solo datos iniciales |
| `npm run db:status` | Versión de Postgres, migraciones aplicadas/pendientes, filas por tabla |
| `npm run doctor` | Diagnóstico completo |
| `npm run dev` | App en local con las variables de `.env.local` |
| `npm run deploy:preview` / `deploy:prod` | Despliega desde la carpeta (no necesita Git) |

Para apuntar a otro entorno: `npx vercel env pull .env.production.local --environment=production --yes` y luego `node scripts/db.mjs status --env .env.production.local`.

## Primera vez (paso a paso)

Requisitos: Node.js 22+ (https://nodejs.org) y una cuenta de Vercel con acceso al equipo de Salsa.

```bash
cd ~/Downloads/salsa-ux-chat
```

```bash
npm install
```

```bash
npm run bootstrap
```

El bootstrap hace, en orden:

1. **Login** en Vercel (abre el navegador la primera vez).
2. **Vincula** la carpeta con el proyecto de Vercel (`vercel link`): elige el proyecto existente del chat.
3. **Neon**: si no hay `DATABASE_URL`, crea la base `salsa-ux-db` y la conecta a production, preview y development. Te pedirá aceptar los términos de Neon y elegir plan (el gratuito alcanza para empezar).
4. **Blob**: si no hay store, crea `salsa-ux-files` y lo conecta.
5. **Secretos**: pide `ANTHROPIC_API_KEY`, `ACCESS_CODE` y `ADMIN_CODE` (no se ven al escribir) y genera `SESSION_SECRET`. Si ya existen en Vercel, no los toca.
6. **`.env.local`**: trae todas las variables.
7. **Migraciones + datos iniciales** en la base.
8. **Doctor**: muestra qué quedó listo y qué falta.

Al terminar, `npm run dev` y abre http://localhost:3000.

> Si prefieres hacer los pasos 3–5 en el dashboard de Vercel (Storage → Neon / Blob; Settings → Environment Variables), funciona igual: después corre `npm run env:pull` y `npm run db:setup`.

## Cambiar el esquema más adelante

1. Agrega una migración **al final** de `MIGRATIONS` en `db/migrations.mjs` (`id: "0002"`, nombre, sentencias). Nunca edites una ya aplicada.
2. `npm run db:migrate` (contra la base de desarrollo).
3. Despliega: `vercel-build` la aplica en el entorno del despliegue.

Mientras Neon esté conectado con la misma base en los tres entornos, local, preview y producción comparten datos. Cuando haya clientes reales, activar en Neon una rama por preview (Neon → Vercel integration → *Create a branch for each preview deployment*).

## Lo que no puedo hacer por ti

- `vercel login` y aceptar los términos de Neon: requieren tu cuenta y tu confirmación en el navegador.
- Esta Mac no tiene Git; para manejar el código con GitHub, instala GitHub Desktop. Mientras tanto, `npm run deploy:preview` despliega directo desde la carpeta.

## Verificación hecha (24-oct-2026)

- Migraciones y seed probados contra Postgres 18 (PGlite): se aplican, una segunda corrida no hace nada y el seed no duplica.
- Consultas críticas de la app (resumen de puntajes, búsqueda de hallazgos, límites de uso) ejecutadas sobre el esquema real.
- `npm run vercel-build` sin base: omite la migración y compila. `db:status` y `doctor` sin variables: fallan con mensajes claros.
- No probado: la creación real de Neon/Blob en tu cuenta de Vercel (requiere tu login).
