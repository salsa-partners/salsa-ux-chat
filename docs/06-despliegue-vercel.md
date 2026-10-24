# 06 · Despliegue en Vercel (paso a paso)

Tiempo estimado: 45–60 minutos la primera vez.

> **Camino recomendado:** `npm run bootstrap` hace los pasos 3, 4 y 5 desde la terminal (Neon, Blob, secretos, migraciones). Ver [10 · Bootstrap](10-bootstrap-base-de-datos.md). Esta guía queda como referencia del camino manual por el dashboard.

## 0. Requisitos en tu Mac

Esta Mac no tiene Node.js ni Git. Instala:

1. **Node.js LTS** desde https://nodejs.org (instalador .pkg).
2. **GitHub Desktop** desde https://desktop.github.com (incluye Git y no necesita terminal). Alternativa por terminal: `xcode-select --install`.

## 1. Probar que compila (en tu Mac)

Ya se hizo una vez (24-oct-2026, sin errores) y el `package-lock.json` ya está regenerado. Para repetirlo después de cambios, en la carpeta del proyecto:

```bash
npm install
```

```bash
npm run build
```

Si `npm run build` termina sin errores, sigue. Si falla, el mensaje dice el archivo y la línea.

Opcional, probar en local con un archivo `.env.local` (copia de `.env.example` con tus valores) y:

```bash
npm run dev
```

## 2. Subir el código a GitHub

La versión 2.0 vive en `Downloads/salsa-ux-chat` (aún no es un repositorio Git); GitHub tiene la versión antigua. Sin Git también se puede desplegar directo con `npm run deploy:preview`.

Con GitHub Desktop: *File → Add local repository* no servirá porque la carpeta no es un repositorio. Lo más simple:

1. *File → Clone repository* → `salsa-partners/salsa-ux-chat` en una carpeta nueva (por ejemplo `~/Documents/salsa-ux-chat`).
2. Crear una rama nueva: *Branch → New branch* → `v2-agente-ux`.
3. Copiar **todo** el contenido de `Downloads/salsa-ux-chat` (incluida la carpeta `docs/`, sin `node_modules` ni `.next`) encima de la carpeta clonada.
4. *Commit to v2-agente-ux* → *Publish branch* → *Create Pull Request*.

Vercel crea automáticamente un **despliegue de preview** para esa rama (si el proyecto ya está conectado a GitHub). Así se prueba sin tocar producción.

## 3. Conectar la memoria (Storage en Vercel)

En el proyecto de Vercel → **Storage**:

1. **Create Database → Neon (Postgres)** → plan gratuito para empezar → *Connect* al proyecto, marcando Production, Preview y Development. Esto crea `DATABASE_URL`.
2. **Create → Blob** → *Connect* al proyecto. Esto crea `BLOB_STORE_ID` (la app se autentica con OIDC).

## 4. Variables de entorno

Vercel → Settings → **Environment Variables** (Production y Preview):

| Variable | Valor | Obligatoria |
|---|---|---|
| `ANTHROPIC_API_KEY` | Tu clave de console.anthropic.com | Sí |
| `SESSION_SECRET` | Texto aleatorio largo (64+ caracteres) | Sí |
| `ACCESS_CODE` | Código para el equipo | Sí |
| `ADMIN_CODE` | Código solo para administración | Sí |
| `DATABASE_URL` | La crea Neon | Sí (memoria) |
| `BLOB_STORE_ID` | La crea Blob | Sí (capturas y Excel) |
| `BROWSERBASE_API_KEY` | browserbase.com → Settings | Para revisión en vivo |
| `BROWSERBASE_CONTEXT_ID` | Se genera en `/admin` | Para revisión en vivo |
| `ALLOWED_EMAIL_DOMAINS` | p. ej. `salsagrowth.la` | Recomendada |
| `ANTHROPIC_MODEL`, `AGENT_EFFORT`, `WEB_TOOLS`, `REFUSAL_FALLBACK`, límites | Ver `.env.example` | Opcionales |

Después de cambiar variables: **Deployments → … → Redeploy**.

## 5. Preparar desde /admin

1. Abrir `https://<tu-preview>.vercel.app/admin` y entrar con `ADMIN_CODE`.
2. **Estado**: todo en verde salvo lo opcional.
3. **Preparar / actualizar base de datos** (o `npm run db:setup` desde la terminal): crea las tablas, el proyecto `longevidad-2026` con su resumen y las plataformas Axo, Lucis y Zentum.
4. **Sesiones del navegador**: si falta `BROWSERBASE_CONTEXT_ID`, *Crear espacio de sesión* → pegarlo en Vercel → Redeploy → *Abrir navegador* → iniciar sesión en cada plataforma → *Guardar sesión* → *Revisar sesiones*.
5. **Correr evals**: deberían aprobar al menos 10 de 12 (ver [07](07-calidad-y-evals.md)).

## 6. Lista de verificación antes de producción

- [ ] `npm run build` sin errores (o el despliegue de preview en verde).
- [ ] Entrar al chat con correo y código; salir y volver a entrar: el historial sigue ahí.
- [ ] Abrir el chat en otro navegador con el mismo correo: aparece el mismo historial.
- [ ] Pregunta de conocimiento ("¿Quién gana en pagos?") responde con datos y fecha.
- [ ] Pregunta pública ("¿Qué dice la web de Zentum sobre sus planes?") cita la fuente.
- [ ] "Agrega <sitio público> y revisa su home con capturas" → registra la plataforma, entrega Excel.
- [ ] Revisión en vivo de una plataforma con sesión → Excel descargable; en Neon aparecen filas en `findings` y `captures`.
- [ ] "Arma el consolidado con lo guardado" → Excel con varias plataformas.
- [ ] "Recuerda que…" → aparece un archivo en `memories`; en un chat nuevo el agente lo usa.
- [ ] `/admin` muestra uso y costos del período.
- [ ] Evals ≥ 10/12.

## 7. Pasar a producción

Aprobar y hacer *merge* del Pull Request a `main`. Vercel despliega a producción.

**Volver atrás** si algo falla: Vercel → Deployments → elegir el despliegue anterior → **Promote to Production** (Instant Rollback). La base de datos no se toca: las tablas nuevas no afectan a la versión anterior.
