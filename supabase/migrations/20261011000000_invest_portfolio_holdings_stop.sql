-- MOY IQ Invest · stop por posición (auditoría UX oct-2026, ticket I03,
-- decisión D3 de Walter).
--
-- Agrega una columna opcional `stop` a public.portfolio_holdings para que
-- "Riesgo al stop" use el stop que carga la persona en vez de la referencia
-- fija de −8 %. La tabla es solo de Invest (MOY IQ no la usa) y vive en el
-- Supabase compartido nelwgbcddwiaimzbcuas, por eso la migración va en este
-- repo, que es el que corre `supabase db push --linked`.
--
-- Impacto:
--   * Columna nullable, sin default: las filas existentes quedan en NULL
--     ("sin stop"). No reescribe la tabla (ADD COLUMN nullable sin default
--     es instantáneo en Postgres) ni toca datos.
--   * RLS: las policies existentes de portfolio_holdings filtran por
--     auth.uid() = user_id a nivel de fila y cubren la columna nueva; no hace
--     falta tocarlas. No hay grants por columna en esta tabla.
--   * La app (invest-web, rama ux/invest-app-audit) detecta si la columna
--     existe: sin esta migración sigue funcionando con la estimación de −8 %.
--
-- Rollback:
--   alter table public.portfolio_holdings drop column if exists stop;

alter table public.portfolio_holdings
  add column if not exists stop numeric;

alter table public.portfolio_holdings
  drop constraint if exists portfolio_holdings_stop_positive;
alter table public.portfolio_holdings
  add constraint portfolio_holdings_stop_positive check (stop is null or stop > 0);

comment on column public.portfolio_holdings.stop is
  'Stop por posición definido por la persona (precio, misma moneda que avg_cost). NULL = sin stop. Invest, I03.';
