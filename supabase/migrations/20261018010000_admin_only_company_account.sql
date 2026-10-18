-- 20261018010000_admin_only_company_account.sql
-- Regla de Walter (18-oct-2026): todo lo de los proyectos pasa por la cuenta de
-- empresa maxnovaluciglobal@gmail.com, nunca por la personal
-- walterlamadriz@gmail.com. El acceso de admin al CRM y a las tablas de leads
-- queda solo para la cuenta de empresa.

do $$
declare
  t record;
  admin_expr constant text := '((auth.jwt() ->> ''email''::text) = ''maxnovaluciglobal@gmail.com''::text)';
begin
  for t in
    select * from (values
      ('crm_contacts',          'crm_contacts_admin_all',            'all'),
      ('diagnostico_leads',     'diagnostico_leads_admin_select',    'select'),
      ('starter_leads',         'starter_leads_admin_select',        'select'),
      ('invest_leads',          'invest_leads_admin_select',         'select'),
      ('demo_leads',            'demo_leads_admin_select',           'select'),
      ('tax_calculator_leads',  'tax_calculator_leads_admin_select', 'select'),
      ('cancellation_requests', 'cancellation_requests_admin_select','select'),
      ('cancellation_requests', 'cancellation_requests_admin_update','update')
    ) v(tbl, pol, cmd)
  loop
    execute format('drop policy if exists %I on public.%I', t.pol, t.tbl);
    if t.cmd = 'select' then
      execute format('create policy %I on public.%I for select to authenticated using (%s)', t.pol, t.tbl, admin_expr);
    else
      execute format('create policy %I on public.%I for %s to authenticated using (%s) with check (%s)', t.pol, t.tbl, t.cmd, admin_expr, admin_expr);
    end if;
  end loop;
end $$;
