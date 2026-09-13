-- Fix: `alter database postgres set app.cron_secret = ...` (documentado en la
-- migración anterior) no se puede correr en el Postgres administrado de
-- Supabase — el rol de la CLI no tiene permiso para setear GUCs custom a
-- nivel de base (`permission denied to set parameter "app.cron_secret"`,
-- verificado al intentar aplicarlo en producción, 13-sep-2026).
--
-- Reemplazo: el secreto vive en una tabla en un schema `private` (no
-- expuesto por PostgREST — solo sirve `public` por default), con RLS
-- habilitado y CERO policies, así ni siquiera con la clave publishable se
-- puede leer vía REST. Solo lo lee el propio job de pg_cron (corre como el
-- rol que programó el job, con privilegios para saltarse RLS via el dueño
-- de la función) a través de una función SECURITY DEFINER.

create schema if not exists private;

create table if not exists private.app_secrets (
  key   text primary key,
  value text not null
);

alter table private.app_secrets enable row level security;
-- Sin policies a propósito: ni anon ni authenticated pueden leer nada acá,
-- ni siquiera si alguien filtra la clave publishable de Supabase.

create or replace function private.get_secret(p_key text)
returns text
language sql
security definer
set search_path = private
as $$
  select value from private.app_secrets where key = p_key;
$$;

revoke all on function private.get_secret(text) from public;
-- No se otorga a anon/authenticated — solo la usa el cron job de abajo,
-- que corre con los privilegios del rol que lo programó (postgres).

-- El valor real se inserta por fuera de esta migración (no hardcodear un
-- secreto en un archivo versionado) — ver el comando que corrió esta sesión
-- y que Walter puede repetir si rota el secreto:
--   insert into private.app_secrets (key, value) values
--     ('cron_secret', '<valor>')
--   on conflict (key) do update set value = excluded.value;

select cron.unschedule('diagnostico-nurture-daily');

select cron.schedule(
  'diagnostico-nurture-daily',
  '17 14 * * *',
  $$
  select net.http_post(
    url := 'https://nelwgbcddwiaimzbcuas.supabase.co/functions/v1/send-nurture-diagnostico-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', coalesce(private.get_secret('cron_secret'), '')
    ),
    body := jsonb_build_object('mode', 'cron')
  );
  $$
);
