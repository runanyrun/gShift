alter table public.companies
  add column if not exists weekly_budget_limit numeric(12,2) null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'companies_weekly_budget_limit_non_negative_check'
  ) then
    alter table public.companies
      add constraint companies_weekly_budget_limit_non_negative_check
      check (weekly_budget_limit is null or weekly_budget_limit >= 0);
  end if;
end
$$;
