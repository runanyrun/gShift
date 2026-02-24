-- Multi-workspace phase 1 (backward compatible)
-- App continues using users.company_id as active workspace pointer.
-- This table prepares future membership-based tenancy.

create table if not exists public.company_memberships (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  role text not null default 'employee' check (role in ('owner', 'admin', 'manager', 'employee')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  unique (auth_user_id, company_id)
);

create index if not exists idx_company_memberships_company_id
  on public.company_memberships(company_id);

create index if not exists idx_company_memberships_auth_user_id
  on public.company_memberships(auth_user_id);

insert into public.company_memberships (auth_user_id, company_id, role, status, created_at)
select
  u.auth_user_id,
  u.company_id,
  u.role,
  'active',
  coalesce(u.created_at, now())
from public.users u
where u.company_id is not null
on conflict (auth_user_id, company_id) do nothing;

alter table public.company_memberships enable row level security;
alter table public.company_memberships force row level security;

drop policy if exists company_memberships_select_self on public.company_memberships;
create policy company_memberships_select_self
on public.company_memberships
for select
to authenticated
using (auth.uid() = auth_user_id);

drop policy if exists company_memberships_select_management on public.company_memberships;
create policy company_memberships_select_management
on public.company_memberships
for select
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.auth_user_id = auth.uid()
      and u.company_id = company_memberships.company_id
      and u.role in ('owner', 'admin', 'manager')
  )
);

revoke all on table public.company_memberships from anon;
revoke all on table public.company_memberships from authenticated;
grant select on table public.company_memberships to authenticated;
