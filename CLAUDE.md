# FinanceOS — App

PWA de finanzas personales. React 18 + Vite + IndexedDB. **Privacy-first: los datos viven en el dispositivo**, no hay backend que los lea. Supabase se usa solo para licencias y para sincronizar *blobs ya cifrados en el cliente*.

```bash
npm run dev      # vite
npm run build    # node build.js -> dist/index.html (redirect) + dist/app/ (la app real)
npm test         # vitest run — src/**/*.test.js y api/**/*.test.js (desde 2026-08-22, ver abajo)
```

**El build produce dos cosas.** `dist/index.html` es solo un redirect a la landing; la app de verdad está en `dist/app/index.html`. Para verificar algo del `<head>` (fuentes, meta), mirar **`dist/app/index.html`**, no el de la raíz.

## Deploy

Push a git **no** actualiza el dominio.

**`./deploy.sh`** (desde 2026-09-06): tests + build local (gate) + deploy + los DOS alias + smoke test de `curl` a `/app/` en ambos dominios. Aborta si algo falla en cualquier paso — no llega a aliasear con una build rota. Es el camino recomendado; reemplaza la secuencia manual de abajo.

Manual, si hace falta un paso suelto:

```bash
npx vercel --prod --yes
```

Con la URL que devuelve, aliasear **los dos** dominios:

```bash
npx vercel alias <url-nueva> app.financeospro.com
```

Y repetir con `demo.financeospro.com`. Si solo se aliasea uno, el otro se queda en la versión vieja.

El navegador integrado tiene bloqueado `*.financeospro.com` por política: verificar producción con `curl` por contenido, o en `localhost` con el servidor de desarrollo.

## Reglas que no son negociables

**Paridad i18n.** `src/i18n/translations.js` tiene `es`, `en`, `pt` y `de` (1161 claves por idioma al 2026-08-14). Toda clave nueva va en los CUATRO. Una clave que falta no rompe el build pero cae al fallback español (ver `useT.js`) — el usuario alemán ve una isla en su UI. Antes de escribir el texto de una clave nueva, ver `../branding/voz-de-producto.md` — nunca exclamaciones/emoji de entusiasmo fabricado, nunca personificar la app, y los 4 idiomas tienen que sonar igual de secos entre sí, no solo decir lo mismo.

**Migraciones de IndexedDB en `src/core/db/migrations.js`** (desde 2026-09-05). `DB_VERSION` ya no es una constante manual — se deriva de `Math.max(...MIGRATIONS.map(m => m.version))`, así que agregar un paso a `MIGRATIONS` bumpea la versión solo. Para cambiar la forma de datos ya guardados (no solo agregar un store), agregar un paso NUEVO al array con `migrate(db, transaction, oldVersion)`: `transaction` cubre todos los stores y sirve para leer/transformar registros existentes (ver el ejemplo de "Data migration during upgrade" en la doc de `idb`). Nunca editar un paso ya shippeado — quien ya pasó por esa versión no la vuelve a correr. `migrations.test.js` prueba el motor con fake-indexeddb, incluyendo que un paso que falla a mitad de camino aborta atómicamente (la base queda en `oldVersion`, sin datos a medio migrar) — correr ese archivo antes de tocar esto.

**Nada de datos financieros al servidor sin cifrar.** El sync empuja blobs cifrados con AES-GCM en el cliente. El servidor nunca ve montos ni categorías.

**Al importar movimientos hay que refrescar el modelo.** `dbAdd` solo escribe en IndexedDB; sin `rehydrate()` los datos no aparecen hasta recargar. Y sin `markLocalChange()` no suben a la nube. Ver `src/pages/Import/index.jsx`.

## Supabase

Siete `.sql` en la raíz. **`supabase-e2e-hardening.sql` es la fuente de verdad** de `sync_push`, `sync_pull` y `validate_license`: define `fnos_resolve_hash`, que acepta tanto la clave cruda como el hash de 64 caracteres. `supabase-license-email.sql` y `supabase-license-revoke.sql` también dependen de `fnos_resolve_hash` — **cualquier archivo que toque `licenses` tiene que pasar por esa función**, nunca hashear `p_key` directo con `digest()`.

Ya pasó una vez: volver a correr `supabase-sync.sql` **pisó** esa versión buena y reintrodujo un doble hash (`sha256(sha256(key))`), con lo que `validate_license` aceptaba una licencia que `sync_push` rechazaba con `invalid_license`. Si el sync falla para una licencia que valida bien, es esto. Correr `supabase-e2e-hardening.sql`.

