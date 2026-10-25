# 12 · Plan para manejar Vercel

## Dónde está todo

| Cosa | Valor |
|---|---|
| Cuenta | `winnywts-3328` |
| Equipo | `salsa7` |
| Proyecto | `salsa-ux-chat` (Node 24.x) |
| Producción | https://salsa-ux-chat.vercel.app (hoy corre la versión antigua, desplegada desde GitHub) |
| Repo local | `~/Downloads/salsa-ux-chat`, rama `v2-agente-ux` sobre `main` de `salsa-partners/salsa-ux-chat` |
| Archivos | Blob store `salsa-ux-files` (público, conectado a los 3 entornos) |
| Base | Neon `salsa-ux-db` (pendiente: aceptar términos de Neon) |
| Navegador | Browserbase Free (máx. 3 a la vez, sesiones de 300 s), contexto `salsa-ux-chat` en `BROWSERBASE_CONTEXT_ID` |
| Gasto | Topes en Vercel (`BUDGET_*`, `BROWSER_MINUTES_MONTHLY`); `npm run usage` para ver el mes |
| Preview | https://salsa-ux-chat-3fq5i73kl-salsa7.vercel.app (protegido con login de Vercel) |
| Claves de producción | `.env` local (no se sube a Git) → `npm run env:push` |

## Tres formas de manejar Vercel (instaladas el 24-oct-2026)

| Herramienta | Para qué | Cómo se usa |
|---|---|---|
| **Vercel CLI** (`vercel@63.1.2`, dependencia del repo) | Todo lo operativo: variables, despliegues, logs, base, Blob | `npx vercel …` o los atajos `npm run …` de abajo |
| **Plugin de Vercel para Claude Code** (`vercel-plugin@vercel` 0.54.1, alcance usuario) | Que Claude sepa de Vercel: 37 skills (Next.js, AI SDK, Workflow, Blob, Neon…), comandos `/vercel-plugin:status`, `/vercel-plugin:deploy`, `/vercel-plugin:env`, `/vercel-plugin:bootstrap` y 3 agentes expertos | Desde el chat de Claude Code |
| **MCP de Vercel** (`https://mcp.vercel.com`, alcance usuario en `~/.claude.json`) | Que Claude consulte y opere tu cuenta: documentación, proyectos, despliegues, logs | Desde el chat, después de autorizarlo (ver abajo) |

### Activar el MCP (una vez)

1. Abre una sesión nueva de Claude Code (o recarga la app).
2. Escribe `/mcp`, elige `vercel` y la opción de autenticar. Se abre el navegador: autoriza con tu cuenta.
3. Pide a Claude: "lista mis equipos de Vercel". Si responde con `salsa7`, quedó conectado.

El MCP tiene los mismos permisos que tu usuario de Vercel. Mantén la confirmación humana para cualquier acción que cambie algo (desplegar, borrar, cambiar variables).

## Operación diaria

| Quiero… | Comando |
|---|---|
| Traer variables a local | `npm run env:pull` |
| Ver variables | `npx vercel env ls` |
| Cambiar una variable | `npx vercel env update NOMBRE production` (pega el valor cuando lo pida) |
| Agregar una variable | `npx vercel env add NOMBRE production --sensitive` |
| Probar en local | `npm run dev` |
| Desplegar una versión de prueba | `npm run deploy:preview` |
| Publicar a producción | `npm run deploy:prod` |
| Ver despliegues | `npx vercel ls` |
| Ver logs de producción | `npx vercel logs salsa-ux-chat.vercel.app` |
| Volver a la versión anterior | `npx vercel rollback` |
| Estado de la base | `npm run db:status` |
| Diagnóstico completo | `npm run doctor` |
| Ver recursos (Neon, Blob) | `npx vercel integration list` · `npx vercel blob list-stores` |

## Plan por etapas

**Etapa 1 · Hoy: base inicializada.** Terminar `npm run bootstrap` (en la terminal: elegir el proyecto `salsa-ux-chat` existente, crear Neon, cargar secretos). Resultado: base con migraciones y datos iniciales, `.env.local` listo, `npm run doctor` en verde.

**Etapa 2 · Máquina lista (hecho el 24-oct-2026, sin permisos de administrador).**
- Node.js v24.22.1 en `~/.local/node` y Vercel CLI global, en el PATH vía `~/.zprofile`.
- GitHub Desktop en `~/Applications`; su `git` también queda en el PATH (`~/.zprofile`). Para subir cambios, inicia sesión en GitHub Desktop (la terminal no tiene credenciales de GitHub).

**Etapa 3 · Un solo camino de despliegue.** Hoy producción sale de GitHub (`main`, versión antigua). Si desplegaras con `npm run deploy:prod` desde la carpeta, el siguiente push a `main` volvería a poner la versión antigua. Por eso:
1. Subir la v2 a GitHub en una rama (`v2-agente-ux`) → Vercel crea un preview automático.
2. Probar el preview con la lista de [06](06-despliegue-vercel.md).
3. Hacer merge a `main` → producción.
4. Desde ahí, **todo cambio entra por GitHub**; `deploy:preview` queda solo para pruebas rápidas.

**Etapa 4 · Entornos separados (cuando haya datos de clientes).** En Neon, activar una rama de base por cada preview, para que las pruebas no toquen los datos de producción.

## Telemetría y privacidad del plugin

El plugin de Vercel envía telemetría anónima de uso (qué skills se usan). Para apagarla, agrega `VERCEL_PLUGIN_TELEMETRY=off` a tu entorno (por ejemplo en `~/.zshrc`).

## Si algo falla

| Síntoma | Solución |
|---|---|
| `vercel: command not found` | Usa `npx vercel` dentro del repo, o instala Node y luego `npm i -g vercel` |
| El MCP no aparece en `/mcp` | Recargar la app; revisar que `~/.claude.json` tenga `mcpServers.vercel` |
| Errores de hooks del plugin al iniciar sesión | Falta Node instalado en el sistema (Etapa 2) |
| Producción volvió a la versión vieja | Alguien hizo push a `main` con la versión antigua; ver Etapa 3 |
