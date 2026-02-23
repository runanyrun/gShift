create extension if not exists "pgcrypto";

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sector text,
  country_code text,
  currency_code text,
  timezone text,
  plan_type text,
  subscription_status text,
  created_at timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete restrict,
  email text not null,
  first_name text,
  last_name text,
  role text not null check (role in ('owner', 'admin', 'manager', 'employee')),
  created_at timestamptz not null default now()
);

create index if not exists idx_users_company_id on public.users(company_id);
create index if not exists idx_users_auth_user_id on public.users(auth_user_id);
create unique index if not exists idx_users_company_email_unique
  on public.users(company_id, lower(email));

alter table public.companies enable row level security;
alter table public.users enable row level security;

-- RLS policy scaffolding (implement with your auth claims model):
-- create policy "company members can view own company"
-- on public.companies for select
-- using (id = (select company_id from public.users where auth_user_id = auth.uid()));

-- create policy "company members can view own users"
-- on public.users for select
-- using (company_id = (select company_id from public.users where auth_user_id = auth.uid()));
