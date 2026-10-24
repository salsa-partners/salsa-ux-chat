# 11 · Propuesta: componentes y razonamiento del agente UX

> Estado: **propuesta para discutir**. Nada de esto está implementado todavía; la base actual (migración 0001) ya soporta proyectos, plataformas, hallazgos, capturas y memoria. Las tablas nuevas de abajo serían la migración 0002 cuando lo aprobemos.

## La idea en una frase

Antes de opinar de UX, el agente **entiende la plataforma** (qué es, para quién, cómo funciona, cómo gana dinero) y **la recorre con evidencia**; recién entonces aplica su conocimiento de UX. Dos componentes grandes alimentan a un tercero:

```mermaid
flowchart LR
  P[Pedido<br/>"benchmark de A, B y C"] --> I[0 · Intake<br/>objetivo y preguntas]
  I --> R[1 · Perfil de la plataforma<br/>requisitos: negocio, funcional, técnico]
  I --> E[2 · Explorador de sitios<br/>scraping + capturas + extracción]
  E -->|datos| R
  R --> U[3 · Motor UX<br/>lentes: heurísticas, writing,<br/>accesibilidad, flujos]
  E --> U
  U --> S[4 · Síntesis<br/>comparativo, journey óptimo,<br/>recomendaciones priorizadas]
  S --> D[5 · Entregables<br/>chat, Excel, deck]
  M[(Memoria y base)] <--> R & E & U & S
```

## Componente 1 · Perfil de la plataforma (requisitos básicos)

Una **lista fija de requisitos** que el agente debe completar por cada plataforma antes del análisis. Cada requisito tiene: pregunta, por qué importa para UX, de dónde puede salir (sitio, búsqueda web, tiendas de apps, la persona que pide) y estado (`pendiente`, `inferido`, `confirmado`, `no aplica`) con evidencia y nivel de confianza.

| Bloque | Requisitos (versión 1) | Para qué le sirve al análisis UX |
|---|---|---|
| **Negocio** | Propuesta de valor · público objetivo · modelo de ingresos (suscripción, transacción, freemium, B2B) · precios publicados y moneda · mercado/país · competidores declarados · etapa (beta, consolidada) | Juzgar si la experiencia sirve al objetivo del negocio (p. ej. un checkout que esconde el total contradice un modelo transaccional) |
| **Funcional** | Journeys principales (descubrir, registrarse, usar el núcleo, pagar, recibir soporte) · funcionalidades clave · qué requiere cuenta · medios de pago · canales de soporte · notificaciones | Saber qué recorrer y qué comparar "manzanas con manzanas" |
| **Técnico** | Canales (web, iOS, Android, PWA) · idiomas · tecnología detectada (framework, analítica, chat, pagos) · rendimiento (carga, peso) · accesibilidad básica automática · SEO básico · integraciones visibles | Explicar fricciones de origen técnico y limitar recomendaciones a lo viable |
| **Contexto del pedido** | Objetivo del benchmark · decisiones que se quieren tomar · journeys prioritarios · plataforma propia de referencia · audiencia del entregable | Enfocar el análisis y el formato de la respuesta |

Razonamiento: el agente **llena todo lo que puede solo** (explorador + búsqueda web + tiendas de apps), marca lo inferido con su fuente, y **solo pregunta a la persona lo que no se puede inferir y cambia el análisis** (casi siempre el bloque "Contexto del pedido"). El perfil se guarda y se reutiliza en cualquier conversación del proyecto.

## Componente 2 · Explorador de sitios (scraping + insights)

Pipeline por plataforma, de lo determinístico (barato y exacto) a lo interpretativo (modelo):

| Etapa | Qué hace | Cómo |
|---|---|---|
| **Descubrir** | Encuentra las páginas a revisar: sitemap, menú, footer, enlaces del home. Las clasifica por tipo (home, producto, precios, registro, login, ayuda/FAQ, legal, blog) y prioriza según el pedido. | `fetch` + parser; modelo barato (Haiku 5.5) solo para clasificar ambiguas |
| **Capturar** | Por página: captura desktop y móvil, HTML/texto visible, títulos, CTAs, formularios (campos y etiquetas), imágenes sin `alt`, enlaces, respuesta de red. | Browserbase + Playwright (ya en el repo); páginas públicas sin sesión |
| **Extraer (sin modelo)** | Datos objetivos: jerarquía de títulos, CTAs por pantalla, campos de formularios, idioma, metadatos, tecnología detectada, chequeo automático de accesibilidad (axe-core), peso y tiempos. | Código; resultado en JSON |
| **Interpretar (con modelo)** | Por página: propósito, propuesta de valor, mensaje principal, CTA principal, tono y trato, fricciones visibles, datos para el perfil (precios, público). | Salida estructurada (JSON con esquema), citando texto exacto |
| **Insights** | Hallazgos con evidencia: "afirmación + cita exacta + captura + severidad + lente + recomendación". | Modelo principal, con las lentes del motor UX |

Reglas: solo páginas públicas, respetar `robots.txt`, máximo N páginas por plataforma y pausas entre pedidos, nunca saltar logins ni enviar formularios. Las plataformas con sesión siguen el flujo actual de `/admin`.

