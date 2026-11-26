-- SOLO LECTURA. Verificación antes de aplicar 20261126000000_reverse_trial.sql en
-- producción (regla del repo: "antes de arreglar un .sql, verificar contra
-- producción"). No escribe nada: solo SELECT.
--
--   supabase db query --linked -f supabase/verify/2026-11-26-reverse-trial-preapply.sql > /tmp/prod-defs.txt
--   y lo mismo contra una base local con las migraciones de main aplicadas
--   (scripts/test-db/start.sh + apply-migrations.sh sin este archivo):
--   docker exec -i moyiq-test-db psql -X -A -t -U supabase_admin -d postgres < supabase/verify/2026-11-26-reverse-trial-preapply.sql > /tmp/repo-defs.txt
--   diff /tmp/prod-defs.txt /tmp/repo-defs.txt   → tiene que salir vacío.
-- Si producción difiere en alguna función que la migración reemplaza, NO aplicar:
-- primero llevar la diferencia al repo (la migración copia el cuerpo del repo).

-- 1. Funciones que la migración reemplaza con CREATE OR REPLACE.
select p.oid::regprocedure::text as function, md5(pg_get_functiondef(p.oid)) as md5
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('validate_license', 'attach_license_to_account', 'save_push_subscription',
                     'report_email_claim', 'crm_refresh_contact', 'delete_account_data',
                     'funnel_report_metrics')
 order by 1;

select p.oid::regprocedure::text as function, pg_get_functiondef(p.oid) as definition
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('validate_license', 'attach_license_to_account', 'save_push_subscription',
                     'report_email_claim', 'crm_refresh_contact', 'delete_account_data',
                     'funnel_report_metrics')
 order by 1;

-- 2. Lo que la migración da por existente.
select 'vault license_hash_pepper' as check, exists (select 1 from vault.secrets where name = 'license_hash_pepper') as ok
union all select 'licenses.is_trial', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'licenses' and column_name = 'is_trial')
union all select 'licenses.trial_ends_at', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'licenses' and column_name = 'trial_ends_at')
union all select 'licenses.key_hash_v', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'licenses' and column_name = 'key_hash_v')
union all select 'push_subscriptions.fail_count', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'push_subscriptions' and column_name = 'fail_count')
union all select 'auth.users.email_confirmed_at', exists (select 1 from information_schema.columns where table_schema = 'auth' and table_name = 'users' and column_name = 'email_confirmed_at')
union all select 'auth.users.is_anonymous', exists (select 1 from information_schema.columns where table_schema = 'auth' and table_name = 'users' and column_name = 'is_anonymous')
union all select 'private.get_secret(cron_secret)', to_regprocedure('private.get_secret(text)') is not null
union all select 'public.trial_emails (delete_account_data la usa)', to_regclass('public.trial_emails') is not null
union all select 'public.push_endpoint_allowed', to_regprocedure('public.push_endpoint_allowed(text)') is not null
union all select 'sin pro_trials todavía (primera aplicación)', to_regclass('public.pro_trials') is null;

-- 3. Jobs de pg_cron que crea (no deberían existir antes).
select jobname, schedule from cron.job
 where jobname in ('pro-trials-expire', 'pro-trials-purge-sync', 'pro-trial-emails-hourly')
 order by 1;

-- 4. Triggers de user_entitlements y licenses (la migración suma trg_carry_pro_trial_to_license).
select tgrelid::regclass::text as table, tgname
  from pg_trigger
 where not tgisinternal and tgrelid in ('public.user_entitlements'::regclass, 'public.licenses'::regclass)
 order by 1, 2;
