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

**`./deploy.sh`** (desde 2026-09-06, actualizado a 4 dominios el 11-sep): tests + build local (gate) + deploy + los CUATRO alias + smoke test de `curl` a `/app/` en los cuatro dominios. Aborta si algo falla en cualquier paso — no llega a aliasear con una build rota. Es el camino recomendado; reemplaza la secuencia manual de abajo.

Manual, si hace falta un paso suelto:

```bash
npx vercel --prod --yes
```

Con la URL que devuelve, aliasear **los cuatro** dominios (`moyiq.app` es el primario desde 11-sep-2026, `financeospro.com` sigue vivo sin redirect):

```bash
npx vercel alias <url-nueva> app.financeospro.com
```

Y repetir con `demo.financeospro.com`, `app.moyiq.app`, `demo.moyiq.app`. Si solo se aliasean algunos, el resto se queda en la versión vieja.

El navegador integrado tiene bloqueado `*.financeospro.com`/`*.moyiq.app` por política: verificar producción con `curl` por contenido, o en `localhost` con el servidor de desarrollo.

## Reglas que no son negociables

**Paridad i18n.** `src/i18n/translations.js` tiene `es`, `en`, `pt` y `de` (1161 claves por idioma al 2026-08-14). Toda clave nueva va en los CUATRO. Una clave que falta no rompe el build pero cae al fallback español (ver `useT.js`) — el usuario alemán ve una isla en su UI. Antes de escribir el texto de una clave nueva, ver `../branding/voz-de-producto.md` — nunca exclamaciones/emoji de entusiasmo fabricado, nunca personificar la app, y los 4 idiomas tienen que sonar igual de secos entre sí, no solo decir lo mismo.

**Migraciones de IndexedDB en `src/core/db/migrations.js`** (desde 2026-09-05). `DB_VERSION` ya no es una constante manual — se deriva de `Math.max(...MIGRATIONS.map(m => m.version))`, así que agregar un paso a `MIGRATIONS` bumpea la versión solo. Para cambiar la forma de datos ya guardados (no solo agregar un store), agregar un paso NUEVO al array con `migrate(db, transaction, oldVersion)`: `transaction` cubre todos los stores y sirve para leer/transformar registros existentes (ver el ejemplo de "Data migration during upgrade" en la doc de `idb`). Nunca editar un paso ya shippeado — quien ya pasó por esa versión no la vuelve a correr. `migrations.test.js` prueba el motor con fake-indexeddb, incluyendo que un paso que falla a mitad de camino aborta atómicamente (la base queda en `oldVersion`, sin datos a medio migrar) — correr ese archivo antes de tocar esto.

**Nada de datos financieros al servidor sin cifrar.** El sync empuja blobs cifrados con AES-GCM en el cliente. El servidor nunca ve montos ni categorías.

**Única excepción explícita y consentida (11-sep-2026): envío por correo del reporte de Modo Asesor.** `Advisor/index.jsx` + `ReportePDF.jsx` (`sendReportePDFByEmail`) mandan el PDF SIN CIFRAR a `supabase/functions/send-report-email/` (Resend, reusa `RESEND_API_KEY`/`FROM_EMAIL` ya configurados para `stripe-webhook`), que lo entrega por correo. Es un botón manual junto a "Exportar PDF" — nunca un cron automático: un reporte que se genera y manda solo, sin que el usuario abra la app, necesitaría que el servidor tuviera acceso a datos sin cifrar, lo cual rompe la regla de arriba. La función edge revalida server-side que la licencia sea Pro/Enterprise contra `validate_license` (RPC ya existente) antes de enviar — el `ProGate` del frontend es solo cosmético, no un límite de seguridad real. Tests en `reportEmailLogic.test.ts` (17 tests, mismo patrón que `webhookLogic.test.ts`). No hay rate-limiting propio todavía (se apoya en el gate de licencia + los límites de cuenta de Resend) — si el volumen de Modo Asesor crece, es lo primero a agregar.

**Al importar movimientos hay que refrescar el modelo.** `dbAdd` solo escribe en IndexedDB; sin `rehydrate()` los datos no aparecen hasta recargar. Y sin `markLocalChange()` no suben a la nube. Ver `src/pages/Import/index.jsx`.

## Supabase

Siete `.sql` en la raíz. **`supabase-e2e-hardening.sql` es la fuente de verdad** de `sync_push`, `sync_pull` y `validate_license`: define `fnos_resolve_hash`, que acepta tanto la clave cruda como el hash de 64 caracteres. `supabase-license-email.sql` y `supabase-license-revoke.sql` también dependen de `fnos_resolve_hash` — **cualquier archivo que toque `licenses` tiene que pasar por esa función**, nunca hashear `p_key` directo con `digest()`.

