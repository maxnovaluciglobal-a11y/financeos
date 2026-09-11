#!/usr/bin/env bash
# Deploy de financeos-app a producción — build + deploy + los CUATRO alias +
# smoke test (app./demo. × financeospro.com/moyiq.app, moyiq.app primario
# desde 11-sep-2026). Aliasear solo alguno de los cuatro (fácil de olvidar)
# deja al resto sirviendo la versión vieja indefinidamente y sin ningún aviso
# (ver PLAN_REMEDIACION_TECNICA_CARLOS_FINANCEOS.md, punto 7).
set -euo pipefail
cd "$(dirname "$0")"

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

echo "==> Aliaseando los cuatro dominios (moyiq.app es el primario desde 11-sep,"
echo "    financeospro.com sigue vivo — aliasear solo dos de los cuatro deja a"
echo "    los otros dos sirviendo la versión vieja indefinidamente, mismo riesgo"
echo "    documentado arriba para el par financeospro.com)"
npx vercel alias "$URL" app.financeospro.com
npx vercel alias "$URL" demo.financeospro.com
npx vercel alias "$URL" app.moyiq.app
npx vercel alias "$URL" demo.moyiq.app

echo "==> Smoke test — contenido real, no solo status (el rewrite catch-all de"
echo "    vercel.json devuelve 200 para CUALQUIER ruta bajo /app/, incluida una"
echo "    que no existe — un 200 solo no prueba que sirva el deploy correcto)."
echo "    app.financeospro.com/demo.financeospro.com redirigen (308) a su"
echo "    equivalente moyiq.app desde el 11-sep (decommission de FinanceOS) —"
echo "    -L sigue el redirect y valida el contenido final, no el código del salto."
for domain in app.financeospro.com demo.financeospro.com app.moyiq.app demo.moyiq.app; do
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
  echo "    https://$domain/app/ → 200 OK (siguiendo redirect si aplica), fonts.css real"
done

echo "==> Deploy completo y verificado en los cuatro dominios."
