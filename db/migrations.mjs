// Migraciones de la base (Neon Postgres). Cada una se aplica UNA vez, en orden, dentro de una transacción,
// y queda registrada en la tabla schema_migrations. Reglas:
// - Nunca edites una migración ya aplicada en producción: agrega una nueva al final (0002_..., 0003_...).
// - Una sentencia SQL por elemento del arreglo (el driver HTTP de Neon no acepta varias en una).
// - gen_random_uuid() viene incluido en Postgres 13+ (Neon usa 16/17): no hace falta pgcrypto.
export const MIGRATIONS = [
  {
    id: "0001",
    name: "core: personas, proyectos, plataformas, conversaciones, hallazgos, memoria, métricas, evals",
    statements: [
      // Personas del equipo (se identifican con su correo en la pantalla de acceso).
      `CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text UNIQUE NOT NULL,
        name text,
        role text NOT NULL DEFAULT 'member',
        created_at timestamptz NOT NULL DEFAULT now()
      )`,

      // Un proyecto = un estudio de benchmark para un cliente (p. ej. "Longevidad 2026").
      `CREATE TABLE IF NOT EXISTS projects (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        slug text UNIQUE NOT NULL,
        name text NOT NULL,
        client text,
        sector text,
        brief text,
        created_at timestamptz NOT NULL DEFAULT now()
      )`,

      // Plataformas que el agente puede revisar. dominios = lista blanca de navegación.
      `CREATE TABLE IF NOT EXISTS platforms (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        slug text UNIQUE NOT NULL,
        name text NOT NULL,
        domains jsonb NOT NULL DEFAULT '[]',
        app_url text,
        web_url text,
        requires_login boolean NOT NULL DEFAULT false,
        notes text,
        active boolean NOT NULL DEFAULT true,
        created_by text,
        created_at timestamptz NOT NULL DEFAULT now()
      )`,
      `CREATE TABLE IF NOT EXISTS project_platforms (
        project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
        platform_id uuid REFERENCES platforms(id) ON DELETE CASCADE,
        PRIMARY KEY (project_id, platform_id)
      )`,

      // Conversaciones y mensajes (solo texto; las imágenes adjuntas no se guardan).
      `CREATE TABLE IF NOT EXISTS conversations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid REFERENCES users(id) ON DELETE CASCADE,
        project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
        title text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`,
      `CREATE INDEX IF NOT EXISTS conversations_user_idx ON conversations(user_id, updated_at DESC)`,
      `CREATE TABLE IF NOT EXISTS messages (
        id bigserial PRIMARY KEY,
        conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
        role text NOT NULL,
        text text NOT NULL DEFAULT '',
        meta jsonb NOT NULL DEFAULT '{}',
        created_at timestamptz NOT NULL DEFAULT now()
      )`,
      `CREATE INDEX IF NOT EXISTS messages_conv_idx ON messages(conversation_id, id)`,

      // Cada respuesta del agente = una ejecución (observabilidad, costos y límites de uso).
      `CREATE TABLE IF NOT EXISTS runs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
        user_id uuid REFERENCES users(id) ON DELETE SET NULL,
        project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
        kind text NOT NULL DEFAULT 'chat',
        model text,
        status text NOT NULL DEFAULT 'running',
        input_tokens int DEFAULT 0,
        output_tokens int DEFAULT 0,
        cache_read_tokens int DEFAULT 0,
        cache_write_tokens int DEFAULT 0,
        tool_calls jsonb NOT NULL DEFAULT '{}',
        duration_ms int,
        error text,
        created_at timestamptz NOT NULL DEFAULT now()
      )`,
      `CREATE INDEX IF NOT EXISTS runs_user_idx ON runs(user_id, created_at DESC)`,

      // Capturas tomadas en revisiones en vivo (la imagen vive en Vercel Blob).
      `CREATE TABLE IF NOT EXISTS captures (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        run_id uuid REFERENCES runs(id) ON DELETE SET NULL,
        project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
        platform_slug text NOT NULL,
        journey text,
        step text,
        url text,
        blob_url text,
        observation text,
        created_at timestamptz NOT NULL DEFAULT now()
      )`,

      // Hallazgos estructurados: la "memoria de conocimiento" del benchmark.
      `CREATE TABLE IF NOT EXISTS findings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
        platform_slug text NOT NULL,
        journey text NOT NULL,
        step text,
        capture_id uuid REFERENCES captures(id) ON DELETE SET NULL,
        user_action text,
        sees text,
        key_text text,
        clicks numeric,
        scores jsonb NOT NULL DEFAULT '{}',
        friction text,
        severity text,
        writing_finding text,
        emotion text,
        recommendation text,
        source text NOT NULL DEFAULT 'live',
        run_id uuid REFERENCES runs(id) ON DELETE SET NULL,
        valid boolean NOT NULL DEFAULT true,
        observed_at timestamptz NOT NULL DEFAULT now()
      )`,
      `CREATE INDEX IF NOT EXISTS findings_lookup_idx ON findings(project_id, platform_slug, journey) WHERE valid`,

      // Entregables generados (Excel). El archivo vive en Vercel Blob.
      `CREATE TABLE IF NOT EXISTS deliverables (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        run_id uuid REFERENCES runs(id) ON DELETE SET NULL,
        project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
        kind text NOT NULL DEFAULT 'xlsx',
        name text,
        blob_url text,
        created_at timestamptz NOT NULL DEFAULT now()
      )`,

      // Memoria de largo plazo del agente (herramienta "memory" de Claude): archivos de texto por ruta.
      `CREATE TABLE IF NOT EXISTS memories (
        path text PRIMARY KEY,
        content text NOT NULL DEFAULT '',
        updated_by text,
        updated_at timestamptz NOT NULL DEFAULT now()
      )`,

      // Resultados de las evaluaciones de calidad (evals) que se corren desde /admin.
      `CREATE TABLE IF NOT EXISTS eval_results (
        id bigserial PRIMARY KEY,
        batch text NOT NULL,
        case_id text NOT NULL,
        passed boolean NOT NULL,
        score numeric,
        answer text,
        judge text,
        model text,
        created_at timestamptz NOT NULL DEFAULT now()
      )`,
    ],
  },
  {
    id: "0002",
    name: "costos: costo en US$, minutos de navegador y búsquedas web por ejecución",
    statements: [
      `ALTER TABLE runs ADD COLUMN IF NOT EXISTS cost_usd numeric NOT NULL DEFAULT 0`,
      `ALTER TABLE runs ADD COLUMN IF NOT EXISTS browser_seconds int NOT NULL DEFAULT 0`,
      `ALTER TABLE runs ADD COLUMN IF NOT EXISTS web_searches int NOT NULL DEFAULT 0`,
      `CREATE INDEX IF NOT EXISTS runs_created_idx ON runs(created_at)`,
      // Resumen por mes y tipo (chat, live, eval): lo lee /admin y `npm run usage`.
      `CREATE OR REPLACE VIEW usage_monthly AS
        SELECT date_trunc('month', created_at)::date AS mes, kind, model, count(*)::int AS ejecuciones,
          sum(input_tokens)::bigint AS input_tokens, sum(output_tokens)::bigint AS output_tokens,
          sum(cache_read_tokens)::bigint AS cache_read_tokens, sum(web_searches)::int AS busquedas_web,
          round(sum(browser_seconds) / 60.0, 1) AS minutos_navegador, round(sum(cost_usd), 4) AS costo_usd
        FROM runs GROUP BY 1, 2, 3`,
    ],
  },
];
