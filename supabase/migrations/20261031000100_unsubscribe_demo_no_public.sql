-- unsubscribe_demo_lead llevaba EXECUTE a PUBLIC además de los grants explícitos
-- (20261027120000). Se quita PUBLIC; anon, authenticated y service_role siguen
-- igual, así que las bajas no cambian. Cierra el último sobrante de funciones
-- que no usa el cliente con la clave pública por diseño (acl_tighten, 31-oct).
revoke execute on function public.unsubscribe_demo_lead(uuid) from public;
