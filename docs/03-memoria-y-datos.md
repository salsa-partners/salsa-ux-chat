# 03 · Memoria y datos: qué guardamos y dónde

## Las 4 memorias del agente

| Memoria | Qué contiene | Dónde vive | Quién escribe | Cuánto dura |
|---|---|---|---|---|
| **1. Conversación** | Mensajes de cada chat (texto) | Postgres: `conversations`, `messages` | El harness, automático | Hasta que la persona borre el chat |
| **2. Trabajo en curso** | Capturas y observaciones de la revisión actual | Contexto del modelo (se limpia solo cuando crece) | El agente | Una respuesta |
| **3. Conocimiento del benchmark** | Hallazgos por plataforma, journey y paso: texto exacto, puntajes, fricciones, recomendaciones, captura, fecha | Postgres: `findings`, `captures` + Vercel Blob (imágenes) | El harness, al generar cada Excel | Permanente (se puede invalidar con `valid = false`) |
| **4. Memoria de largo plazo** | Aprendizajes y preferencias: cómo trabaja el equipo, contexto de cada cliente, rutas de navegación que funcionan, cambios detectados | Postgres: `memories` (archivos de texto bajo `/memories`) | El agente, con la herramienta `memory` | Permanente |

Además, el **contexto de cada proyecto** (resumen del cliente y resultados previos) vive en `projects.brief` y se le da al agente en cada respuesta de ese proyecto.

### Cómo está organizada la memoria de largo plazo

```
/memories/
  equipo/              cómo trabaja Salsa, formato de entregables, tono
  proyectos/<slug>/    contexto del cliente, decisiones, rutas de navegación, cambios observados
  personas/<correo>/   preferencias de cada persona (p. ej. "prefiere tablas")
```

Reglas que el agente sigue (en `lib/knowledge.js`): una idea por línea con fecha; nunca contraseñas, datos personales ni de salud; no duplicar hallazgos (esos ya se guardan solos). Límites técnicos (en `lib/memory.js`): 300 archivos, 20.000 caracteres por archivo, rutas solo dentro de `/memories`.

## Tablas (Neon Postgres)

Definidas como migraciones versionadas en `db/migrations.mjs`. Se crean con `npm run db:setup` (o `npm run bootstrap`, ver [10](10-bootstrap-base-de-datos.md)); el botón de `/admin` usa el mismo motor. La tabla `schema_migrations` registra qué migraciones se aplicaron.

| Tabla | Para qué | Campos clave |
|---|---|---|
| `users` | Personas del equipo | `email`, `name`, `role` |
| `projects` | Estudios de benchmark por cliente | `slug`, `name`, `client`, `sector`, `brief` |
| `platforms` | Registro de plataformas y lista blanca de dominios | `slug`, `name`, `domains`, `app_url`, `web_url`, `requires_login`, `active` |
| `project_platforms` | Qué plataformas son de qué proyecto | — |
| `conversations` / `messages` | Historial de chats | `user_id`, `project_id`, `title` / `role`, `text`, `meta` (pasos y archivos) |
| `runs` | Cada respuesta del agente: métricas y límites | `kind` (chat/live), `model`, tokens, `cache_read_tokens`, `tool_calls`, `duration_ms`, `status`, `error` |
| `captures` | Capturas de revisiones en vivo | `platform_slug`, `journey`, `step`, `url`, `blob_url`, `observation` |
| `findings` | Hallazgos estructurados | `platform_slug`, `journey`, `step`, `key_text`, `scores` (claridad, esfuerzo, feedback, confianza, diseño, writing), `friction`, `severity`, `writing_finding`, `recommendation`, `observed_at`, `valid` |
| `deliverables` | Excel generados | `name`, `blob_url` |
| `memories` | Memoria de largo plazo | `path`, `content`, `updated_by` |
| `eval_results` | Resultados de control de calidad | `batch`, `case_id`, `passed`, `score`, `answer`, `judge` |

## Archivos (Vercel Blob)

```
capturas/<proyecto>/<plataforma>/c1-<aleatorio>.jpg
entregables/<proyecto>/Benchmark_UX_<proyecto>_<fecha>-<aleatorio>.xlsx
```

Las URLs tienen un sufijo aleatorio y no se pueden adivinar, pero quien tenga el enlace puede abrirlas. No se publican en ningún lado; solo aparecen en la base y en el chat de quien hizo la revisión.

## Qué NO se guarda

- Contraseñas: nunca pasan por el agente (las sesiones se inician a mano en `/admin` y Browserbase guarda solo cookies).
- Imágenes que adjunta la persona en el chat: se usan en la respuesta y se descartan.
- El razonamiento interno del modelo.

## Sin base de datos

La app sigue funcionando (modo demo): chats en el navegador, conocimiento del proyecto Longevidad 2026 desde el código, memoria temporal que se pierde en cada despliegue y sin registro de plataformas nuevas.

## Consultas útiles (en la consola SQL de Neon)

```sql
-- Puntaje promedio por plataforma y journey de un proyecto
SELECT f.platform_slug, f.journey, count(*), max(f.observed_at)::date
FROM findings f JOIN projects p ON p.id = f.project_id
WHERE p.slug = 'longevidad-2026' AND f.valid GROUP BY 1, 2 ORDER BY 2, 1;

-- Fricciones graves de los últimos 30 días
SELECT platform_slug, journey, step, friction, observed_at::date
FROM findings WHERE severity = 'grave' AND observed_at > now() - interval '30 days';

-- Invalidar hallazgos viejos de una plataforma que cambió su diseño
UPDATE findings SET valid = false WHERE platform_slug = 'axo' AND observed_at < '2026-10-01';

-- Qué recuerda el agente
SELECT path, updated_at, updated_by FROM memories ORDER BY updated_at DESC;
```

## Privacidad y retención (recomendación)

- Usar cuentas de prueba en las plataformas con sesión.
- Revisar `memories` una vez al mes y borrar lo que no sirva.
- Borrar capturas y entregables de proyectos cerrados después de 12 meses (Blob y filas `captures` / `deliverables`).
- Si un cliente lo exige, mover capturas a almacenamiento privado (ver [09](09-proximos-pasos.md)).
