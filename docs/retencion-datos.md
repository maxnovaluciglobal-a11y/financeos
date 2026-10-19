# Retención de leads (borrador D-18, sin borrado automático)

Estado al 19-oct-2026 (auditoría 360, C-23 / DAT-12). **No hay ningún borrado programado.** La política de plazos es un borrador (D-18, "Claude por delegación de Walter") que todavía tiene que validar el abogado. Activar el borrado requiere el OK explícito de Walter.

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

## Procedimiento cuando Walter lo apruebe

1. Revisar la vista y exportar un respaldo de las filas candidatas a `_archivo/backups-app/` (fuera de git).
2. Decidir si las bajas pasan a una lista de supresión (solo email, para no volver a escribirles).
3. Borrar con una migración nueva y revisable, por ejemplo `delete from public.starter_leads where id in (select id from public.leads_retention_candidates where tabla = 'starter_leads');`, una tabla por vez y verificando conteos antes y después. Los contactos del CRM (`crm_contacts`) se tratan aparte.
4. Si se quiere automatizar, un job mensual de `pg_cron` con la misma consulta, documentado acá y en la política de privacidad (es/en/de) con los plazos finales.
