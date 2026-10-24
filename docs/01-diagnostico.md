# 01 · Diagnóstico del código anterior

Se revisaron dos versiones:

- **GitHub** (`salsa-partners/salsa-ux-chat`, rama `main`): solo chat, 60 s por respuesta, sin herramientas.
- **Local** (`Downloads/salsa-ux-chat 2`, ahora consolidada en `Downloads/salsa-ux-chat`): agrega revisión en vivo con navegador (Browserbase), capturas y Excel. Es la base de esta versión 2.0. **Esta versión todavía no está subida a GitHub.**

## Lo que estaba bien y se conservó

- Revisión en vivo de solo lectura: bloqueo de clics de pago/envío, lista blanca de dominios, sin herramienta para escribir.
- Sesiones sin contraseñas: la persona administradora inicia sesión en un navegador en la nube y el agente reutiliza las cookies.
- Excel con capturas incrustadas, puntajes 1–5 y journey óptimo.
- Streaming de pasos ("Abriendo…", "Captura…") para que la espera no sea muda.
- Límite de tiempo con aviso para cerrar con el Excel antes del corte.

## Lo que impedía ir a producción

| # | Problema | Impacto | Cómo quedó resuelto |
|---|---|---|---|
| 1 | **Sin memoria del servidor.** Los chats vivían solo en el navegador de cada persona. | Se pierden al cambiar de equipo; nadie más los ve; el agente no aprende. | Conversaciones, hallazgos, capturas y memoria en Neon Postgres + Vercel Blob. |
| 2 | **Conocimiento fijo en el código** (`lib/knowledge.js`). | Cada benchmark nuevo exigía editar código y redeploy. | Proyectos y plataformas en la base; los hallazgos de cada revisión se guardan solos. |
| 3 | **Limitado a Axo, Lucis y Zentum** (dominios y nombres fijos en código, Excel con 3 columnas fijas). | No podía hacer benchmark "de las plataformas que le pida". | Registro dinámico de plataformas; Excel con columnas por plataforma. |
| 4 | **Recorte del historial en el cliente** (`pruneImages` borraba capturas viejas). | Con Sonnet 5.5 en cuentas creadas desde el 31-ago-2026, editar turnos anteriores invalida el razonamiento del modelo y la API responde **error 400**. | Se reemplazó por limpieza del lado del servidor (`context editing`), que no cuenta como edición. El historial ahora solo crece. |
| 5 | **Límites de uso en memoria de la instancia** (`Map` por IP). | En Vercel cada instancia tiene su propio contador: el límite real era mucho mayor que el configurado. | Límites por persona contados en la tabla `runs`. |
| 6 | **Cookie de acceso igual para todos** y firmada con la API key. | No se sabía quién usaba el agente; rotar la API key cerraba todas las sesiones. | Cookie firmada con `SESSION_SECRET`, con correo y nombre; comparación de códigos en tiempo constante. |
| 7 | **Sin observabilidad.** | No se sabía cuánto costaba, cuánto tardaba ni qué fallaba. | Tabla `runs` con tokens, caché, herramientas usadas, duración y error; resumen en `/admin`. |
| 8 | **Sin forma de medir calidad.** | Un cambio de prompt podía empeorar al agente sin que nadie lo notara. | 12 evals con juez automático, corridas desde `/admin`. |
| 9 | **Sin investigación web.** | No podía mirar precios publicados, reseñas o sitios públicos. | Herramientas `web_search` y `web_fetch` de Anthropic. |
| 10 | **Revisiones de 4 plataformas no caben en 5 minutos.** | Respuestas cortadas. | Una plataforma por respuesta + consolidado con `incluir_guardados`. |
| 11 | **Sin caché del historial en el loop.** | Cada vuelta del agente volvía a pagar todo el historial. | Caché automático del historial (lecturas a ~10% del precio). |

## Riesgos que siguen abiertos

- La revisión en vivo depende de que las sesiones de las plataformas no venzan (se renuevan en `/admin`).
- Las capturas pueden mostrar datos personales de la cuenta usada: usar **cuentas de prueba**.
- Las URLs de Vercel Blob son públicas pero imposibles de adivinar (sufijo aleatorio). Si se requiere privacidad estricta, ver [09](09-proximos-pasos.md).