**Antes de "arreglar" un .sql viejo, verificar contra producción.** El 2026-08-22 se encontró `supabase-license-email.sql` desactualizado en el repo respecto de la función real corriendo en Supabase (alguien la había parcheado a mano en el SQL Editor, sin actualizar el archivo). Verificar primero con `supabase db query --linked "select pg_get_functiondef(oid) from pg_proc where proname='...'"` — si production ya está bien, el fix es reescribir el archivo para que coincida, no pisar production con una reconstrucción propia.

`supabase-license-revoke.sql` (2026-08-22): agrega `payment_intent_id` a `licenses` + `revoke_license()`, llamada desde `supabase/functions/stripe-webhook/index.ts` en `charge.refunded`/`charge.dispute.created`. Licencias emitidas antes de esa fecha tienen `payment_intent_id` NULL — un reembolso de una compra vieja no se revoca solo. **`revoke_license()` no borra ninguna fila ni dato personal — solo cambia `status` a `'revoked'`** (verificado con `pg_get_functiondef`, 2026-08-27). El email y la licencia quedan en la base indefinidamente; no hay ningún job de retención/purga. Si en algún momento hace falta borrado real (pedido de un usuario, GDPR), es una decisión de Walter, no algo que se implementó a criterio propio.

**Migraciones nuevas van en `supabase/migrations/`, no como archivo suelto en la raíz** (desde 2026-08-27, ver `supabase/migrations/README.md`). Los 7 `.sql` de la raíz siguen siendo la fuente de verdad del estado histórico — no se tocan.

## Sistema visual — rebranding MOY IQ (rama `rebrand/moy-iq`, NO desplegado)

**Estado (2026-09-10): sistema nuevo aplicado en `main` de esta rama, NO mergeado a producción.** El nombre "MOY IQ" no tiene búsqueda de marca paga confirmada — vive en código/copy pero no se despliega ni se anuncia externamente hasta que Walter lo autorice. Ver PR del rebrand para el detalle completo de qué se tocó y qué quedó abierto.

Tokens en `src/styles/globals.css`.

**Paleta** — Navy (`--navy`, primario/estructura: nav activo, `--grn`, logo), Latón (`--laton`, acento: CTAs, aguja del dial, placa "IQ" — SIEMPRE con texto Navy encima, nunca oscurecer el fill en hover, agregar anillo interior Navy 25% en su lugar), Papel (`--papel`/`--sur`, superficie clara), Verde (`--verde` / `--pos`, único positivo/éxito — reemplaza al viejo `--accent` teal), Ceniza (neutro secundario). Reglas de accesibilidad ya aplicadas: `--laton-700`/`--warning-800`/`--info-800`/`--verde-800` son las variantes de TEXTO (la base falla AA en texto chico); `--accent-dark` es solo para datos/CTAs sobre fondo Navy (marketing/PDF), no se usa sobre Papel.

