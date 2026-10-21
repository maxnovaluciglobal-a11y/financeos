-- SEG-1 (auditoría 360): IP del visitante para el límite de altas cuando el
-- alta llega por la Edge Function lead-submit (Turnstile).
--
-- lead-submit llama a las RPC register_* con el service role desde el servidor
-- de Supabase: cf-connecting-ip / x-forwarded-for serían la IP de la función y
-- todas las altas contarían como una sola IP. La función manda la IP real en
-- x-moyiq-client-ip; private.lead_rate_ok la usa SOLO si el rol del request es
-- service_role (un visitante con la clave publicable no puede falsearla: con
-- rol anon el encabezado se ignora y se usa la IP del proxy como antes).
-- El resto del cuerpo es idéntico al de 20261019190000 (verificado contra
-- producción el 21-oct-2026).
-- Aplicar: supabase db query --linked -f <este archivo> + migration repair.

create or replace function private.lead_rate_ok(p_bucket text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_headers jsonb;
  v_claims jsonb;
  v_ip text;
  v_hash text;
  v_per_ip int;
  v_total int;
begin
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    v_headers := null;
  end;
  begin
    v_claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  exception when others then
    v_claims := null;
  end;
  if coalesce(v_claims ->> 'role', '') = 'service_role' then
    v_ip := nullif(btrim(left(coalesce(v_headers ->> 'x-moyiq-client-ip', ''), 64)), '');
  end if;
  if v_ip is null then
    v_ip := nullif(btrim(coalesce(
              v_headers ->> 'cf-connecting-ip',
              split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1),
              v_headers ->> 'x-real-ip', '')), '');
  end if;
  if v_ip is not null then
    v_hash := encode(extensions.digest(v_ip, 'sha256'), 'hex');
  end if;

  delete from private.lead_rate_events where created_at < now() - interval '24 hours';

  select count(*) into v_total from private.lead_rate_events
   where bucket = p_bucket and created_at > now() - interval '1 hour';
  if v_total >= 120 then
    return false;
  end if;
  if v_hash is not null then
    select count(*) into v_per_ip from private.lead_rate_events
     where bucket = p_bucket and ip_hash = v_hash and created_at > now() - interval '1 hour';
    if v_per_ip >= 6 then
      return false;
    end if;
  end if;

  insert into private.lead_rate_events (bucket, ip_hash) values (p_bucket, v_hash);
  return true;
end;
$$;
revoke all on function private.lead_rate_ok(text) from public, anon, authenticated;
