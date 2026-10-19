# Sync con frase de paso (D-05, C-21)

Auditoría 360, 20-oct-2026. Resuelve SEG-2 (el servidor podía descifrar el sync) e ING-3 (sin tests).

## Modelos

| | v1 (anterior) | v2 (frase de paso) |
|---|---|---|
| Llave | `SHA-256('fnos-sync:' + LICENCIA)` | `PBKDF2-SHA256(frase NFKC, sal 16 B, 600 000 it.)` |
| Quién puede derivarla | quien tenga la licencia (el servidor la guardaba en `user_entitlements.license_key`) | solo quien sepa la frase |
| Blob en `synced_data.blob` | `base64(iv ‖ ct)` | `fnos2:{"v":2,"kdf":"pbkdf2-sha256","i":600000,"s":…,"iv":…,"ct":…}`; `kdf`, `i` y `s` van como AAD |
| Se puede activar desde cero | no (desde el 20-oct) | sí, es el único camino |

El dispositivo guarda la llave derivada en `fnos_sync_v2` (clave de la cuenta en `localStorage`, misma sensibilidad que los datos locales en claro) para no pedir la frase en cada subida. Un sobre con menos de 600 000 iteraciones se rechaza (`weak_kdf`): un servidor alterado no puede bajar el costo del KDF.

## Licencia en el servidor (C-04)

- `user_entitlements.license_key` guarda el **hash** (trigger `trg_hash_entitlement_license_key` + update único, migración `20261020010000`). Todo lo que la lee pasa por `fnos_resolve_hash()`, que acepta hash o clave.
- Excepción: si la licencia tiene un blob v1 en `synced_data`, la clave se conserva (sin ella un dispositivo nuevo no podría leer su copia). Cuando esa licencia sube el primer blob `fnos2:`, el trigger `trg_forget_license_key_after_v2_sync` la reemplaza por el hash. Un rollback a v1 no la vuelve a poner.
- La app acepta un hash de 64 hex como "licencia" (lo devuelve la cuenta en un dispositivo nuevo): sirve para validar, avisos, reporte y v2, no para v1.

## Reglas del sync (`core/sync.js`)

1. Un blob que el dispositivo no puede descifrar **nunca se pisa** (`pullAndApplyIfNewer` devuelve `{ blocked }` y `pushNow` mira la nube antes de subir: `guardRemote`). Antes, un fallo de descifrado subía lo local encima.
2. Un dispositivo que nunca sincronizó y está vacío siempre toma lo remoto. Además, la relectura de la base al arrancar, por el mantenimiento de fijos o por datos que llegan del sync ya no marca "cambio local" (`rehydrate({ notLocalChange: true })`). Antes, cargar la app escribía `lastLocalChange` y un dispositivo nuevo pisaba la copia de la nube al activar el sync (hallazgo del 19-oct).
3. Última edición gana entre dispositivos que pueden leer la copia; respaldo local (`fnos_presync_backup`) antes de aplicar.

## Migración v1 → v2 (opt-in, Ajustes)

1. La UI exige descargar un respaldo JSON (foto previa).
2. `migrateToPassphrase`: guarda el blob v1 tal cual en `fnos_sync_v1_rollback`, trae lo remoto si es más nuevo, sube lo local cifrado con la frase y lo **vuelve a bajar y descifrar**, comparando cuántos registros hay por store.
3. Si la verificación falla, devuelve a la nube la copia v1 guardada y el dispositivo sigue en v1 (`verify_failed`).
4. Sin la clave de licencia cruda en el dispositivo y con una copia v1 en la nube, no migra (`license_key_required`): no se puede leer lo remoto y se perdería.

Otros dispositivos de la cuenta quedan bloqueados (no suben nada) hasta que escriben la frase (`unlockWithPassphrase`, que prueba la frase descifrando antes de guardar nada).

## Rollback

- **v2 → v1 a pedido** (`rollbackToLicenseKey`, enlace en Ajustes): sube lo local cifrado con la licencia, lo verifica y olvida la llave v2. Necesita la clave cruda. El servidor sigue con el hash: un dispositivo nuevo tendrá que escribir la clave del correo (formulario "Falta tu clave de licencia").
- **Volver la nube a la copia previa** (`restoreV1Snapshot`): sube exactamente el blob v1 guardado antes de migrar.
- **Volver atrás el código**: un deploy anterior no sabe leer `fnos2:`; con el guard viejo, un cliente viejo con la licencia podría subir v1 encima (gana la última edición, sin pérdida más allá de eso). Antes de revertir el código, hacer rollback v2 → v1 desde Ajustes en las cuentas migradas.

## Tests

- `utils/syncCrypto.test.js`: vectores fijos (hash = SQL, v1, v2 con 600 000 it. verificado con `crypto.pbkdf2Sync`, RFC 7914), ida y vuelta, frase incorrecta, datos corruptos o alterados, AAD, iteraciones bajas rechazadas, NFKC.
- `core/sync.test.js`: servidor simulado; camino v1, protecciones, v2 desde cero, migración, otro dispositivo bloqueado y desbloqueo, rollback, snapshot, verificación fallida con vuelta a v1, guard antes de subir.
- `utils/licenseValidator.test.js`: formato, hash de la cuenta, caché, sin red.
- `supabase/tests/pro_on_account_and_hashed_keys.sql`: triggers de hash y excepción del blob v1 (base local).
