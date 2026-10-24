# 09 · Próximos pasos

Ordenados por valor para el equipo.

## Corto plazo (primer mes en producción)

1. **Medir y ajustar.** Revisar `runs` cada semana: costo por revisión, errores, uso del caché. Ajustar `AGENT_EFFORT` y límites.
2. **Crecer las evals.** Convertir cada respuesta mala del uso real en un caso de `lib/evals.js`. Meta: 25–30 casos.
3. **Comparar modelos.** Correr evals con `claude-sonnet-5-5` y `claude-opus-5-5`; decidir con datos si las revisiones en vivo justifican Opus.
4. **Cargar proyectos reales** con su brief y plataformas.
5. **Probar la revisión en vivo en el preview.** El SDK de Browserbase se verificó (`api_timeout` es correcto; el botón "Ir a" de `/admin` ahora reconecta aunque la API no devuelva la URL de conexión), pero falta probarlo con una cuenta real.

## Mediano plazo

6. **Revisiones largas en segundo plano.** Hoy una respuesta dura como máximo 300 s (800 s en Pro). Para revisar 4+ plataformas de una vez, mover la revisión a un trabajo en segundo plano (Vercel Workflow o Queues) que avance plataforma por plataforma y avise en el chat al terminar.
7. **Búsqueda semántica en hallazgos.** Agregar `pgvector` en Neon para preguntas como "¿qué plataformas explican bien los resultados?" sin depender de palabras exactas.
8. **Capturas privadas.** Si un cliente lo exige, servir capturas y Excel a través de una ruta que verifique la sesión, en lugar de URLs públicas de Blob.
9. **Roles.** Usar `users.role` para separar quién puede registrar plataformas, ver costos o borrar hallazgos.
10. **Exportar a presentación.** Generar el deck de hallazgos con la marca Salsa a partir de `findings`.

## Largo plazo

11. **Monitoreo de plataformas.** Revisiones programadas (por ejemplo, mensuales) que detecten cambios en journeys clave y los anoten en memoria.
12. **Panel de benchmark.** Una vista con puntajes por plataforma y journey en el tiempo, alimentada por `findings`.
