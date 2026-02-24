-- Marketplace assignments + optional private invite scaffold.
-- Incremental migration over 0012 scaffold.

alter table public.marketplace_job_posts
  drop constraint if exists marketplace_job_posts_status_check;

alter table public.marketplace_job_posts
  add constraint marketplace_job_posts_status_check
  check (status in ('draft', 'open', 'assigned', 'closed', 'cancelled'));

alter table public.marketplace_applications
  drop constraint if exists marketplace_applications_status_check;

alter table public.marketplace_applications
  add constraint marketplace_applications_status_check
  check (status in ('submitted', 'reviewing', 'rejected', 'invited', 'accepted'));

alter table public.marketplace_assignments
  add column if not exists company_id uuid references public.companies(id) on delete cascade;

alter table public.marketplace_assignments
  add column if not exists starts_at timestamptz;

alter table public.marketplace_assignments
  add column if not exists ends_at timestamptz;

update public.marketplace_assignments ma
set
  company_id = p.company_id,
  starts_at = p.starts_at,
  ends_at = p.ends_at
from public.marketplace_job_posts p
where p.id = ma.post_id
  and (ma.company_id is null or ma.starts_at is null or ma.ends_at is null);

update public.marketplace_assignments
set status = 'active'
where status in ('scheduled', 'in_progress');

alter table public.marketplace_assignments
  alter column status set default 'active';

alter table public.marketplace_assignments
  drop constraint if exists marketplace_assignments_status_check;

alter table public.marketplace_assignments
  add constraint marketplace_assignments_status_check
  check (status in ('active', 'completed', 'cancelled'));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.marketplace_assignments'::regclass
      and conname = 'marketplace_assignments_post_uq'
  ) then
    alter table public.marketplace_assignments
      add constraint marketplace_assignments_post_uq unique (post_id);
  end if;
end $$;

create index if not exists idx_marketplace_assignments_worker_starts
  on public.marketplace_assignments(worker_user_id, starts_at);

create index if not exists idx_marketplace_assignments_company_starts
  on public.marketplace_assignments(company_id, starts_at);

alter table public.marketplace_assignments enable row level security;
alter table public.marketplace_assignments force row level security;

drop policy if exists marketplace_assignments_select_worker_or_management on public.marketplace_assignments;
create policy marketplace_assignments_select_worker_or_management
on public.marketplace_assignments
for select
to authenticated
using (
  worker_user_id = auth.uid()
  or (
    public.is_management_user()
    and company_id = public.current_user_company_id()
  )
);

drop policy if exists marketplace_assignments_insert_management on public.marketplace_assignments;
create policy marketplace_assignments_insert_management
on public.marketplace_assignments
for insert
to authenticated
with check (
  public.is_management_user()
  and company_id = public.current_user_company_id()
);

drop policy if exists marketplace_assignments_update_management on public.marketplace_assignments;
create policy marketplace_assignments_update_management
on public.marketplace_assignments
for update
to authenticated
using (
  public.is_management_user()
  and company_id = public.current_user_company_id()
)
with check (
  public.is_management_user()
  and company_id = public.current_user_company_id()
);

grant select, insert, update on table public.marketplace_assignments to authenticated;
revoke all on table public.marketplace_assignments from anon;

create table if not exists public.marketplace_private_invites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  worker_user_id uuid not null references auth.users(id) on delete cascade,
  note text null,
  starts_after timestamptz null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired', 'cancelled')),
  created_at timestamptz not null default now()
);

alter table public.marketplace_private_invites enable row level security;
alter table public.marketplace_private_invites force row level security;

revoke all on table public.marketplace_private_invites from anon;
revoke all on table public.marketplace_private_invites from authenticated;
