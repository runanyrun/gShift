alter table public.companies
  add column if not exists timezone text not null default 'Europe/Istanbul';