- **Display/wordmark: Instrument Sans** (`--display`) — estático (400/500/600/700 + italic 400), YA NO es variable como la vieja Archivo: el peso se controla con `font-weight`, no con `font-variation-settings` (los tokens `--vf-hero`/`--vf-head` se retiraron, no existen más). Reemplaza a Archivo — **diverge de `../financeos-landing`**, que sigue en Archivo hasta que se le aplique el mismo rebrand (pendiente, fuera del alcance de esta rama).
- **UI/body: IBM Plex Sans** (`--sans`), reemplaza a Instrument Sans en ese rol (Instrument Sans ahora es SOLO display).
- **Datos/mono: IBM Plex Mono** (`--mono`), reemplaza a JetBrains Mono.
- **`.num` para cifras** (lleva `tnum` + `font-variant-numeric: tabular-nums lining-nums`), `.num-hero` para la cifra protagonista.
- **Mono para datos, sans para lenguaje.** No usar `--mono` en prosa.
- Color por rol: `--grn` es marca/estructura (Navy) — `--pos` / `--neg` / `--warn` / `--info` son semánticos de dato (Verde/Error/Warning-800/Info-800). No mezclarlos. Los componentes compartidos (`ui.module.css`: badge/kpi/prog/alert "green" + `TxRow`) ya se corrigieron para usar `--pos` en vez de `--grn` donde el significado era "positivo", no "marca" — un green-semantic-audit completo del resto de la app (páginas individuales) queda pendiente, ver PR.
- **Radios chicos y técnicos a propósito** — `--r` 8px (botones), `--rl` 10px (cards), `--rxl` 12px (modales/destacadas), `--r-plate` 3px (placa "IQ" del wordmark). **Nunca pill/rounded-lg grande** — el `.badge` de `ui.module.css` se corrigió de 20px (pill) a `var(--rs)`.
- **Logo**: `src/components/Logo.jsx` (`Logo`, `Wordmark`, `Monogram`) — geometría exacta del brand book, no reinventar. Favicon/app icons regenerados desde el monograma (`public/favicon.svg` = variante sin ticks para <16px; `apple-touch-icon.png`/`icon-192.png`/`icon-512.png` = variante con ticks, generados con `rsvg-convert` desde SVG fuente, no editar los PNG a mano).
- **Iconografía**: `src/components/icons/Icons.jsx` — 14 íconos del brand book + 3 construidos con la misma regla (arco 90°+tick+pivote) para conceptos de nav sin equivalente documentado (Ingresos/Propiedades/Modo Asesor). Mapeados 1:1 al nav rail (`Shell.jsx`, `NAV_ICONS`) — los emoji de bandera país (🇨🇱 etc.) NO son parte de este vocabulario, se mantienen. El resto de la app (dentro de cada página) sigue usando glifos unicode sueltos (✓, →, ⚠) sin migrar — fuera de alcance del rebrand.
- **Motion**: tokens `--dur-instrument-settle` (900ms, barrido del IQ Score), `--dur-value-update` (550ms), `--dur-surface-enter/exit` (220/150ms), `--dur-press` (80ms), `--dur-alert-pulse` (1200ms×2, definido pero sin un elemento "alerta urgente" real todavía enganchado — queda disponible para cuando exista). `CountUp.jsx` soporta `overshoot` (resorte con 2-3% de overshoot, usado en el IQ Score del Dashboard) y hace fade de 200ms en `prefers-reduced-motion: reduce` en vez de saltar sin transición.
- **IQ Score**: la feature real es `src/utils/financialScore.js` (`calcFinancialScore`) + la card de `Dashboard/index.jsx`. **Migrado (10-sep-2026) al modelo de 5 factores del brand book, con sus pesos exactos**: flujo de caja 30 / colchón de emergencia 20 / carga de deuda 20 / progreso de metas 15 / consistencia de datos 15 (antes eran 5 factores parejos de 20pts: tasa de ahorro/presupuestos/deuda/metas/suscripciones — ese modelo viejo ya no existe, ver historial git del archivo). Detalle de mapeo por factor: flujo de caja y progreso de metas reusan la señal de las viejas tasa de ahorro/metas, solo reescaladas; carga de deuda no cambió (ya era 20pts); colchón de emergencia y consistencia de datos son factores NUEVOS sin equivalente anterior — colchón reusa la misma detección de meta "por nombre" que ya usaba Coach/Advisor/Goals (`emergencyFundMonths`) con los mismos umbrales de `COACH_CONFIG`; consistencia de datos se construyó desde cero combinando % de movimientos categorizados (no caídos en el cajón `'Importado'` de `fileParser.js`) + antigüedad del último sync a la nube (`core/sync.js`, calculado en el call site de Dashboard para mantener `calcFinancialScore` pura/testeable) — sync desactivado (local-only, opt-in) da puntaje neutral, no penaliza. Tests nuevos en `financialScore.test.js` (no existían antes). Las 4 etiquetas de estado (`score.excellent/good/fair/critical`) siguen sin forzarse a las 3 del brand book (Bien/Atención/Riesgo) — eso sigue siendo una decisión de producto aparte, sin tocar. Ya aplicado desde antes: nombre "IQ Score", ícono dedicado (`IconIQScore`, único que reusa el arco de 270°), y motion (`overshoot` + 900ms).
- El nombre de marca se aplicó a: `index.html`, `vite.config.js` (manifest PWA), `config.js` (`app.name`, usado en el reporte white-label de Modo Asesor), `Shell.jsx`, `LicenseGate.jsx`, `DemoShell.jsx`, `Settings/index.jsx`, `push-sw.js`, `AppContext.jsx` (metadata de backup — **verificado que `validateBackupFile()` no compara ese string, así que no rompe compatibilidad con backups viejos**), PDFs de reporte, y `src/i18n/translations.js` (reemplazo global, los 4 idiomas). **Deliberadamente sin tocar**: `pages/legal/{Terms,Privacy,License,Disclaimer}.jsx` (texto contractual/marca registrada, requiere decisión legal — la licencia vigente de clientes reales sigue diciendo "FinanceOS"), comentarios de código (`// FinanceOS Fase N`, prefijos `[FinanceOS]` en `console.*`), y `financeos-landing` (repo aparte, fuera de alcance).

