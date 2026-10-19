-- Auditoría 360 (19-oct-2026): C-20 (SEG-8). Aditiva e idempotente.
--
-- send-report-email (Modo Asesor) mandaba el PDF a cualquier destinatario con
-- solo conocer una clave Pro, sin sesión y sin tope. Desde ahora la función
-- exige la sesión de la cuenta (JWT) y llama a report_email_claim, que en una
-- sola transacción:
--   1. valida la licencia (activa, sin vencer, plan pro o enterprise),
--   2. comprueba que la cuenta de la sesión sea la dueña de la licencia
--      (mismo criterio que fnos_caller_owns_license, pero con el user id que
--      la función ya verificó contra Auth, porque la llama con service_role),
--   3. aplica un tope de envíos por licencia en 24 horas y registra el envío.
-- report_email_sends guarda solo el hash de la licencia, el user id y la
-- fecha (nada del destinatario ni del PDF) y se purga a los 30 días.

create table if not exists public.report_email_sends (
  id       bigserial primary key,
  key_hash text not null,
  user_id  uuid not null,
  sent_at  timestamptz not null default now()
);
comment on table public.report_email_sends is
  'C-20: envíos del reporte de Modo Asesor por licencia (hash), para el tope diario. Sin destinatario ni contenido. Se purga a los 30 días.';
create index if not exists report_email_sends_key_sent_idx on public.report_email_sends (key_hash, sent_at);
alter table public.report_email_sends enable row level security;
revoke all on table public.report_email_sends from public, anon, authenticated;
grant select, insert, delete on table public.report_email_sends to service_role;
revoke all on sequence public.report_email_sends_id_seq from public, anon, authenticated;
grant usage on sequence public.report_email_sends_id_seq to service_role;

create or replace function public.report_email_claim(
  p_user_id     uuid,
  p_key         text,
  p_daily_limit int default 20
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_hash  text;
  v_plan  text;
  v_count int;
  v_limit int := greatest(coalesce(p_daily_limit, 20), 1);
begin
  if p_user_id is null or p_key is null or length(trim(p_key)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'bad_args');
  end if;
  v_hash := public.fnos_resolve_hash(p_key);

  select l.plan into v_plan
    from public.licenses l
   where l.key_hash = v_hash
     and l.status = 'active'
     and (l.expires_at is null or l.expires_at > now());
  if v_plan is null or v_plan not in ('pro', 'enterprise') then
    return jsonb_build_object('ok', false, 'error', 'license_required');
  end if;

  if not exists (
    select 1 from public.user_entitlements e
     where e.user_id = p_user_id
       and e.license_key is not null
       and public.fnos_resolve_hash(e.license_key) = v_hash
  ) then
    return jsonb_build_object('ok', false, 'error', 'not_owner');
  end if;

  perform pg_advisory_xact_lock(hashtext('report_email:' || v_hash));
  select count(*) into v_count
    from public.report_email_sends
   where key_hash = v_hash
     and sent_at > now() - interval '24 hours';
  if v_count >= v_limit then
    return jsonb_build_object('ok', false, 'error', 'daily_limit', 'limit', v_limit);
  end if;

  insert into public.report_email_sends (key_hash, user_id) values (v_hash, p_user_id);
  delete from public.report_email_sends where sent_at < now() - interval '30 days';

  return jsonb_build_object('ok', true, 'remaining', v_limit - v_count - 1);
end;
$function$;

revoke all on function public.report_email_claim(uuid, text, int) from public, anon, authenticated;
grant execute on function public.report_email_claim(uuid, text, int) to service_role;
