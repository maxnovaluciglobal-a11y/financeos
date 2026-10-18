-- 20261018020000_profiles_capital_default_zero.sql
-- Una cuenta nueva debe empezar en cero (pedido de Walter, 18-oct-2026).
-- profiles.capital (el "capital de referencia" de MOY IQ Invest) nacía en
-- 100000 por defecto, así que toda cuenta nueva veía USD 100.000 que nunca
-- cargó. Invest ya trata 0 como "sin capital definido" (muestra "Define tu
-- capital"), así que el default pasa a 0.
alter table public.profiles alter column capital set default 0;

-- Cuentas que nunca usaron Invest y tienen exactamente el valor por defecto:
-- ese 100000 no lo eligió nadie. Quien ya usó Invest conserva su valor.
update public.profiles p
   set capital = 0, updated_at = now()
 where p.capital = 100000
   and not exists (select 1 from public.portfolio_holdings h where h.user_id = p.id)
   and not exists (select 1 from public.watchlist w where w.user_id = p.id);
