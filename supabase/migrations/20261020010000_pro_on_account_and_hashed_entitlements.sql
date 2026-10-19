-- Auditoría 360 (20-oct-2026): C-39 (PRD-2) y C-21/C-04 (SEG-2). Aditiva e idempotente.
--
-- 1. attach_license_to_account: el checkout que sale de la app lleva el id de
--    la cuenta (client_reference_id u_<uid>_lang_xx) y stripe-webhook, después
--    de emitir la licencia, la deja activada en esa cuenta. El usuario ya no
--    pega la clave a mano; el correo con la clave queda de respaldo.
-- 2. user_entitlements.license_key deja de guardar la clave en claro: guarda su
--    hash (sha256, el mismo que licenses.key_hash). Todo lo que lee esa columna
--    ya pasa por fnos_resolve_hash(), que acepta clave o hash, así que validar,
--    sincronizar y el tope del reporte siguen igual.
--    Excepción, a propósito: si la licencia tiene una copia del sync cifrada
--    con el modelo viejo (llave derivada de la clave; blob sin el prefijo
--    "fnos2:"), la clave se conserva hasta que esa cuenta pase a la frase de
--    paso (D-05: opt-in). Sin ella, un dispositivo nuevo de esa cuenta no
--    podría descifrar su copia. Cuando el sync de esa licencia sube el primer
--    blob con frase de paso, el trigger de synced_data reemplaza la clave por
--    el hash.

create or replace function public.fnos_has_legacy_sync_blob(p_hash text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.synced_data s
     where s.key_hash = p_hash and s.blob not like 'fnos2:%'
  )
$function$;
revoke all on function public.fnos_has_legacy_sync_blob(text) from public, anon, authenticated;

create or replace function public.hash_entitlement_license_key()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare v_hash text;
begin
  if new.license_key is null or new.license_key ~ '^[0-9a-f]{64}$' then
    return new;
  end if;
  v_hash := public.fnos_resolve_hash(new.license_key);
  if not public.fnos_has_legacy_sync_blob(v_hash) then
    new.license_key := v_hash;
  end if;
  return new;
end;
$function$;
revoke all on function public.hash_entitlement_license_key() from public, anon, authenticated;

-- Corre antes que trg_lock_entitlements_plan_column (orden alfabético).
drop trigger if exists trg_hash_entitlement_license_key on public.user_entitlements;
create trigger trg_hash_entitlement_license_key
  before insert or update on public.user_entitlements
  for each row execute function public.hash_entitlement_license_key();

create or replace function public.forget_license_key_after_v2_sync()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
begin
  if new.blob like 'fnos2:%' then
    update public.user_entitlements e
       set license_key = new.key_hash
     where e.license_key is not null
       and e.license_key !~ '^[0-9a-f]{64}$'
       and public.fnos_resolve_hash(e.license_key) = new.key_hash;
  end if;
  return new;
end;
$function$;
revoke all on function public.forget_license_key_after_v2_sync() from public, anon, authenticated;

drop trigger if exists trg_forget_license_key_after_v2_sync on public.synced_data;
create trigger trg_forget_license_key_after_v2_sync
  after insert or update of blob on public.synced_data
  for each row execute function public.forget_license_key_after_v2_sync();

-- Las claves en claro que ya estaban y no tienen copia vieja del sync.
update public.user_entitlements e
   set license_key = public.fnos_resolve_hash(e.license_key)
 where e.license_key is not null
   and e.license_key !~ '^[0-9a-f]{64}$'
   and not public.fnos_has_legacy_sync_blob(public.fnos_resolve_hash(e.license_key));

create or replace function public.attach_license_to_account(p_user_id uuid, p_key text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_hash text;
  v_cur  public.user_entitlements%rowtype;
begin
  if p_user_id is null or p_key is null or length(trim(p_key)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'bad_args');
  end if;
  v_hash := public.fnos_resolve_hash(p_key);

  if not exists (select 1 from auth.users where id = p_user_id) then
    return jsonb_build_object('ok', false, 'error', 'no_account');
  end if;
  if not exists (select 1 from public.licenses
                  where key_hash = v_hash and status = 'active'
                    and (expires_at is null or expires_at > now())) then
    return jsonb_build_object('ok', false, 'error', 'invalid_license');
  end if;
  if exists (select 1 from public.user_entitlements
              where user_id <> p_user_id and license_key is not null
                and public.fnos_resolve_hash(license_key) = v_hash) then
    return jsonb_build_object('ok', false, 'error', 'license_in_use');
  end if;

  select * into v_cur from public.user_entitlements where user_id = p_user_id;
  if found and v_cur.plan = 'pro' and v_cur.license_key is not null
     and public.fnos_resolve_hash(v_cur.license_key) <> v_hash
     and exists (select 1 from public.licenses l
                  where l.key_hash = public.fnos_resolve_hash(v_cur.license_key)
                    and l.status = 'active'
                    and (l.expires_at is null or l.expires_at > now())) then
    return jsonb_build_object('ok', false, 'error', 'already_pro');
  end if;

  insert into public.user_entitlements (user_id, plan, license_key, updated_at)
  values (p_user_id, 'pro', v_hash, now())
  on conflict (user_id) do update
    set plan = 'pro', license_key = excluded.license_key, updated_at = now();
  return jsonb_build_object('ok', true);
end;
$function$;
revoke all on function public.attach_license_to_account(uuid, text) from public, anon, authenticated;
grant execute on function public.attach_license_to_account(uuid, text) to service_role;

-- 3. Comentarios desde la app (C-39 / PRD-5): tope por cuenta para la función
--    send-feedback. Solo el id de la cuenta y la fecha; el mensaje no se guarda.
--    Se purga a los 30 días. Al borrar la cuenta se van por cascada.
create table if not exists public.feedback_sends (
  id      bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  sent_at timestamptz not null default now()
);
comment on table public.feedback_sends is
  'C-39: envíos de "Enviar comentarios" por cuenta, para el tope. Sin contenido. Se purga a los 30 días.';
create index if not exists feedback_sends_user_sent_idx on public.feedback_sends (user_id, sent_at);
alter table public.feedback_sends enable row level security;
revoke all on table public.feedback_sends from public, anon, authenticated;
grant select, insert, delete on table public.feedback_sends to service_role;
revoke all on sequence public.feedback_sends_id_seq from public, anon, authenticated;
grant usage on sequence public.feedback_sends_id_seq to service_role;

create or replace function public.feedback_claim(p_user_id uuid, p_daily_limit int default 5)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_count int;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'bad_args');
  end if;
  perform pg_advisory_xact_lock(hashtext('feedback:' || p_user_id::text));
  select count(*) into v_count from public.feedback_sends
   where user_id = p_user_id and sent_at > now() - interval '24 hours';
  if v_count >= greatest(coalesce(p_daily_limit, 5), 1) then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;
  insert into public.feedback_sends (user_id) values (p_user_id);
  delete from public.feedback_sends where sent_at < now() - interval '30 days';
  return jsonb_build_object('ok', true);
end;
$function$;
revoke all on function public.feedback_claim(uuid, int) from public, anon, authenticated;
grant execute on function public.feedback_claim(uuid, int) to service_role;
