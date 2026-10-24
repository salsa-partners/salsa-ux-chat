# 08 · Operación, costos y seguridad

## Monitoreo

| Dónde | Qué ver |
|---|---|
| `/admin` → Estado | Respuestas, revisiones en vivo, errores, tokens (y cuántos salieron de caché) y tiempo promedio de los últimos 30 días |
| Neon → SQL | Tabla `runs`: cada respuesta con modelo, tokens, herramientas usadas, duración, estado y error |
| Vercel → Logs | Errores del servidor (`console.error`) |
| console.anthropic.com → Usage | Gasto real en Anthropic |
| browserbase.com → Sessions | Minutos de navegador usados |

Consultas útiles:

```sql
-- Errores recientes
SELECT created_at, status, error, tool_calls FROM runs WHERE status <> 'ok' ORDER BY created_at DESC LIMIT 20;

-- Uso por persona (últimos 30 días)
SELECT u.email, count(*) AS respuestas, count(*) FILTER (WHERE r.kind = 'live') AS en_vivo,
       sum(r.input_tokens + r.cache_read_tokens) AS tokens_entrada, sum(r.output_tokens) AS tokens_salida
FROM runs r JOIN users u ON u.id = r.user_id
WHERE r.created_at > now() - interval '30 days' GROUP BY 1 ORDER BY 2 DESC;

-- ¿Está funcionando el caché? (proporción alta = bien)
SELECT round(sum(cache_read_tokens)::numeric / nullif(sum(input_tokens + cache_read_tokens), 0), 2) AS proporcion_cache
FROM runs WHERE created_at > now() - interval '7 days';
```

## Costos estimados

Precios de Anthropic para `claude-sonnet-5-5`: US$2 por millón de tokens de entrada, US$10 de salida, US$0,20 las lecturas de caché. Son **estimaciones de orden de magnitud**; medir con la tabla `runs` las primeras semanas.

| Tipo de uso | Costo aproximado por respuesta |
|---|---|
| Pregunta de conocimiento | US$0,01–0,05 |
| Con investigación web | US$0,05–0,20 (+ costo de búsquedas de Anthropic) |
| Revisión en vivo (≈15 capturas) | US$0,50–2,00 de Anthropic + minutos de Browserbase |
| Corrida de evals | Centavos de dólar |

Infraestructura: Vercel Pro (si se necesita más de 300 s), Neon y Blob tienen planes gratuitos suficientes para empezar; Browserbase necesita plan de pago para la sesión persistente de `/admin`.

Palancas para bajar costos: `AGENT_EFFORT=low` para preguntas simples, menos capturas por revisión, `WEB_TOOLS=off` si no se usa, límites por persona (`CHATS_PER_10_MIN`, `AGENT_RUNS_PER_HOUR`).

## Seguridad

| Riesgo | Control |
|---|---|
| Acceso no autorizado | Código de acceso + correo (opcionalmente solo dominios permitidos) + cookie firmada `HttpOnly`/`Secure` por 30 días |
| Ver chats de otra persona | Cada consulta filtra por el usuario de la cookie |
| Panel de administración | `ADMIN_CODE` aparte, comparado en tiempo constante; sin él el panel está apagado |
| Agente haciendo acciones reales | Sin herramienta de escritura, clics peligrosos bloqueados, botones submit bloqueados, solo dominios registrados |
| Páginas con instrucciones maliciosas | El prompt indica tratarlas como información; el agente no tiene herramientas que puedan causar daño |
| Contraseñas | Nunca llegan al agente ni a la base |
| Datos personales en capturas | Cuentas de prueba; el agente evita capturar pantallas con datos personales y no los repite |
| Abuso / costos | Límites por persona en base de datos |
| Secretos | Solo en variables de entorno de Vercel; `.env*` en `.gitignore` |

Cambiar `ACCESS_CODE` cuando alguien deja el equipo. Cambiar `SESSION_SECRET` cierra todas las sesiones.

## Qué hacer si…

| Síntoma | Causa probable | Solución |
|---|---|---|
| "Falta configurar ANTHROPIC_API_KEY" | Variable no cargada | Revisar variables y Redeploy |
| "Proyecto no encontrado. Prepara la base en /admin." | Tablas no creadas | `/admin` → Preparar base de datos |
| Error 400 de la API mencionando `fallbacks` o una beta | La cuenta o el modelo no soporta esa función | `REFUSAL_FALLBACK=off` y Redeploy |
| Error 400 mencionando `thinking` | Modelo antiguo en `ANTHROPIC_MODEL` | Usar `claude-sonnet-5-5` u `claude-opus-5-5` |
| "SESIÓN VENCIDA" en revisiones | Cookies vencidas en la plataforma | `/admin` → Sesiones del navegador |
| Respuestas cortadas por tiempo | Demasiadas pantallas por respuesta | Una plataforma por mensaje; en Pro subir `maxDuration` |
| El agente "olvidó" algo | No se guardó en memoria o es de otro proyecto | Pedir "recuerda que…" en el proyecto correcto; revisar tabla `memories` |
| Excel sin capturas antiguas en el consolidado | Faltaba Blob (`BLOB_STORE_ID`) cuando se hizo la revisión | Conectar Blob; repetir la revisión |
