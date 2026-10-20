-- Prueba de delete_account_data (C-22). SOLO en una base local con el esquema de
-- producción: psql -v ON_ERROR_STOP=1 -f supabase/tests/account_deletion.sql
-- Todo dentro de una transacción que se revierte.
begin;
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid();
  ha text := encode(digest('FNOS-DELA-DELA-DELA','sha256'),'hex');
  hg text := encode(digest('FNOS-TGFT-TGFT-TGFT','sha256'),'hex');
  r jsonb; n int;
begin
  insert into auth.users (id, email, instance_id, aud, role) values
    (a,'ana-del@t.local','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
    (b,'beto-del@t.local','00000000-0000-0000-0000-000000000000','authenticated','authenticated');
  insert into public.profiles(id,email) values (a,'ana-del@t.local'),(b,'beto-del@t.local');
  insert into public.licenses(key_hash,plan,status,email,stripe_subscription_id) values
    (ha,'pro','active','ana-del@t.local','sub_del_a'), (hg,'pro','active','ANA-DEL@t.local','sub_tgift');
  insert into public.user_entitlements(user_id,plan,license_key) values (a,'pro',ha),(b,'pro',hg);
  insert into public.synced_data(key_hash,blob,updated_at) values (public.fnos_license_id(ha),'fnos2:{}',1),(public.fnos_license_id(hg),'fnos2:{}',1);
  insert into public.consents(user_id,document_type,version) values (a,'terms','1'),(b,'terms','1');
  insert into public.starter_leads(email,newsletter_synced_at) values ('ana-del@t.local',now());
  insert into public.cancellation_requests(name,email,plan,kind,lang) values ('Ana','ana-del@t.local','pro_monthly','ordinary','es');

  r := public.delete_account_data(a, 'Ana-Del@t.local');
  assert r->>'ok' = 'true', r::text;
  assert r->'stripe_subscriptions' = '["sub_del_a"]'::jsonb, 'suscripción a cancelar: ' || r::text;
  assert (r->>'newsletter_followup')::boolean, 'aviso de newsletter';
  select count(*) into n from public.licenses where key_hash in (ha, public.fnos_license_id(ha)); assert n = 0, 'licencia de A';
  select count(*) into n from public.synced_data where key_hash in (ha, public.fnos_license_id(ha)); assert n = 0, 'sync de A';
  select count(*) into n from public.user_entitlements where user_id = a; assert n = 0, 'entitlement de A';
  select count(*) into n from public.profiles where id = a; assert n = 0, 'perfil de A';
  select count(*) into n from public.starter_leads where lower(email) = 'ana-del@t.local'; assert n = 0, 'lead de A';
  -- La licencia regalo con el mismo email es de B: no se toca.
  select count(*) into n from public.licenses where key_hash in (hg, public.fnos_license_id(hg)); assert n = 1, 'licencia de B intacta';
  select count(*) into n from public.synced_data where key_hash in (hg, public.fnos_license_id(hg)); assert n = 1, 'sync de B intacto';
  select count(*) into n from public.consents where user_id = b; assert n = 1, 'consentimiento de B';
  -- Constancia de la cancelación (3 años) y registro sin PII.
  select count(*) into n from public.cancellation_requests where email = 'ana-del@t.local'; assert n = 1, 'cancelación conservada';
  select count(*) into n from public.account_deletions where stripe_followup and rows_deleted ? 'licenses'; assert n >= 1, 'constancia';
  assert not exists (select 1 from information_schema.columns where table_name = 'account_deletions' and column_name ~ '(email|user|license|key)'), 'account_deletions sin PII';
  -- Idempotente.
  r := public.delete_account_data(a, 'ana-del@t.local'); assert r->>'ok' = 'true';
  assert not has_function_privilege('authenticated', 'public.delete_account_data(uuid,text)', 'execute');
  assert not has_function_privilege('anon', 'public.delete_account_data(uuid,text)', 'execute');
  raise notice 'OK: account_deletion';
end $$;
rollback;