Ya pasó una vez: volver a correr `supabase-sync.sql` **pisó** esa versión buena y reintrodujo un doble hash (`sha256(sha256(key))`), con lo que `validate_license` aceptaba una licencia que `sync_push` rechazaba con `invalid_license`. Si el sync falla para una licencia que valida bien, es esto. Correr `supabase-e2e-hardening.sql`.

**Antes de "arreglar" un .sql viejo, verificar contra producción.** El 2026-08-22 se encontró `supabase-license-email.sql` desactualizado en el repo respecto de la función real corriendo en Supabase (alguien la había parcheado a mano en el SQL Editor, sin actualizar el archivo). Verificar primero con `supabase db query --linked "select pg_get_functiondef(oid) from pg_proc where proname='...'"` — si production ya está bien, el fix es reescribir el archivo para que coincida, no pisar production con una reconstrucción propia.

`supabase-license-revoke.sql` (2026-08-22): agrega `payment_intent_id` a `licenses` + `revoke_license()`, llamada desde `supabase/functions/stripe-webhook/index.ts` en `charge.refunded`/`charge.dispute.created`. Licencias emitidas antes de esa fecha tienen `payment_intent_id` NULL — un reembolso de una compra vieja no se revoca solo. **`revoke_license()` no borra ninguna fila ni dato personal — solo cambia `status` a `'revoked'`** (verificado con `pg_get_functiondef`, 2026-08-27). El email y la licencia quedan en la base indefinidamente; no hay ningún job de retención/purga. Si en algún momento hace falta borrado real (pedido de un usuario, GDPR), es una decisión de Walter, no algo que se implementó a criterio propio.

**Migraciones nuevas van en `supabase/migrations/`, no como archivo suelto en la raíz** (desde 2026-08-27, ver `supabase/migrations/README.md`). Los 7 `.sql` de la raíz siguen siendo la fuente de verdad del estado histórico — no se tocan.

## Auth compartido MOY IQ + Invest (14-sep-2026)

Este proyecto Supabase (`nelwgbcddwiaimzbcuas`) es compartido con `invest-web` (mismo `auth.users`, mismo RLS). Infra de auth que vive en ESTE repo pero sirve a los dos productos:

- **CRM interno** (`?admin=crm`, `src/admin/AdminCRM.jsx`): acceso restringido a `walterlamadriz@gmail.com` y `maxnovaluciglobal@gmail.com` vía RLS de `crm_contacts`/`diagnostico_leads`/`starter_leads` — la ruta en sí no está protegida, cualquiera puede abrirla, RLS devuelve 0 filas sin error revelador a cualquier otra cuenta.
- **`supabase/functions/auth-email-hook/`**: Send Email Hook de Supabase Auth — reemplaza la plantilla nativa (sin marca) para reset/confirmación en los dos productos, detectando cuál por el host de `redirect_to`. **Usa `NURTURE_RESEND_API_KEY`, no `RESEND_API_KEY`** (esa da 403, parece scopeada a otro remitente). Habilitado vía Management API (`PATCH /v1/projects/{ref}/config/auth`), no por dashboard.
- **`supabase/functions/notify-admin-signup/`**: notifica altas nuevas (Starter, Invest) a `maxnovaluciglobal@gmail.com`. Starter dispara desde un trigger SQL (`pg_net`); Invest llama a la RPC pública `notify_invest_signup` desde su propio cliente (no hay tabla server-side de "nuevo signup" en Invest, `profiles` es compartida con MOY IQ).
- **`register_starter_lead`** ahora devuelve `id` — el cliente (`licenseValidator.js`) lo usa para disparar el email 1 (bienvenida) de la secuencia de nurture de Starter justo al registrarse, mismo patrón que `diagnostico.html`.

Detalle completo, gotchas de debug y decisiones: memoria `financeos_moy_iq_invest_crm_20260914`, `financeos_moy_iq_auth_email_hook_20260914`, `financeos_moy_iq_admin_notify_20260914`.

## Sistema visual — rebranding MOY IQ (mergeado y desplegado)

