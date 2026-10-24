// Datos iniciales del agente. Archivo .mjs para que lo usen tanto la app (Next) como los scripts de node.

// Resumen del benchmark Longevidad 2026 (contexto del proyecto inicial).
export const LONGEVIDAD_2026 = "RESULTADOS DEL BENCHMARK (7 oct 2026, cuentas reales, solo lectura; login no evaluado; en pagos se detuvo antes de pagar)\nPuntaje promedio 1-5 por journey (Axo / Lucis / Zentum / gana):\n- Inicio: 3,3 / 4,8 / 4,6 / Lucis\n- Resultados: 3,3 / 4,1 / 4,5 / Zentum\n- Recomendaciones: 3,0 / 4,2 / 4,4 / Zentum\n- Pagos: 3,3 / 3,9 / 4,7 / Zentum\n- Cita de laboratorio: 3,4 / – / – / solo Axo\n\nAXO (español, BETA)\n- Inicio: bienvenida con texto largo y video de \"Andy\" antes de los pasos; mucho scroll. Checklist \"Tu viaje de salud\" dice \"Resultados de pruebas: En espera\" aunque ya hay resultados (GRAVE).\n- Resultados: lista plana de ~100 biomarcadores con buscador y filtros por estado y área; sin resumen ni puntaje global (GRAVE); valores en inglés (\"Negative\", \"Cloudy\"). Detalle: estado, valor, gráfico con bandas; explicación mínima y mezcla idiomas (\"¿Qué es Vitamin D3?\"); no dice qué hacer.\n- Cita: lugar, horario y fecha; para reagendar hay que escribir a soporte por email.\n- \"Recomendaciones\" abre instrucciones previas al examen, no recomendaciones (GRAVE).\n- Pagos: \"Complementos\" con interruptores y precios en USD; al activar solo aparece \"Continuar\", sin total ni resumen (GRAVE). Algunas imágenes no cargan.\nLUCIS (app en inglés, login en francés)\n- Inicio: \"Your protocol is ready\", línea de tiempo Visita → Resultados → Protocolo → Acciones, chat con IA, menú inferior. Referente.\n- Resultados: carga ~7 s con skeleton; reporte revisado por médico; encuesta NPS emergente antes de leer. \"All markers\": edad biológica, Lucis Score, puntaje por área (algunas \"Locked\" como venta), conteo fuera de rango/óptimo. Detalle de biomarcador simple y claro.\n- Acciones: agrupadas en 4 objetivos con explicación personalizada; textos densos.\n- Pagos: catálogo \"Lucis Essentials\" sin precio visible (\"Learn more\"); modal \"Step 1 of 2\" con barra de progreso, precio en euros y cupón.\nZENTUM (español, Perú, soles)\n- Inicio: saludo con nombre y fecha, Zentum Score con estado y \"?\" que explica el cálculo en 4 pasos; edad biológica vs cronológica.\n- Resultados: barras Óptimo / Mejorable / Fuera de rango, filtros, categorías; interpretación médica repetida en dos pantallas; error \"Biomakers\". Detalle: valor grande, rangos etiquetados, \"Qué es\" simple.\n- Plan de acción: 4 categorías con contador (Generales, Nutrición, Estilo de vida, Suplementación), cada recomendación explica el porqué con su valor; saludo cambia a inglés (\"Good morning\").\n- Pagos: planes en soles (Basic S/599, Core S/1.849, Advance S/2.399) y pruebas \"Recomendado para ti\"; al elegir, barra fija \"1 producto agregado\" + total + \"Ver carrito\". Referente.\n\nUX WRITING DE CUESTIONARIOS\n- Axo: 8 secciones (Datos personales 14, Objetivos 2, Áreas clave 10, Sueño y nutrición 3, Medicación 3, Historia clínica 3, Historia familiar 0, Preferencias 2) = 37 campos; guardado en inglés. Primeras: \"What name would you like us to use?\" (texto; nombre preferido, inclusivo), \"Date of birth\" (etiqueta, no pregunta), \"What sex were you assigned at birth?\" (lista; separa sexo de identidad). Trato \"you/us\". Inicio \"¡Bienvenido/a!\". Fricciones: \"Fertility Status\" repetido, peso y talla duplicados, \"Choose an option:\" sin contexto, pide número de documento.\n- Zentum: registro 5 pasos (Cuenta, Sobre ti, Plan, Pago, Listo). Paso 1 \"Crea tu cuenta / Empieza a entender tu biología en minutos\": correo, celular (+51), contraseña. Paso 2 \"Cuéntanos acerca de ti\" + \"Estos 4 datos calibran tus rangos óptimos\": \"Nombres\"/\"Apellidos\", \"Fecha de nacimiento\" (\"La usamos para calcular tu edad biológica.\"), \"Sexo biológico\" Masculino/Femenino (\"Los rangos de referencia de tus biomarcadores dependen de él.\" / \"Usamos tu sexo biológico solo para calibrar rangos de laboratorio (hormonas, hierro, etc.).\"). Etiquetas, no preguntas. Mezcla tú/usted (\"Seleccione un plan\", \"USTED CONSIENTE\"). Perfil llama \"Género\" al sexo. \"Lectura de resultados 1:1 con una especialista\". El cuestionario de salud está aparte, por examen.\n- Lucis: cuestionario conversacional con IA (\"Lumi\") que adapta las preguntas; ya completado en la cuenta, no se pudo ver. Saluda \"Hello <nombre>.\"\n\nJOURNEY ÓPTIMO (de dónde sale cada paso)\nInicio: etapa + siguiente paso en una vista (Lucis); saludo con nombre y score principal (Zentum); estados siempre sincronizados (aprendizaje Axo).\nResultados: resumen con score, edad biológica y cuántos fuera de rango (Lucis/Zentum); \"¿Cómo calculamos?\" simple (Zentum); interpretación médica en 3 bullets (Zentum + Lucis); lista por prioridad con filtros (Lucis + filtros de Axo); detalle con valor, rangos, \"Qué es\" y acción sugerida (Zentum + Lucis); NPS al terminar de leer.\nRecomendaciones: por objetivo o categoría con el porqué en 1 línea (Lucis + Zentum); instrucciones del examen en sección aparte (aprendizaje Axo).\nPagos: pruebas recomendadas con precio en moneda local (Zentum); selección rápida con total y carrito visibles (Zentum + Axo); checkout por pasos con progreso, precio y cupón (Lucis).\nCita: reagendar en la misma pantalla (Axo mejorado).";

