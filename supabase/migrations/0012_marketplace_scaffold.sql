-- Marketplace scaffold (future feature)
-- Feature-flagged at API level with ENABLE_MARKETPLACE=1.
-- Production-safe default deny:
-- - RLS enabled/forced for all marketplace tables
-- - No policies yet (TODO), so reads/writes are denied
-- - Explicit revoke from anon/authenticated

create table if not exists public.marketplace_job_posts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location_id uuid null references public.locations(id) on delete set null,
  pay_rate numeric null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_job_posts_status_check check (status in ('draft', 'open', 'closed', 'cancelled'))
);

create table if not exists public.marketplace_applications (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.marketplace_job_posts(id) on delete cascade,
  worker_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'submitted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_applications_status_check check (status in ('submitted', 'reviewing', 'rejected', 'accepted'))
);

create table if not exists public.marketplace_assignments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.marketplace_job_posts(id) on delete cascade,
  worker_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'scheduled',
  scheduled_at timestamptz null,
  started_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_assignments_status_check check (status in ('scheduled', 'in_progress', 'completed', 'cancelled'))
);

create table if not exists public.marketplace_work_logs (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.marketplace_assignments(id) on delete cascade,
  clock_in timestamptz not null,
  clock_out timestamptz null,
  minutes integer null,
  approved_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketplace_ratings (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique references public.marketplace_assignments(id) on delete cascade,
  company_to_worker_score integer null,
  worker_to_company_score integer null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_ratings_company_to_worker_range check (
    company_to_worker_score is null or company_to_worker_score between 1 and 5
  ),
  constraint marketplace_ratings_worker_to_company_range check (
    worker_to_company_score is null or worker_to_company_score between 1 and 5
  )
);

create index if not exists idx_marketplace_job_posts_company_id
  on public.marketplace_job_posts(company_id);

create index if not exists idx_marketplace_applications_post_id
  on public.marketplace_applications(post_id);

create index if not exists idx_marketplace_applications_worker_user_id
  on public.marketplace_applications(worker_user_id);

create index if not exists idx_marketplace_assignments_post_id
  on public.marketplace_assignments(post_id);

create index if not exists idx_marketplace_assignments_worker_user_id
  on public.marketplace_assignments(worker_user_id);

create index if not exists idx_marketplace_work_logs_assignment_id
  on public.marketplace_work_logs(assignment_id);

alter table public.marketplace_job_posts enable row level security;
alter table public.marketplace_applications enable row level security;
alter table public.marketplace_assignments enable row level security;
alter table public.marketplace_work_logs enable row level security;
alter table public.marketplace_ratings enable row level security;

alter table public.marketplace_job_posts force row level security;
alter table public.marketplace_applications force row level security;
alter table public.marketplace_assignments force row level security;
alter table public.marketplace_work_logs force row level security;
alter table public.marketplace_ratings force row level security;

revoke all on table public.marketplace_job_posts from anon;
revoke all on table public.marketplace_job_posts from authenticated;
revoke all on table public.marketplace_applications from anon;
revoke all on table public.marketplace_applications from authenticated;
revoke all on table public.marketplace_assignments from anon;
revoke all on table public.marketplace_assignments from authenticated;
revoke all on table public.marketplace_work_logs from anon;
revoke all on table public.marketplace_work_logs from authenticated;
revoke all on table public.marketplace_ratings from anon;
revoke all on table public.marketplace_ratings from authenticated;

-- TODO (feature launch): add tenant-safe RLS policies and scoped grants.
