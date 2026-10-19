# MOY IQ (ex FinanceOS) — app

PWA de finanzas personales (React 18 + Vite + IndexedDB). Los datos financieros se guardan en el dispositivo; Supabase guarda cuentas, licencias y leads.

- App: https://app.moyiq.app/app/
- Demo: https://demo.moyiq.app/app/?demo=true
- Landing: https://moyiq.app
- Soporte: support@moyiq.app

El producto se llamó FinanceOS hasta septiembre de 2026: el repo (`financeos`), la carpeta y algunos nombres internos lo conservan a propósito.

## Para trabajar en el repo

`CLAUDE.md` tiene las reglas vigentes: deploy, sesiones paralelas, i18n, Supabase y Edge Functions.

```bash
npm install
npm run dev      # http://localhost:5173/app/
npm test         # vitest
npm run build    # dist/index.html (redirect a la landing) + dist/app/ (la app)
```

## Deploy

Producción sale de `main`, con `./deploy.sh` desde el árbol principal limpio y al día con `origin/main` (el script lo verifica antes de hacer nada). Las Edge Functions se despliegan aparte. Detalle en `DEPLOY.md`.

## Datos locales

Los datos viven en el navegador del usuario. Sin un respaldo previo no se pueden recuperar, ni por el usuario ni por MAXNOVA & LUCI Global LLC. Ajustes permite exportar un respaldo JSON.

© 2026 MAXNOVA & LUCI Global LLC · Desarrollado por Walter La Madriz
