-- PRD-5 (auditoría 360): NPS automático una sola vez por cuenta.
-- La app lo pide al día 14 desde el alta o a los 10 movimientos (lo que pase
-- primero) y la respuesta va por send-feedback (kind = 'nps'). Esta tabla solo
-- guarda que la cuenta ya respondió (id + fecha; ni el puntaje ni el comentario,
-- que viajan por correo a soporte). Al borrar la cuenta se va por cascada.
-- Aditiva e idempotente.
create table if not exists public.nps_answers (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  answered_at timestamptz not null default now()
);
comment on table public.nps_answers is
  'PRD-5: cuentas que ya respondieron el NPS automático (una vez por cuenta). Sin puntaje ni texto.';
alter table public.nps_answers enable row level security;
revoke all on table public.nps_answers from public, anon, authenticated;
grant select, insert, delete on table public.nps_answers to service_role;

create or replace function public.nps_claim(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'bad_args');
  end if;
  insert into public.nps_answers (user_id) values (p_user_id)
  on conflict (user_id) do nothing;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'already_answered');
  end if;
  return jsonb_build_object('ok', true);
end;
$function$;
revoke all on function public.nps_claim(uuid) from public, anon, authenticated;
grant execute on function public.nps_claim(uuid) to service_role;
