# 07 · Calidad y evals

Un agente sin medición empeora en silencio. Las evals son preguntas fijas con lo que la respuesta **debe** y **no debe** hacer; otro modelo (`JUDGE_MODEL`, por defecto `claude-opus-5-5`) actúa como juez.

## Cómo correrlas

`/admin` → **Calidad (evals)** → *Correr evals*. Tarda alrededor de un minuto, corre las 12 preguntas en paralelo sin navegador ni memoria (solo con el contexto del proyecto) y guarda el resultado en `eval_results`. El historial de corridas aparece debajo.

## Qué miden

| Caso | Qué protege |
|---|---|
| `conocimiento-pagos`, `heuristicas-axo`, `genero-zentum`, `journey-optimo` | Que use bien el conocimiento del proyecto |
| `honestidad-precio` | Que no invente datos que no se evaluaron |
| `fuera-de-tema` | Que se mantenga en su rol |
| `writing-reescritura` | Calidad de UX writing |
| `metodo-nuevo-benchmark`, `accesibilidad-checkout` | Que actúe como experto en UX, no solo como buscador |
| `privacidad` | Que no comparta datos personales o de salud |
| `seguridad-pago` | Que nunca pague ni actúe fuera de solo lectura |
| `priorizacion-axo` | Recomendaciones accionables ligadas a hallazgos |

Los casos están en `lib/evals.js` (`CASES`).

## Cuándo correrlas

- Después de cambiar `BASE_PROMPT` o `AGENT_PROMPT`.
- Antes de cambiar `ANTHROPIC_MODEL` o `AGENT_EFFORT`.
- Después de actualizar el brief de un proyecto.
- Una vez al mes, para detectar cambios.

**Umbral sugerido**: 10/12 o más. Los casos `privacidad` y `seguridad-pago` deben pasar siempre.

## Cómo agregar casos

Cada vez que el agente responda mal en uso real, conviértelo en un caso:

```js
{ id: "nombre-corto", q: "La pregunta tal cual la hicieron",
  must: "Lo que una buena respuesta debe incluir, verificable",
  mustNot: "El error que cometió" },
```

Mantén los criterios concretos ("cita el texto exacto X") en vez de vagos ("responde bien"). Un juez automático también se equivoca: revisa a mano las respuestas reprobadas antes de cambiar el prompt.

## Limitaciones

- No prueban la revisión en vivo (el navegador cuesta y las plataformas cambian). Para eso, usar la lista de verificación de [06](06-despliegue-vercel.md) después de cada cambio en `lib/tools.js`.
- Cada corrida cuesta tokens (12 respuestas + 12 juicios; del orden de centavos de dólar).
