# Retención de leads (D-18)

Estado al 20-oct-2026 (auditoría 360, C-23 / DAT-12 y LND-8). La política de plazos es un borrador (D-18, "Claude por delegación de Walter") que todavía tiene que validar el abogado. **Desde el 20-oct hay un borrado automático solo para el caso ya publicado** (lead sin confirmar con más de 12 meses); las bajas y la calculadora siguen sin borrado automático hasta que Walter decida (lista de supresión y LND-9).

## Plazos del borrador

| Caso | Plazo | Qué se haría |
|---|---|---|
| Lead que nunca confirmó el doble opt-in ni creó cuenta | 12 meses desde el alta | borrar la fila |
| Lead dado de baja | 30 días desde la baja | borrar la fila, salvo que haga falta una lista de supresión (solo el email) |
| Calculadora de impuestos | 12 meses desde el alta | borrar la fila |

## Qué existe hoy

La vista `public.leads_retention_candidates` (solo `service_role`) lista, sin borrar nada, las filas de `starter_leads`, `diagnostico_leads`, `invest_leads`, `demo_leads` y `tax_calculator_leads` que cumplen esos criterios, con la tabla, el id, las fechas y el motivo (`sin_confirmar_mas_de_12_meses` o `baja_mas_de_30_dias`). No muestra emails.

```sql
select tabla, motivo, count(*) from public.leads_retention_candidates group by 1, 2;
```

## Borrado automático (LND-8, 20-oct-2026)

- Job de `pg_cron` **`leads-retention-monthly`** (día 1 de cada mes, 06:17 UTC) que llama a `public.purge_unconfirmed_leads()` (migración `20261020050000`).
- Borra de `starter_leads`, `diagnostico_leads`, `invest_leads` y `demo_leads` solo las filas que la vista marca `sin_confirmar_mas_de_12_meses`. No toca `tax_calculator_leads` (LND-9) ni las bajas (`baja_mas_de_30_dias`), ni los contactos del CRM.
- Cada corrida deja una fila en `public.leads_retention_runs` (fecha y conteos por tabla, sin emails). `cron_health` lo espera cada 31 días.
- Al activarlo la vista devolvía 0 filas (el lead más viejo es del 12-sep-2026): el primer borrado real sería en septiembre de 2027.
- Prueba: `supabase/tests/leads_retention_purge.sql` (base local).
- Pausar: `select cron.alter_job((select jobid from cron.job where jobname = 'leads-retention-monthly'), active := false);`

```sql
select ran_at, total, deleted from public.leads_retention_runs order by id desc limit 12;
```

## Procedimiento para el resto (bajas y calculadora) cuando Walter lo apruebe

1. Revisar la vista y exportar un respaldo de las filas candidatas a `_archivo/backups-app/` (fuera de git).
2. Decidir si las bajas pasan a una lista de supresión (solo email, para no volver a escribirles).
3. Borrar con una migración nueva y revisable, por ejemplo `delete from public.starter_leads where id in (select id from public.leads_retention_candidates where tabla = 'starter_leads');`, una tabla por vez y verificando conteos antes y después. Los contactos del CRM (`crm_contacts`) se tratan aparte.
4. Si se quiere automatizar, un job mensual de `pg_cron` con la misma consulta, documentado acá y en la política de privacidad (es/en/de) con los plazos finales.
