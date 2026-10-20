#!/usr/bin/env bash
# Deploy de financeos-app a producción — build + deploy + los DOS alias
# (app.moyiq.app y demo.moyiq.app) + smoke test. Aliasear solo uno deja al
# otro sirviendo la versión vieja indefinidamente y sin ningún aviso.
# Desde el 20-oct-2026 el dominio anterior de FinanceOS ya no está conectado
# (decisión de Walter): no se aliasea ni se verifica.
set -euo pipefail
cd "$(dirname "$0")"

# ── Guard de despliegue (auditoría 360, C-06: OPS-5 / GOB-5 / ING-2) ──────────
# `vercel deploy` sube el árbol de trabajo tal como está. El 18-oct-2026 otra
# sesión dejó este árbol en `security/cloudsync-encryption-guard` (sin mergear)
# y un deploy publicó esa rama en producción. Para que producción nunca salga
# de algo que no está en git (y se pueda revertir con git), antes de cualquier
# paso se exige: rama `main`, cero cambios RASTREADOS sin commitear (los
# archivos no rastreados no cuentan) y HEAD igual a origin/main tras un fetch
# (ni atrás ni adelante). `./deploy.sh --check` corre solo esta verificación.
guard_abort() {
  {
    echo "ERROR: deploy abortado, no se tocó nada."
    printf '%s\n' "$@"
    echo "Regla completa: CLAUDE.md, sección 'Sesiones paralelas y despliegue'."
  } >&2
  exit 1
}

deploy_guard() {
  local branch head origin_head ahead behind

  branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) \
    || guard_abort "No se pudo leer la rama de git: ¿esto es un repo con commits?"
  if [[ "$branch" == "HEAD" ]]; then
    guard_abort "HEAD está desacoplado (sin rama)." \
      "Un deploy a producción sale solo de 'main'. Vuelve con: git switch main"
  elif [[ "$branch" != "main" ]]; then
    guard_abort "La rama actual es '$branch', no 'main'." \
      "Un deploy a producción sale solo de 'main' (integra con fast-forward y haz push antes)." \
      "Si otra sesión usa este árbol, no le cambies la rama: trabaja en un worktree propio."
  fi

  if ! git diff --quiet HEAD --; then
    guard_abort "Hay cambios sin commitear en archivos rastreados:" \
      "$(git status --porcelain --untracked-files=no | head -10)" \
      "Commitéalos o descártalos (git restore / git stash) y vuelve a correr. Los archivos no rastreados no cuentan."
  fi

  if ! git fetch --quiet origin '+refs/heads/main:refs/remotes/origin/main'; then
    guard_abort "No se pudo hacer git fetch de origin/main (¿sin red o sin permisos?)." \
      "Sin poder comparar contra origin/main no se despliega."
  fi
  head=$(git rev-parse HEAD)
  origin_head=$(git rev-parse origin/main)
  if [[ "$head" != "$origin_head" ]]; then
    read -r ahead behind < <(git rev-list --left-right --count HEAD...origin/main)
    if [[ "$behind" -eq 0 ]]; then
      guard_abort "main tiene $ahead commit(s) que no están en origin/main." \
        "Producción debe salir de lo que está en origin/main: git push origin main, y vuelve a correr."
    elif [[ "$ahead" -eq 0 ]]; then
      guard_abort "main está $behind commit(s) atrás de origin/main." \
        "Actualiza con: git pull --ff-only origin main, y vuelve a correr."
    else
      guard_abort "main y origin/main divergieron ($ahead commit(s) locales, $behind remotos)." \
        "Resuelve la divergencia (merge o rebase) antes de desplegar."
    fi
  fi
  echo "==> Guard OK: rama main, sin cambios rastreados sin commitear, igual a origin/main (${head:0:7})"
}

case "${1:-}" in
  "") ;;
  --check) deploy_guard; exit 0 ;;
  *) echo "uso: ./deploy.sh [--check]   (--check solo verifica el guard, no despliega)" >&2; exit 2 ;;
esac
deploy_guard

echo "==> Tests"
npm test

echo "==> Build local (gate previo — Vercel hace su propio build en su infra,"
echo "    esto solo evita gastar un deploy si el build está roto)"
npm run build

echo "==> Deploy a producción"
# Con el plugin de Vercel para Claude Code activo, `vercel deploy` devuelve un
# JSON estructurado en vez de la URL en texto plano que documenta el CLI
# stock (ver commit 2026-09-06: el primer intento le pasó ese JSON entero
# como "URL" a `vercel alias` y falló). Se soporta ambos formatos: si no
# parsea como JSON, se asume que ya es la URL plana.
RAW=$(npx vercel deploy --prod --yes)
if URL=$(echo "$RAW" | jq -er '.deployment.url' 2>/dev/null); then
  :
else
  URL="$RAW"
fi
if [[ -z "$URL" ]]; then
  echo "ERROR: no se pudo extraer la URL del deployment de: $RAW" >&2
  exit 1
fi
echo "    Deployado: $URL"

echo "==> Aliaseando los dos dominios (app. y demo. de moyiq.app)"
npx vercel alias "$URL" app.moyiq.app
npx vercel alias "$URL" demo.moyiq.app

echo "==> Smoke test — contenido real, no solo status (el rewrite catch-all de"
echo "    vercel.json devuelve 200 para CUALQUIER ruta bajo /app/, incluida una"
echo "    que no existe — un 200 solo no prueba que sirva el deploy correcto)."
for domain in app.moyiq.app demo.moyiq.app; do
  status=$(curl -sL -o /dev/null -w "%{http_code}" "https://$domain/app/")
  if [[ "$status" != "200" ]]; then
    echo "ERROR: https://$domain/app/ devolvió $status tras seguir redirects, no 200" >&2
    exit 1
  fi
  fonts_css=$(curl -sL "https://$domain/app/fonts.css")
  if [[ "$fonts_css" != *"@font-face"* ]]; then
    echo "ERROR: https://$domain/app/fonts.css no es el CSS real (¿cayó en el rewrite catch-all → alias apunta al deploy viejo?)" >&2
    exit 1
  fi
  echo "    https://$domain/app/ → 200 OK, fonts.css real"
done

echo "==> Deploy completo y verificado en los dos dominios."