## Componente 3 · Motor UX (el conocimiento)

"Lentes" reutilizables, cada una con su rúbrica escrita en el repo (`lib/ux/lenses/`), que se aplican sobre el perfil + lo capturado:

- **Heurísticas de Nielsen** con severidad 0–4.
- **UX writing**: trato, claridad, voz, género, idioma, microcopy de errores y formularios.
- **Accesibilidad** WCAG 2.2 AA (automático del explorador + revisión del modelo sobre capturas).
- **Patrones por journey**: onboarding, búsqueda, ficha de producto, checkout, resultados, soporte.
- **Negocio ↔ experiencia**: ¿la experiencia empuja la conversión que el modelo de negocio necesita?
- **Puntaje Salsa 1–5** (claridad, esfuerzo, feedback, confianza, diseño, writing), como hoy.

La síntesis compara plataformas con la misma lente, arma el journey óptimo y prioriza recomendaciones (impacto × esfuerzo) citando la plataforma referente.

## Cómo razona el agente (orquestación)

Un **estudio** avanza por estados guardados en la base, para que sobreviva al límite de tiempo de Vercel y se pueda retomar:

`intake → perfil → exploración → análisis → síntesis → entregable`

- Los pasos pesados y repetibles (descubrir, capturar, extraer) son **código determinístico**, no decisiones del modelo: más baratos, más rápidos y auditables.
- El modelo decide en los puntos de juicio: qué páginas importan, qué significa lo visto, qué es un hallazgo, qué recomendar.
- Modelo por tarea: Haiku 5.5 para clasificar/extraer en volumen; Sonnet 5.5 (u Opus 5.5) para análisis y síntesis. Se decide con evals.
- Cada paso deja evidencia (cita + captura + URL + fecha) para que cualquier afirmación sea verificable.
- Más adelante, el estudio completo puede correr como trabajo en segundo plano (Vercel Workflow) y avisar al terminar; el chat queda para preguntar sobre los resultados.

## Estructura de código propuesta

```
lib/
  agent/orchestrator.js     estado del estudio y siguiente paso
  agent/intake.js           objetivo, preguntas y journeys prioritarios del pedido
  research/requirements.js  catálogo de requisitos (negocio, funcional, técnico, contexto)
  research/profiler.js      llena el perfil desde explorador + web + tiendas; lista los vacíos
  explorer/discover.js      sitemap + navegación → páginas priorizadas
  explorer/capture.js       capturas desktop/móvil, DOM, red (Browserbase/Playwright)
  explorer/extract.js       extracción sin modelo: CTAs, formularios, tecnología, axe-core
  explorer/interpret.js     interpretación por página con salida estructurada
  ux/lenses/*.md            rúbricas de cada lente (texto versionado, fácil de editar)
  ux/analyze.js             aplica lentes → insights con evidencia
  ux/synthesize.js          comparativo, journey óptimo, recomendaciones
  ux/deliver.js             Excel (ya existe en lib/excel.js) y deck
```

## Datos nuevos (borrador de la migración 0002)

```sql
-- Perfil: un valor por requisito y plataforma
CREATE TABLE platform_profiles (
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  platform_slug text NOT NULL,
  requirement text NOT NULL,            -- p. ej. 'negocio.modelo_ingresos'
  value jsonb,
  status text NOT NULL DEFAULT 'pendiente', -- pendiente | inferido | confirmado | no_aplica
  confidence numeric,
  source text,                          -- sitio | web | app_store | persona
  evidence_url text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, platform_slug, requirement)
);

-- Páginas exploradas
CREATE TABLE pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_slug text NOT NULL,
  url text NOT NULL,
  page_type text,                       -- home | precios | producto | registro | ayuda | legal ...
  title text,
  screenshot_desktop text, screenshot_mobile text,  -- URLs de Blob
  extracted jsonb,                      -- CTAs, formularios, títulos, tecnología, accesibilidad, rendimiento
  interpretation jsonb,                 -- propósito, propuesta de valor, tono, fricciones
  content_hash text,                    -- para detectar cambios entre visitas
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform_slug, url, content_hash)
);

-- Insights por página (los hallazgos por paso de journey siguen en findings)
CREATE TABLE insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  platform_slug text NOT NULL,
  page_id uuid REFERENCES pages(id) ON DELETE SET NULL,
  lens text NOT NULL,                   -- heuristicas | writing | accesibilidad | journey | negocio
  statement text NOT NULL,
  evidence_quote text,
  severity text,                        -- grave | media | leve | positivo
  recommendation text,
  confidence numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

## Orden sugerido para construirlo

1. **Catálogo de requisitos + perfil** (sin scraping todavía: con búsqueda web y lo que diga la persona). Valor inmediato y bajo riesgo.
2. **Explorador para sitios públicos**: descubrir → capturar → extraer → interpretar, con un límite de páginas.
3. **Lentes UX como archivos** + análisis que produce `insights` con evidencia.
4. **Síntesis y entregables** reutilizando el Excel actual.
5. **Orquestador con estados** y, cuando haga falta, ejecución en segundo plano.
6. Recién ahí, decidir el frente: chat, vista de estudio con progreso, o ambos.
