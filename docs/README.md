# Agente UX de Salsa · Documentación

Versión 2.0 · 24 de octubre de 2026

Esta carpeta explica qué es el agente, cómo está construido, dónde guarda la información, cómo se despliega en Vercel y cómo se opera en producción.

## Resumen en 30 segundos

El chat pasó de ser un "consultor de 3 apps" con conocimiento fijo a un **agente UX con memoria**, que:

- Responde como un UX researcher senior y UX writer (heurísticas, accesibilidad, writing, journeys, priorización).
- **Hace benchmarks de las plataformas que le pidas**: las públicas las registra él mismo; las que requieren sesión las agregas en `/admin`.
- **Recuerda**: guarda conversaciones, hallazgos, capturas, entregables y aprendizajes en una base de datos (Neon Postgres) y en archivos (Vercel Blob).
- Puede **sumar revisiones**: revisa una plataforma por respuesta y luego arma un Excel consolidado con todo lo guardado.
- Investiga en la web (búsqueda y lectura de páginas públicas) citando la fuente.
- Tiene un **panel de control de calidad** (evals) y métricas de uso y costo.

## Índice

| # | Documento | Para qué sirve |
|---|---|---|
| 01 | [Diagnóstico del código anterior](01-diagnostico.md) | Qué había y qué faltaba para producción |
| 02 | [Arquitectura del harness](02-arquitectura-harness.md) | Cómo funciona el agente por dentro |
| 03 | [Memoria y datos](03-memoria-y-datos.md) | Qué se guarda, dónde y por cuánto tiempo |
| 04 | [El agente experto en UX](04-agente-experto-ux.md) | Prompt, método, herramientas y cómo mejorarlo |
| 05 | [Cómo hacer un benchmark](05-como-hacer-un-benchmark.md) | Guía práctica con ejemplos de pedidos |
| 06 | [Despliegue en Vercel](06-despliegue-vercel.md) | Paso a paso para publicarlo |
| 07 | [Calidad y evals](07-calidad-y-evals.md) | Cómo medir que el agente no empeora |
| 08 | [Operación, costos y seguridad](08-operacion-costos-seguridad.md) | Monitoreo, límites, costos y qué hacer si algo falla |
| 09 | [Próximos pasos](09-proximos-pasos.md) | Lo que sigue después de salir a producción |
| 10 | [Bootstrap de la base](10-bootstrap-base-de-datos.md) | ★ Inicializar todo en Vercel desde el repo con un comando |
| 11 | [Propuesta de componentes del agente](11-propuesta-componentes-agente.md) | Perfil de la plataforma + explorador de sitios + motor UX |
| 12 | [Plan para manejar Vercel](12-operar-vercel.md) | CLI, plugin y MCP de Vercel; operación diaria y etapas |

## Mapa de archivos del código

```
app/
  page.js                    Chat (acceso con correo, historial, proyectos)
  admin/page.js              Panel de administración
  api/chat/route.js          ★ El loop del agente (harness)
  api/conversations/route.js Historial de cada persona
  api/auth/route.js          Acceso con código + correo
  api/admin/route.js         Acciones del panel
lib/
  knowledge.js               ★ Identidad y método del agente + datos del benchmark Longevidad 2026
  tools.js                   ★ Herramientas del agente (navegador, conocimiento, memoria, web, Excel)
  memory.js                  Memoria de largo plazo (herramienta "memory" de Claude) sobre Postgres
  store.js                   Acceso a datos (conversaciones, hallazgos, plataformas, métricas)
  db.js                      Conexión a Neon y Vercel Blob
  evals.js                   Preguntas de control de calidad y juez
  excel.js                   Excel con capturas incrustadas
  browser.js                 Navegador en la nube (Browserbase)
  platforms.js               Plataformas iniciales y lista blanca de dominios
  access.js                  Cookie de sesión firmada
db/
  migrations.mjs             ★ Esquema de la base (migraciones versionadas)
  runner.mjs                 Motor de migraciones y datos iniciales
  seed-data.mjs              Datos iniciales (proyecto, plataformas, memoria)
scripts/
  bootstrap.sh               ★ Crea y configura todo en Vercel (npm run bootstrap)
  db.mjs                     npm run db:migrate | db:seed | db:setup | db:status
  doctor.mjs                 npm run doctor: diagnóstico sin gastar tokens
docs/                        Esta documentación
```

## Estado de la verificación

Verificado el 24-oct-2026 con Node.js v24.22.1 en esta Mac:

- `npm install` (lockfile regenerado con las dependencias nuevas) y `npm run build`: **sin errores**.
- Servidor local: acceso con código y correo, rechazo de código, correo y cookie inválidos, historial, panel `/admin` y sus permisos: **funcionan**.
- Excel con plataformas nuevas, nombres de hoja reservados o repetidos y puntajes faltantes: **funciona**.

**Falta probar** con claves reales (Anthropic, Neon, Blob, Browserbase): el loop del agente, la memoria persistente y la revisión en vivo. Usa la lista de verificación de [06](06-despliegue-vercel.md) en el despliegue de *preview*.