**Fuentes autohospedadas** (desde 2026-09-06, RGPD): antes se cargaban desde `fonts.googleapis.com`, lo que transmite la IP del visitante a Google — litigio real por esto en Alemania (LG München, 2022), mercado activo del producto. Ahora `public/fonts.css` + `public/fonts/*.woff2` (subsets latin + latin-ext, cubren es/en/pt/de). Si se agrega un peso o familia nueva, no volver a apuntar a Google: descargar el `.woff2` real (`curl` al CSS de `fonts.googleapis.com` con un User-Agent de navegador moderno da URLs `fonts.gstatic.com` con `format('woff2')`) y sumarlo a `fonts.css` + `public/fonts/`. `rsvg-convert` (librsvg, instalado vía `brew install librsvg` durante el rebrand) es necesario para regenerar los PNG de ícono desde SVG — **`magick`/`convert` de ImageMagick solo NO alcanza**, su delegate SVG interno (MSVG) no renderiza bien `stroke` heredado de un `<g>` y produce íconos con el bisel/arco invisibles.

**Gotcha de rutas con `base: '/app/'` en `index.html`:** escribir una ruta ya con el prefijo a mano (`/app/algo`) se duplica a `/app/app/algo` en `npm run dev` (Vite le antepone `base` de nuevo) — silencioso porque el recurso simplemente no carga y cae a un fallback invisible o a un 404 que nadie mira. La forma correcta es escribir la ruta SIN el prefijo (`/algo`) y dejar que Vite anteponga `base` una sola vez; funciona igual en dev y en build. `favicon.png`/`apple-touch-icon.png` (líneas 14-15) siguen con el prefijo a mano y por eso están rotos en `npm run dev` (no en producción — el build no vuelve a tocar esos `href` literales) — no se tocó porque cae fuera de esta tarea, pero es la próxima vez que alguien mire por qué el ícono de pestaña no aparece en dev.

## Archivos delicados

- `src/core/db/migrations.js` — `DB_VERSION` y los pasos de esquema versionados (fuente de verdad; `index.js` solo hace wiring)
- `src/utils/licenseValidator.js` — formato `FNOS-XXXX-XXXX-XXXX`
- `src/utils/taxCalcCL.js` — UTM de Chile hardcodeada, se queda vieja
- `src/utils/taxCalcDE.js` — Beitragsbemessungsgrenze DE + Grundfreibetrag hardcodeados
- `src/utils/apvCalc.js` — fórmula de valor futuro
- `src/utils/taxIdValidation.js` — checksums de ID fiscal (6 países), tiene tests en `taxIdValidation.test.js`
- `src/pages/Import/fileParser.js` — `GENERIC_WORDS` en `suggestCategory()`: sin esa lista de exclusión, palabras de cartola como "COMPRA"/"PAGO" generan falsos positivos en la sugerencia de categoría (bug real, atrapado por `fileParser.test.js` antes de llegar a producción)
- `supabase/functions/stripe-webhook/` — el branch de `checkout.session.completed` es lo único que emite licencias pagas. Desde 2026-09-05 la lógica vive en `webhookLogic.ts` (firma, guards, `planFromAmount`, llamadas a Supabase/Resend), con 37 tests vía vitest (`webhookLogic.test.ts`, fetch mockeado) — `index.ts` es solo wiring y NO se testea (lee `Deno.env.get()`, no importable desde Node). Correr `npm test` antes de deployar; un error acá rompe la entrega de licencias a clientes nuevos. `CHECKOUT_EVENT_TYPES` vive una sola vez en `webhookLogic.ts` — no volver a hardcodear la lista de eventos en `index.ts` (así se desincronizó una vez, ver auditoría 2026-09-01 más abajo)
- `docs/novedades.html` — histórico, preservar

## Testing (desde 2026-08-22)

`npm test` corre vitest sobre `src/**/*.test.js` y `api/**/*.test.js` (127 tests en 10 archivos al 2026-09-05). Antes del 2026-08-22 no había ningún test en el repo. `vitest.config.js` está separado de `vite.config.js` a propósito (no carga el plugin de React ni VitePWA, innecesario para funciones puras) y corre en `environment: 'node'`. Cobertura actual: `api/fixer.js` (cross-rate), `taxIdValidation.js` (6 países), `apvCalc.js`, `taxCalcCL.js`/`taxCalcDE.js` (regresión contra los cálculos reales), `fileParser.js` (dedup + sugerencia de categoría), `Subscriptions/generateAlerts` (suba de precio), `AppContext.jsx` (reducer, 36 tests por dominio), `core/db/migrations.js` (motor de migraciones de IndexedDB vía `fake-indexeddb`, ver sección de arriba). **No** cubre nada que toque DOM real ni las acciones async de `AppContext` (dependen de `document`/`Blob`/`FileReader`, fuera del alcance de este `environment: 'node'` a propósito).

