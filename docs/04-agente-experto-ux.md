# 04 · El agente experto en UX

## Qué sabe hacer

| Pedido típico de un profesional UX | Cómo lo resuelve |
|---|---|
| "¿Quién tiene el mejor onboarding?" | Hallazgos guardados + contexto del proyecto; si están viejos o no existen, ofrece revisión en vivo |
| "Revisa el checkout de X y dame el Excel" | Navegador → capturas → puntajes → Excel con capturas incrustadas |
| "Compara los textos del registro de A y B" | Análisis de UX writing texto por texto (trato, género, idioma, voz, reescritura) |
| "¿Qué heurísticas rompe esta pantalla?" (con captura adjunta) | Evaluación heurística de Nielsen con severidad |
| "¿Es accesible este formulario?" | Revisión WCAG 2.2 AA de lo observable |
| "¿Cuánto cuesta el plan de Y?" | Busca en la web pública y cita la fuente |
| "Arma un plan de benchmark para apps de delivery" | Método: journeys, criterios, evidencias, entregable |
| "Top 3 mejoras para Z" | Recomendaciones priorizadas por impacto × esfuerzo, con plataforma referente |

## De dónde salen sus respuestas (en este orden)

1. Hallazgos guardados del proyecto y su contexto (con fecha).
2. Revisión en vivo con capturas.
3. Investigación web pública (con fuente).
4. Conocimiento general de UX, marcado como principio general.

Si algo no se evaluó, lo dice; si un hallazgo tiene más de 90 días, avisa que puede haber cambiado.

## Método de evaluación (igual para todas las plataformas)

- **Puntaje Salsa 1–5 por paso**: claridad, esfuerzo, feedback, confianza, diseño, writing. Fricción **GRAVE** = bloquea o confunde.
- **Heurísticas de Nielsen** para explicar hallazgos.
- **Accesibilidad WCAG 2.2 AA** observable: contraste, objetivos táctiles, etiquetas, errores en texto, foco, no depender solo del color.
- **Formularios y checkout**: total visible, progreso, campos mínimos, explicar por qué se pide cada dato.
- **UX writing** por texto: cita exacta, trato, estructura, voz, género, idioma, explicación del dato, largo, reescritura en tono Salsa.
- **Journey**: etapa, tarea, qué ve, clics, emoción, fricción, oportunidad.

## Herramientas

| Herramienta | Tipo | Qué hace | Requiere |
|---|---|---|---|
| `consultar_benchmark` | Propia | Lee hallazgos guardados o el resumen de puntajes por plataforma y journey | Base de datos |
| `agregar_plataforma` | Propia | Registra un sitio **público** para poder revisarlo | Base de datos |
| `memory` | Anthropic (se ejecuta en nuestro servidor) | Lee y escribe archivos en `/memories` | — (persistente con base) |
| `web_search`, `web_fetch` | Anthropic (se ejecutan en Anthropic) | Busca y lee páginas públicas; máx. 5 usos de cada una por respuesta | `WEB_TOOLS` ≠ off |
| `navegar`, `leer`, `capturar`, `clic`, `scroll` | Propias | Recorren las plataformas registradas, solo lectura | Browserbase |
| `generar_excel` | Propia | Entrega el Excel, guarda los pasos como hallazgos; `incluir_guardados` suma revisiones anteriores | Browserbase |

### Seguridad del navegador

- Solo dominios de plataformas **activas** del registro; si una página redirige afuera, vuelve atrás.
- No hay herramienta para escribir texto: no puede llenar formularios ni responder cuestionarios.
- Clics bloqueados: pagar, comprar, enviar, guardar, cerrar sesión, eliminar, cancelar, suscribir, reservar, etc., y cualquier botón `submit`.
- El texto de las páginas se trata como información, no como instrucciones (protección contra *prompt injection*).
- Máximo 18 capturas y ~4,5 minutos por respuesta; 6 revisiones en vivo por persona por hora.
- `agregar_plataforma` rechaza dominios de bancos, gobierno, pagos y redes sociales. Las plataformas con sesión solo se agregan en `/admin`.

## Cómo mejorar al agente

| Quiero que… | Dónde se cambia |
|---|---|
| Conozca un cliente o estudio nuevo | `/admin` → Proyectos → crear proyecto con su brief |
| Revise una plataforma con sesión | `/admin` → Plataformas (marcar "requiere sesión") → Sesiones del navegador |
| Cambie su método, tono o reglas | `BASE_PROMPT` / `AGENT_PROMPT` en `lib/knowledge.js` → luego **correr evals** |
| Recuerde una preferencia del equipo | Pídeselo en el chat ("recuerda que los entregables de X van en inglés") o edita la tabla `memories` |
| Tenga una herramienta nueva | Definición en `lib/tools.js` (`KNOWLEDGE_TOOLS` o `BROWSER_TOOLS`) + método en `Toolbox.exec` |
| Responda más profundo | `AGENT_EFFORT=high` (más lento y caro) o `ANTHROPIC_MODEL=claude-opus-5-5` — comparar con evals antes |

Regla: **todo cambio de prompt o de modelo se valida con las evals** ([07](07-calidad-y-evals.md)) antes de dejarlo en producción.

## Nota técnica sobre la memoria

Cuando la herramienta `memory` está activa, la API de Anthropic le indica a Claude que revise su memoria antes de empezar. Por eso la primera acción de muchas respuestas será leer `/memories` (una consulta rápida a la base). El índice de archivos también va en el contexto para que no tenga que adivinar qué hay.
