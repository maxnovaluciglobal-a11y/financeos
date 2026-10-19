# Historial técnico de financeos-app

Movido de `CLAUDE.md` el 19-oct-2026 (auditoría 360, C-08) para dejar en ese archivo solo las reglas vigentes. Son hechos fechados: no se reescribieron.

## Plaid se probó y se retiró (2026-08-22)

El commit `205228d` (17-ago) agregó conectar banco vía Plaid (solo EE. UU.). Una auditoría (panel de 18 agentes) encontró que contradecía el ADN privacy-first documentado (desconectar no revocaba el token real en Plaid y los endpoints no exigían licencia) y que no generaba ningún uso en marketing. Se retiró por completo el 22-ago: código, endpoints y claves i18n. **No reintroducir sin releer la auditoría** (memoria `financeos_audit_plaid_valor_20260821`): el trade-off contra "sin conexiones bancarias" sigue siendo el mismo si se reconsidera.

## Auditoría de seguridad del 18-oct-2026: sin vulnerabilidad activa

Revisión defensiva en local contra la base reconstruida (fundación `.sql` de la raíz más las migraciones de entonces). Método transversal: memoria `auditoria-seguridad-metodo`. La auditoría 360 del 18/19-oct (`00 - Gestion/auditorias/2026-10-18-auditoria-360/`) la complementa y abrió hallazgos nuevos; ver su informe 03.

- **10 de 10 tablas con RLS.** Leads con datos personales *fail-closed* (anon y usuario común ven 0 filas; solo el admin). `user_entitlements` aislado por `auth.uid() = user_id`. El trigger `lock_entitlements_plan_column` impide asignarse `pro` sin licencia (probado en vivo). `stripe-webhook` verifica la firma; `send-report-email` revalida la licencia en el servidor.
- **Nota:** `tax_calculator_leads` no tiene policy de SELECT ni para el admin (es seguro, pero el CRM no la puede leer con el cliente normal, a diferencia de `starter_leads` y `diagnostico_leads`). `cloud_backups` y `crm_funnel` estaban fuera de las migraciones.
- **Candado aplicado** (`src/core/cloudSync.js`): `CLOUD_ENCRYPTION_READY = false` bloquea `cloudPush` sin cifrar. Antes de prender `CLOUD_ENABLED` hay que implementar el cifrado AES-GCM; falta decidir el modelo de clave (derivada de un secreto del usuario, de modo que el servidor nunca pueda descifrar).
