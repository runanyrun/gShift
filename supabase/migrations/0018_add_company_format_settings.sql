alter table public.companies
  add column if not exists locale text not null default 'tr-TR';

alter table public.companies
  add column if not exists currency text not null default 'TRY';