**Estado (11-sep-2026): mergeado a `main` y en producción**, ahora en `app.moyiq.app`/`demo.moyiq.app` (dominio primario) además de `app.financeospro.com`/`demo.financeospro.com` (siguen vivos, sin redirect) — decisión explícita de Walter. ⚠️ El nombre "MOY IQ" sigue sin búsqueda de marca paga confirmada — eso es alcance legal, no de código; Walter compró `moyiq.app` el 11-sep sin esperar esa confirmación. `supportEmail`/`website` en `config.js` ya apuntan a `moyiq.app`. Ver memoria `financeos_moy_iq_rebranding_ejecucion` y `financeos_moy_iq_dominio_moyiq_app` para el detalle completo de qué se tocó.

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
- `src/utils/licenseValidator.js` — formato `FNOS-XXXX-XXXX-XXXX`. También tiene `clearServerEntitlement`/`resetPasswordForEmail`/`registerStarterLead` — el `useEffect` de sincronización de entitlement en `App.jsx` repone el plan server-side en cada carga, así que "desactivar" algo acá SIEMPRE necesita limpiar el lado server (`user_entitlements`), no solo localStorage (ver memoria `financeos_moy_iq_licencia_root_cause_fix_20260914` si este bug reaparece)
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

## Android (TWA)

**Paquete viejo (22-ago-2026, OBSOLETO — no usar)**: generado bajo el nombre "FinanceOS" antes del rename a MOY IQ, package ID `com.financeospro.app.twa`, en `../android-twa/package/` (fuera de git). Nunca se publicó. El bloqueo original (marca "FINANCEOS®" de Datarails viva en USPTO, ver `financeos_android_twa_20260822`) ya no aplica — el rename a MOY IQ lo resolvió.

**Decisión 17-sep-2026**: regenerar desde cero bajo `com.moyiq.app.twa` (Walter confirmó explícitamente — nunca se publicó nada bajo el ID viejo, así que no había continuidad que preservar, y era la última oportunidad de corregirlo sin costo). El paquete viejo y su keystore quedan sin usar, no borrar por las dudas.

**Tooling instalado en esta Mac (17-sep-2026)**: `brew install openjdk@17` + `npm install -g @bubblewrap/cli`. Bubblewrap está listo para correr — pero su wizard (`bubblewrap init`) es 100% interactivo (pide JDK path, package ID, colores, keystore) y **no se puede automatizar por Bash/agente** (se probó: el prompt se rompe sin una TTY real). Hay que correrlo a mano en Terminal.app:

```bash
export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH"
mkdir -p "../android-twa-moyiq" && cd "../android-twa-moyiq"
bubblewrap init --manifest="https://app.moyiq.app/app/manifest.webmanifest"
```

Respuestas a dar en el wizard:
- JDK: "No" (usar la propia) → path: `/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home`
- SDK de Android: dejar que Bubblewrap lo instale (Sí) — primera vez tarda, descarga ~1-2GB.
- Package ID: `com.moyiq.app.twa`
- App name / Launcher name: `MOY IQ`
- El resto (colores, ícono) ya sale bien solo porque los toma del manifest real, que ya tiene el maskable icon nuevo (ver abajo).
- Al final pide datos para el keystore NUEVO (nombre, org "MAXNOVA & LUCI Global LLC", país US) — guardalos igual que la vez pasada.

Después: `bubblewrap build` genera `app-release-signed.aab` (subir a Play Console) y el `.apk` de prueba. **Respaldar el keystore nuevo fuera de esta Mac apenas se genere** (mismo criterio que el de GastroCore) — sin él, ninguna actualización futura se puede subir bajo este package ID nunca más.

**`public/.well-known/assetlinks.json`** tiene que apuntar al fingerprint del keystore NUEVO y al package ID `com.moyiq.app.twa` (hoy todavía dice `com.financeospro.app.twa` con el fingerprint viejo — quedó desactualizado a propósito hasta que exista el paquete nuevo). Bubblewrap imprime el fingerprint SHA-256 al final del build; actualizar este archivo y redeployar (`./deploy.sh`) antes de instalar el `.apk` de prueba, o la app abre con barra de URL en vez de pantalla completa.

**Íconos maskable ya listos** (17-sep-2026, `public/icon-{192,512}-maskable.png` + `manifest`) — Bubblewrap los toma solos del manifest, no hace falta generarlos de nuevo.

Pendiente de Walter, no delegable: crear la cuenta de Google Play Console (pago propio, US$25 único) y la publicación pública en sí.

## iOS (Capacitor) — sin empezar

TWA no existe en iOS. El camino es Capacitor (WKWebView nativo) + cuenta de Apple Developer (US$99/año, no delegable). Riesgo real a tener en cuenta antes de invertir tiempo: Apple rechaza más fácil que Google las apps que son "solo una web envuelta" (guideline 4.2, mínimo esfuerzo) si no aportan algo nativo real (push, biometría, etc.) — vale la pena decidir esto ANTES de armar el proyecto, no después. Sin scaffold, sin decisión tomada todavía.
