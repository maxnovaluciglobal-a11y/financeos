// src/data/deployDate.js — fecha del despliegue coordinado del rebranding
// moyiq (Entrega 1). Único lugar donde se fija: de aquí salen la vigencia de
// los textos legales (pages/legal/legalMeta.js: LEGAL_EFFECTIVE_DATE y
// LEGAL_VERSION) y el id de la nota de Novedades del cambio de nombre
// (data/releaseNotes.js). El plan es el 1-dic-2026, junto con la adecuación a
// la Ley 21.719 de Chile.
//
// Antes de integrar a main, fijar la fecha real (borra también el TODO):
//   node scripts/setDeployDate.mjs AAAA-MM-DD
// Mientras quede el TODO, src/data/deployDate.test.js hace fallar `npm test`
// en main (CI: GITHUB_REF=refs/heads/main; local: rama main), con RELEASE=1
// (lo exporta ./deploy.sh) o con PREDEPLOY=1.
export const REBRAND_DEPLOY_DATE = '2026-11-18'

// Vigencia propia de la Política de Privacidad (auditoría 360 del 19-nov-2026,
// LEG-N1): la versión nueva suma el perfil de inversionista, comentarios y NPS,
// Turnstile, cotizaciones, clics de Resend y los apartados de Chile, Brasil y
// LATAM, así que no puede tener la misma fecha que la del 18-nov (snapshot en
// `03 - Legal y Cumplimiento/versiones/`). Los otros tres textos legales siguen
// con REBRAND_DEPLOY_DATE.
// 24-nov-2026 (ronda 3 pre-tiendas, N4): la versión con Inversiones, copias del
// sistema y Turnstile se publicó en la landing el 24-nov y reemplaza a la del
// 20-nov; la de la app tiene que decir lo mismo (fecha y versión reemplazada).
// 26-nov-2026 (modelo A, D1/D2): la privacidad suma el HMAC del correo de la
// prueba de Pro (una por persona) y el borrado a los 90 días de la copia del
// sync de una prueba sin compra; reemplaza a la del 24-nov, igual que la landing.
// 26-nov-2026 (ayuda en la app, despliegue del mismo día): suma el progreso de
// la ayuda guardado en la cuenta (recorridos vistos y novedades leídas). Se
// publica el mismo 26-nov que la versión del modelo A, así que conserva la
// fecha y sigue reemplazando a la del 24-nov, igual que la landing
// (feat/privacidad-ayuda). La copia de la versión de la mañana está en
// 03 - Legal y Cumplimiento/versiones/.
export const PRIVACY_DEPLOY_DATE = '2026-11-26'
export const PRIVACY_PREVIOUS_DATE = '2026-11-24'

// Vigencia propia de los Términos de Uso (ronda 4 pre-tiendas, R3-2): su texto
// cambió en 8d228a6 (sincronización opcional y «datos de la app») y la landing
// los publica con vigencia 24-nov-2026 «· reemplaza a la versión 2026-11-18»
// (financeos-landing 93ce24e). La app tiene que decir lo mismo. Licencia y
// descargo siguen con REBRAND_DEPLOY_DATE (no cambiaron dentro de la app).
// 26-nov-2026 (modelo A): la cláusula de la prueba pasa a 14 días de Pro sin
// tarjeta ni cobro (punto 7 / § 5a), igual que la landing (vigencia 2026-11-26).
export const TERMS_DEPLOY_DATE = '2026-11-26'
export const TERMS_PREVIOUS_DATE = '2026-11-24'

// Vigencia propia de la Licencia (modelo A, 26-nov-2026): sincronización y avisos
// del navegador pasan a Pro, la lista de Pro se corrige y se suma la prueba sin
// tarjeta. El descargo sigue con REBRAND_DEPLOY_DATE.
export const LICENSE_DEPLOY_DATE = '2026-11-26'
