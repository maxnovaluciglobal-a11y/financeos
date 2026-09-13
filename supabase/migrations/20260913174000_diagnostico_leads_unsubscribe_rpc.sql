-- RPC pública de unsubscribe para la secuencia nurture del diagnóstico.
-- Identificador: el `id` uuid de diagnostico_leads, NUNCA el email en la URL
-- (pedido explícito del punto 4 del plan: no un identificador trivialmente
-- adivinable en masa). Un uuid v4 no es "seguro" en el sentido criptográfico
-- de un token firmado, pero no es enumerable — alcanza para esto, que es
-- una baja de suscripción, no una acción sobre datos sensibles.

create or replace function public.unsubscribe_diagnostico_lead(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_found boolean;
begin
  update public.diagnostico_leads
     set unsubscribed_at = now()
   where id = p_id
     and unsubscribed_at is null
  returning true into v_found;

  if v_found is null then
    -- No diferenciamos "no existe" de "ya estaba dado de baja" en la
    -- respuesta — en ambos casos el resultado que le importa a quien hace
    -- click es el mismo: "ya no vas a recibir más de estos correos".
    return jsonb_build_object('ok', true, 'already', true);
  end if;

  return jsonb_build_object('ok', true, 'already', false);
end;
$$;

revoke all on function public.unsubscribe_diagnostico_lead(uuid) from public;
grant  execute on function public.unsubscribe_diagnostico_lead(uuid) to anon;
