-- Ayuda en la app (26-nov-2026, aprobado por Walter el 26-nov): progreso de la
-- ayuda por persona, para no repetir en otro dispositivo lo que ya vio.
--
-- Una fila por cuenta:
--   - tours_seen: ids de pantalla cuyo recorrido vio o descartó ("Ahora no");
--   - news_read:  ids de las novedades que leyó (src/components/help/news.js).
-- Son ids cortos del contenido de la app (minúsculas, dígitos y guiones). No
-- hay datos financieros, montos ni texto libre. La app guarda también una copia
-- en el navegador y muestra la unión de las dos (src/components/help/progressSync.js).
--
-- Quién ve qué: cada cuenta solo su fila (user_id = auth.uid()): leer, crear y
-- actualizar. Sin acceso para anon. Sin delete para authenticated: la fila se
-- borra con la cuenta (on delete cascade de auth.users; la función
-- delete-account borra auth.users después de delete_account_data).
-- La demo no escribe acá: la app no llama al servidor en el modo demo.
--
-- merge_help_progress(p_tours, p_news) suma (unión) lo que manda la app a lo que
-- ya hay, para que dos dispositivos no se pisen. SECURITY INVOKER: corre con los
-- permisos y las políticas de quien llama. Descarta ids con otro formato y
-- guarda como máximo 200 de cada tipo.
--
-- Aditiva e idempotente: solo agrega una tabla y una función. Reversa al pie.
-- Test: supabase/tests/help_progress.sql (job `db` del CI).

begin;

create table if not exists public.help_progress (
  user_id     uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  tours_seen  text[] not null default '{}',
  news_read   text[] not null default '{}',
  updated_at  timestamptz not null default now(),
  constraint help_progress_tours_max check (cardinality(tours_seen) <= 200),
  constraint help_progress_news_max  check (cardinality(news_read) <= 200),
  constraint help_progress_tours_fmt check (array_to_string(tours_seen, ',') ~ '^([a-z0-9][a-z0-9-]{0,63}(,|$))*$'),
  constraint help_progress_news_fmt  check (array_to_string(news_read, ',') ~ '^([a-z0-9][a-z0-9-]{0,63}(,|$))*$'),
  -- El formato se valida sobre el texto unido: estos topes cierran elementos con comas o nulos.
  constraint help_progress_tours_len check (char_length(array_to_string(tours_seen, ',')) <= 13000 and array_position(tours_seen, null) is null),
  constraint help_progress_news_len  check (char_length(array_to_string(news_read, ',')) <= 13000 and array_position(news_read, null) is null)
);

comment on table public.help_progress is
  'Ayuda en la app (20261126010000): recorridos vistos y novedades leídas, por cuenta. Sin datos financieros. Se borra con la cuenta (cascade).';

alter table public.help_progress enable row level security;
revoke all on table public.help_progress from public, anon, authenticated;
grant select, insert, update on table public.help_progress to authenticated;
grant select, insert, update, delete on table public.help_progress to service_role;

drop policy if exists help_progress_select_own on public.help_progress;
create policy help_progress_select_own on public.help_progress
  for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists help_progress_insert_own on public.help_progress;
create policy help_progress_insert_own on public.help_progress
  for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists help_progress_update_own on public.help_progress;
create policy help_progress_update_own on public.help_progress
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create or replace function public.merge_help_progress(p_tours text[] default '{}', p_news text[] default '{}')
 returns jsonb
 language plpgsql
 security invoker
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid   uuid := auth.uid();
  v_tours text[];
  v_news  text[];
  r       public.help_progress;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select coalesce(array_agg(x order by x), '{}') into v_tours from (
    select distinct x from unnest(coalesce(p_tours, '{}')) x
     where x ~ '^[a-z0-9][a-z0-9-]{0,63}$' order by x limit 200) s;
  select coalesce(array_agg(x order by x), '{}') into v_news from (
    select distinct x from unnest(coalesce(p_news, '{}')) x
     where x ~ '^[a-z0-9][a-z0-9-]{0,63}$' order by x limit 200) s;

  insert into public.help_progress as h (user_id, tours_seen, news_read, updated_at)
  values (v_uid, v_tours, v_news, now())
  on conflict (user_id) do update set
    tours_seen = (select coalesce(array_agg(x order by x), '{}') from (
                   select distinct x from unnest(h.tours_seen || excluded.tours_seen) x order by x limit 200) s),
    news_read  = (select coalesce(array_agg(x order by x), '{}') from (
                   select distinct x from unnest(h.news_read || excluded.news_read) x order by x limit 200) s),
    updated_at = now()
  returning * into r;

  return jsonb_build_object('tours_seen', to_jsonb(r.tours_seen), 'news_read', to_jsonb(r.news_read));
end;
$function$;

comment on function public.merge_help_progress(text[], text[]) is
  'Ayuda en la app: suma (unión) recorridos vistos y novedades leídas a la fila de la cuenta de la sesión. SECURITY INVOKER (RLS de help_progress).';

revoke all on function public.merge_help_progress(text[], text[]) from public, anon;
grant execute on function public.merge_help_progress(text[], text[]) to authenticated, service_role;

commit;

-- ── Reversa ───────────────────────────────────────────────────────────────
-- drop function if exists public.merge_help_progress(text[], text[]);
-- drop table if exists public.help_progress;
