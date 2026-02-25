alter table public.companies
  add column if not exists week_starts_on text not null default 'mon',
  add column if not exists default_shift_start text not null default '09:00',
  add column if not exists default_shift_end text not null default '17:00';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'companies_week_starts_on_check'
  ) then
    alter table public.companies
      add constraint companies_week_starts_on_check
      check (week_starts_on in ('mon', 'sun'));
  end if;
end
$$;
