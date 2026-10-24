#!/usr/bin/env bash
# Bootstrap del agente en Vercel, todo desde el repo. Se puede correr varias veces: lo que ya existe se salta.
#   npm run bootstrap
# Hace: login → vincular proyecto → Neon (Postgres) → Blob → secretos → .env.local → migraciones + seed → doctor.
set -euo pipefail
cd "$(dirname "$0")/.."

VERCEL="npx --no-install vercel"
DB_NAME="${DB_NAME:-salsa-ux-db}"
BLOB_NAME="${BLOB_NAME:-salsa-ux-files}"

step() { printf "\n\033[1m▸ %s\033[0m\n" "$1"; }
has_local() { [ -f .env.local ] && grep -Eq "^$1=\"?[^\"]+" .env.local; }
has_remote() { $VERCEL env ls production 2>/dev/null | grep -Eq "(^|[[:space:]])$1([[:space:]]|$)"; }

step "Requisitos"
node -e 'const [M,m]=process.versions.node.split(".").map(Number); if (M<22) { console.error("Necesitas Node 22 o superior (tienes "+process.versions.node+")"); process.exit(1) }'
[ -d node_modules ] || npm install

step "Sesión en Vercel"
$VERCEL whoami >/dev/null 2>&1 || $VERCEL login
echo "Conectada como: $($VERCEL whoami)"

step "Proyecto"
[ -f .vercel/project.json ] || $VERCEL link
$VERCEL env pull .env.local --yes >/dev/null

step "Base de datos (Neon Postgres)"
if has_local DATABASE_URL; then echo "Ya existe DATABASE_URL."; else
  echo "Se creará la base '$DB_NAME' en Neon y se conectará a production, preview y development."
  $VERCEL integration add neon --name "$DB_NAME"
fi

step "Archivos (Vercel Blob)"
if has_local BLOB_STORE_ID || has_local BLOB_READ_WRITE_TOKEN; then echo "Ya hay un store de Blob conectado."; else
  $VERCEL blob create-store "$BLOB_NAME" --access public --yes
fi

step "Secretos"
# production y preview: secretos (no se pueden leer después). development: config, para que env pull los traiga.
add_secret() {
  local name="$1" value="$2"
  printf '%s' "$value" | $VERCEL env add "$name" production --sensitive --yes >/dev/null
  printf '%s' "$value" | $VERCEL env add "$name" preview --sensitive --yes >/dev/null
  printf '%s' "$value" | $VERCEL env add "$name" development --no-sensitive --yes >/dev/null
  echo "✓ $name cargada en production, preview y development"
}
ask_secret() {
  local name="$1" prompt="$2" value=""
  if has_remote "$name"; then echo "Ya existe $name."; return; fi
  read -r -s -p "$prompt: " value; echo
  [ -n "$value" ] || { echo "✗ $name vacía; vuelve a correr el bootstrap."; exit 1; }
  add_secret "$name" "$value"
}
ask_secret ANTHROPIC_API_KEY "Clave de Anthropic (sk-ant-...)"
ask_secret ACCESS_CODE "Código de acceso para el equipo"
ask_secret ADMIN_CODE "Código de administración (solo tú)"
if has_remote SESSION_SECRET; then echo "Ya existe SESSION_SECRET."; else add_secret SESSION_SECRET "$(openssl rand -base64 48 | tr -d '\n')"; fi

step "Variables locales (.env.local)"
$VERCEL env pull .env.local --yes

step "Migraciones y datos iniciales"
npm run --silent db:setup

step "Verificación"
npm run --silent doctor || true

cat <<'EOF'

Listo. Siguientes pasos:
  npm run dev                 probar en local (http://localhost:3000)
  npm run deploy:preview      desplegar una versión de prueba
  npm run deploy:prod         desplegar a producción
Para la revisión en vivo (opcional): BROWSERBASE_API_KEY y BROWSERBASE_CONTEXT_ID, ver docs/10.
EOF