## Historial: Plaid se probó y se retiró (2026-08-22)

El commit `205228d` (17-ago) agregó conectar banco vía Plaid (solo EEUU). Una auditoría (panel de 18 agentes) encontró que contradecía el DNA privacy-first documentado (desconectar no revocaba el token real en Plaid, los endpoints no exigían licencia) y que no generaba ningún uso en marketing. Se retiró por completo el 22-ago — código, endpoints, claves i18n. **No reintroducir sin releer la auditoría** (memoria `financeos_audit_plaid_valor_20260821`) — el trade-off contra "sin bank connections" sigue siendo el mismo si se reconsidera.

## Convenciones sensibles al no violar

**Checkbox: siempre con `style={{width:16, height:16, flexShrink:0}}`.** La regla global `input { width:100% }` en `globals.css` aplica también a checkboxes; sin este override el checkbox ocupa el ancho completo del contenedor flex y empuja el texto lejos. Ver `Debts/Income/Movements/Steuer`.

**Agregar un país nuevo requiere tocar SIETE lugares:**
1. `Onboarding.jsx` — array `COUNTRIES`
2. `Settings/index.jsx` — `<option>` hardcoded (~L82)
3. `Dashboard/CountryTool.jsx` — map `TOOL_BY_COUNTRY`
4. `layout/Shell.jsx` — entry con `countries: ['XX']`
5. `App.jsx` + `demo/DemoShell.jsx` — lazy import + case
6. Página `pages/<Tool>/index.jsx` — usando `useT()` para todos los textos
7. `i18n/translations.js` — claves en los 4 idiomas

**Agregar un idioma nuevo requiere:**
1. Bloque nuevo `<code>: { ... }` en `translations.js` con paridad completa
2. `SUPPORTED_LANGUAGES` al final del archivo
3. `<option>` en `Settings/index.jsx` (~L74)
4. `LANGUAGES` array en `Onboarding.jsx` (~L39)

**Textos hardcoded en JSX = bug.** Si escribís `<div>Título</div>`, el usuario que cambie idioma va a ver solo esa isla en español. Todo texto visible debe pasar por `useT()` con `t('key')`. Aplica también a `label`/`placeholder`/`title`/`aria-*`.

## Gotchas de deploy y verificación

- **Service worker cachea agresivamente**. Post-deploy, para verificar cambios: `navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()))` + `caches.keys().then(ks => ks.forEach(k => caches.delete(k)))` + hard reload.
- **`~/Documents/.claude/launch.json`** es la config raíz de preview servers (fuera del repo). Si la ruta canónica del repo cambia, ese archivo también.

## Android (TWA, 2026-08-22)

Empaquetado con PWABuilder (Bubblewrap por debajo) a partir del manifest de producción, sin tocar código de la app — la PWA existente es el input. Paquete generado en `../android-twa/package/` (fuera de git, sibling de este repo): `FinanceOS.aab` (subir a Play Console), `FinanceOS.apk` (sideload de prueba), `signing.keystore` + `signing-key-info.txt` (alias `financeos-upload`, org "MAXNOVA & LUCI Global LLC").

`public/.well-known/assetlinks.json` (commit `9ef882d`) verifica ese paquete contra el dominio — sin esto la app abre con barra de URL como cualquier PWA. Vite copia `public/` solo a `dist/app/`, así que `build.js` lo saca a mano a `dist/.well-known/` (raíz del dominio, no bajo `/app/`). Si se regenera el paquete con una clave nueva, hay que actualizar este archivo con el fingerprint nuevo y redeployar, o la verificación queda rota.

**`signing.keystore` es irrecuperable si se pierde** — sin él no se puede subir nunca más una actualización bajo el mismo Package ID (`com.financeospro.app.twa`) en Play Store. Falta respaldarlo fuera de esta máquina (mismo criterio que las claves de backup de GastroCore).

Pendiente de Walter, no delegable: crear la cuenta de Google Play Console (pago propio, US$25 único) y la publicación pública en sí — ver memoria `financeos_audit_plaid_valor_20260821` y el punto pendiente de marca en `STATE.md` antes de ese paso.
