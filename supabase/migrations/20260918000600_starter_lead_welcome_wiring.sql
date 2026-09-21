-- Cierra el gap detectado al verificar 20260918000500: el signup de Starter
-- no disparaba el email de bienvenida (email1), a diferencia de
-- diagnostico.html, que llama a la edge function en modo "welcome" apenas
-- register_diagnostico_lead responde ok:true con el id del lead — ver
-- financeos-landing/diagnostico.html línea ~290. register_starter_lead
-- nunca devolvía id, así que el cliente (LicenseGate.jsx) no tenía forma de
-- hacer lo mismo. Se agrega el id al retorno, sin tocar la firma ni el
-- comportamiento existente (el RPC nunca falla la activación de Starter si
-- esto falla — ver el .catch() del lado cliente).
create or replace function public.register_starter_lead(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_email text; v_id uuid;
begin
  v_email := trim(p_email);
  if v_email is null or v_email = '' or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false);
  end if;
  insert into public.starter_leads (email) values (v_email) returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

revoke all on function public.register_starter_lead(text) from public;
grant  execute on function public.register_starter_lead(text) to anon;
