# 05 · Cómo hacer un benchmark con el agente

## Antes de empezar (una vez por estudio)

1. **Crear el proyecto** en `/admin` → Proyectos: nombre, cliente, sector y un brief (objetivo, público, journeys a evaluar, hipótesis).
2. **Registrar las plataformas**:
   - Públicas (sitios web, landings, catálogos): basta con pedírselo al agente en el chat ("agrega Rappi: https://www.rappi.com.pe") o hacerlo en `/admin`.
   - Con inicio de sesión: en `/admin` → Plataformas, marcar "Requiere iniciar sesión" y poner la URL de la app; luego `/admin` → Sesiones del navegador → **Abrir navegador** → iniciar sesión tú → **Guardar sesión**. Usar cuentas de prueba.
3. En el chat, elegir el proyecto en el menú lateral.

## Flujo recomendado

| Paso | Qué pedir | Resultado |
|---|---|---|
| 1. Contexto | "¿Qué sabemos ya de este proyecto?" | Resumen desde hallazgos y memoria |
| 2. Investigación pública | "Busca precios publicados y reseñas en tiendas de apps de A, B y C" | Respuesta con fuentes |
| 3. Revisión en vivo, **una plataforma por mensaje** | "Revisa en vivo el onboarding y el checkout de A, con capturas y Excel" | Excel de A; hallazgos guardados |
| 4. Repetir para B, C… | "Ahora lo mismo para B" | Excel de B; hallazgos guardados |
| 5. Consolidado | "Arma el Excel consolidado del proyecto con todo lo guardado y el journey óptimo" | Excel con todas las plataformas (`incluir_guardados`) |
| 6. Análisis | "Top 3 mejoras por plataforma", "¿Quién gana en pagos y por qué?" | Respuestas citando hallazgos con fecha |

Por qué una plataforma por mensaje: cada respuesta tiene ~4,5 minutos y 18 capturas (límite de Vercel y de costo). Lo revisado queda guardado, así que nada se pierde entre mensajes.

## Ejemplos de pedidos que funcionan bien

- "Revisa en vivo el registro de Zentum hasta antes de pagar. Quiero el texto exacto de cada pantalla y el Excel."
- "Compara palabra por palabra los cuestionarios de salud de Axo y Zentum: trato, género e idioma." *(activa las hojas de UX Writing)*
- "Agrega Cabify (https://cabify.com/pe) y revisa su home: propuesta de valor, CTA principal y accesibilidad."
- "Con lo guardado, ¿qué plataforma explica mejor por qué pide cada dato?"
- "Esta captura es de nuestro prototipo [adjunta]: evalúala con los mismos criterios que usamos para Lucis."
- "Recuerda que para este cliente el entregable final va en inglés."

## El Excel

| Hoja | Contenido |
|---|---|
| Resumen | Hallazgos clave y lo que no se pudo ver |
| Comparativo | Promedio por journey y plataforma (con fórmulas) y quién gana |
| Journey óptimo | Paso ideal, de qué plataforma sale y por qué |
| Una hoja por plataforma | Cada paso con captura incrustada, texto exacto, 6 puntajes, fricción, writing, emoción y recomendación |
| UX Writing / Comparativo Writing | Solo si se pidió análisis de textos |

## Si algo sale mal

| Mensaje | Qué hacer |
|---|---|
| "SESIÓN VENCIDA" | `/admin` → Sesiones del navegador → volver a iniciar sesión en esa plataforma |
| "URL no permitida" | La plataforma no está registrada o está inactiva |
| "Se acabó el tiempo de esta revisión" | Pedir menos journeys o una sola plataforma |
| "Límite de revisiones en vivo por hora" | Esperar o subir `AGENT_RUNS_PER_HOUR` |
| Un dato está desactualizado | Pedir "revisa de nuevo X en vivo"; para borrar lo viejo, ver consultas en [03](03-memoria-y-datos.md) |
