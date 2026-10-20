# Deploy de MOY IQ (financeos-app)

Esta guía reemplaza a la de FinanceOS v1.5 (junio de 2026), que describía un deploy manual en Vercel o Netlify sin backend. Lo que sigue se verificó contra el repo y contra producción el 19-oct-2026; el detalle y las reglas completas están en `CLAUDE.md`, secciones "Deploy" y "Sesiones paralelas y despliegue".

## Dónde corre

- Vercel, team `maxnovaluci-global`, proyecto `financeos-app`, enlazado al repo `maxnovaluciglobal-a11y/financeos` con `main` como rama de producción.
- Dominios: `app.moyiq.app` y `demo.moyiq.app` (los únicos; el dominio anterior de FinanceOS se desconectó el 20-oct-2026).
- Supabase `nelwgbcddwiaimzbcuas` (`financeos-prod`): base de datos y Edge Functions, compartido con Invest.
- Netlify no forma parte de la infraestructura actual (ver el `CLAUDE.md` de `01 - Maxnova Luci Global/`); `netlify.toml` es un resto de la guía vieja.

## Front (la PWA)

1. Trabajar en un worktree propio y correr `npm test` completo.
2. Tomar el candado: `mkdir /private/tmp/claude-501/moyiq-locks/financeos-app.lock` (soltarlo con `rmdir` al terminar).
3. Integrar con `git merge --ff-only` a `main` y `git push origin main`. El push ya dispara un deploy de producción por la integración git de Vercel.
4. `./deploy.sh` desde el árbol principal. Antes de cualquier paso verifica que la rama sea `main`, que no haya cambios rastreados sin commitear y que `HEAD` sea igual a `origin/main`; después corre tests y build, publica con la CLI, aliasea los dos dominios y hace un smoke test con `curl`. `./deploy.sh --check` solo corre la verificación.

## Edge Functions

No pasan por `deploy.sh`. Desde el árbol principal en `main`, con el mismo candado, una a una:

```bash
supabase functions deploy <funcion> --project-ref nelwgbcddwiaimzbcuas --no-verify-jwt
```

La bandera `--no-verify-jwt` va en todas menos en `send-push`, que verifica JWT. `supabase/config.toml` fija `verify_jwt` por función. No correr `supabase config push`. Correr el CLI desde la raíz del repo o con `--workdir`, nunca con el cwd en `supabase/functions/`.

## Migraciones

Van en `supabase/migrations/`, aditivas e idempotentes. Antes: `supabase db push --dry-run`. Después: verificar con un `SELECT`. Ver `supabase/migrations/README.md`.

## Verificar en producción

```bash
for d in app.moyiq.app demo.moyiq.app; do curl -sL -o /dev/null -w "$d %{http_code}\n" "https://$d/app/"; done
curl -sL https://app.moyiq.app/app/fonts.css | head -c 200   # tiene que ser CSS real (@font-face), no el index.html del rewrite
```

El rewrite de `vercel.json` devuelve 200 para cualquier ruta bajo `/app/`: un 200 solo no prueba que sirva el deploy correcto, hay que mirar el contenido. Después de un deploy, el service worker cachea: para ver el cambio en un navegador hay que desregistrarlo y recargar.

## Volver atrás

Revertir con git (`git revert <commit>` en un worktree, integrar y `./deploy.sh`). Para un corte rápido, apuntar los dos dominios al deployment anterior con los mismos comandos que usa `deploy.sh` (`npx vercel alias <url-del-deployment-anterior> <dominio>`, uno por dominio); la URL anterior es la penúltima fila con entorno Production de `npx vercel ls financeos-app --scope maxnovaluci-global`. Ojo: un push posterior a `main` vuelve a publicar lo nuevo.