// Plataformas iniciales. El registro completo vive en la tabla platforms.
export const PLATFORMS = {
  axo: {
    nombre: "Axo",
    dominios: ["axolongevity.com"],
    app: "https://app.axolongevity.com/es/first-steps/",
    web: "https://www.axolongevity.com/es-pe/home-b",
  },
  lucis: {
    nombre: "Lucis",
    dominios: ["lucis.life"],
    app: "https://app.lucis.life/dashboard/",
    web: "https://www.lucis.life/",
  },
  zentum: {
    nombre: "Zentum",
    dominios: ["zentum.com"],
    app: "https://app.zentum.com/dashboard",
    web: "https://www.zentum.com/",
  },
};

export const DEFAULT_PROJECT = {
  slug: "longevidad-2026",
  name: "Benchmark Longevidad 2026",
  client: "Salsa (interno)",
  sector: "Salud preventiva y longevidad",
};

// Memoria inicial del agente (herramienta memory). Solo se crea si no existe.
export const SEED_MEMORIES = {
  "/memories/equipo/como-trabajamos.md": "# Cómo trabaja Salsa\n- Entregables en español, cálidos y directos; primero la conclusión.\n- Cada hallazgo se prueba con texto exacto o captura.\n- Puntajes 1-5: claridad, esfuerzo, feedback, confianza, diseño, writing.\n",
};
