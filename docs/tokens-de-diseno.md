# Tokens de diseño (BRD-4 / BRD-10, 20-oct-2026)

## Dónde viven

- **`src/styles/tokens.css`**: único origen de la paleta (claro y oscuro), tipografía, radios, espaciado, sombras y movimiento. `globals.css` lo importa en su primera línea y no define colores propios.
- **`src/styles/tokens.js`**: los mismos hex para lo que no lee CSS (PDF de react-pdf vía `src/pages/pdfTheme.js`).
- **`src/styles/tokens.test.js`** (corre con `npm test`) falla si:
  1. `tokens.js` y `tokens.css` dejan de coincidir;
  2. `globals.css` define un color;
  3. aparece en `src/` un hex que no es de la paleta (excepción con motivo: los colores del logo de Google en `AuthGate.jsx`; blanco puro `#FFF` permitido).
- Correos de las Edge Functions: `supabase/functions/_shared/emailLayout.ts` (`EMAIL_BRAND`, mismos valores; Deno no puede importar `src/`).
- PDF: `src/pages/pdfTheme.js` (fuentes TTF en `public/fonts/pdf/`, licencia SIL OFL 1.1 de IBM Plex e Instrument Sans).

## Cómo replicarlos en la landing e Invest (no se tocaron en esta tanda)

1. Copiar `src/styles/tokens.css` tal cual al repo destino (p. ej. `financeos-landing/css/tokens.css`, `invest-web/src/styles/tokens.css`) e importarlo antes de cualquier hoja que use `var(--…)`.
2. Borrar del repo destino las definiciones duplicadas de esas variables (`--navy`, `--laton`, `--papel`…): si quedan, la última gana y vuelve la deriva.
3. Copiar `src/styles/tokens.test.js` adaptando `SRC` al árbol del repo, para que un hex nuevo fuera de la paleta rompa su CI.
4. Ante un cambio de color: editar `tokens.css` + `tokens.js` aquí, correr `npm test`, y volver a copiar a los otros repos (y a `EMAIL_BRAND` en `emailLayout.ts` y `moyiq-newsletter-proxy/lib/brand.js` si cambia un color de correo).

Un script que copie el archivo en el build de cada repo (origen único en `financeos-workspace`) queda como mejora: hoy los tres repos se despliegan por separado y `financeos-workspace/branding/` tiene cambios sin commitear que no son de esta tanda.
