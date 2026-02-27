-- Manager Job Lifecycle (Sprint 3)
-- Canonical manager job record lives in public.marketplace_job_posts.
-- This migration extends it for operations lifecycle and auditability.

alter table public.marketplace_job_posts
  add column if not exists role_id uuid references public.roles(id) on delete set null,
  add column if not exists hourly_rate numeric,
  add column if not exists currency text not null default 'USD',
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists notes text;

update public.marketplace_job_posts
set hourly_rate = coalesce(hourly_rate, pay_rate);

update public.marketplace_job_posts
set pay_rate = coalesce(pay_rate, hourly_rate);

create index if not exists idx_marketplace_job_posts_status
  on public.marketplace_job_posts(status);

create index if not exists idx_marketplace_job_posts_starts_at
  on public.marketplace_job_posts(starts_at);

create table if not exists public.job_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_id uuid not null references public.marketplace_job_posts(id) on delete cascade,
  actor_user_id uuid null references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('created', 'edited', 'closed', 'cancelled', 'reopened')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_job_events_company
  on public.job_events(company_id, created_at desc);

create index if not exists idx_job_events_job
  on public.job_events(job_id, created_at desc);

alter table public.job_events enable row level security;
alter table public.job_events force row level security;

revoke all on table public.job_events from anon;
revoke all on table public.job_events from authenticated;

drop policy if exists marketplace_job_posts_select_authenticated on public.marketplace_job_posts;
create policy marketplace_job_posts_select_authenticated
on public.marketplace_job_posts
for select
to authenticated
using (company_id = public.current_user_company_id());

drop policy if exists job_events_select_management on public.job_events;
create policy job_events_select_management
on public.job_events
for select
to authenticated
using (
  public.is_management_user()
  and company_id = public.current_user_company_id()
);

drop policy if exists job_events_insert_denied on public.job_events;
create policy job_events_insert_denied
on public.job_events
for insert
to authenticated
with check (false);

create or replace function public.create_job(
  p_location_id uuid,
  p_role_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_hourly_rate numeric,
  p_currency text default 'USD',
  p_notes text default null,
  p_title text default null
)
returns public.marketplace_job_posts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_actor uuid;
  v_location_exists boolean;
  v_role_exists boolean;
  v_job public.marketplace_job_posts;
begin
  if not public.is_management_user() then
    raise exception 'no-permission';
  end if;

  v_company_id := public.current_user_company_id();
  v_actor := auth.uid();

  if p_start_at is null or p_end_at is null or p_end_at <= p_start_at then
    raise exception 'Invalid time range.';
  end if;

  if p_hourly_rate is null or p_hourly_rate < 0 then
    raise exception 'Hourly rate must be a non-negative number.';
  end if;

  select exists (
    select 1
    from public.locations l
    where l.id = p_location_id
      and l.company_id = v_company_id
  )
  into v_location_exists;

  if not v_location_exists then
    raise exception 'Location not found in active company.';
  end if;

  select exists (
    select 1
    from public.roles r
    where r.id = p_role_id
      and r.company_id = v_company_id
  )
  into v_role_exists;

  if not v_role_exists then
    raise exception 'Role not found in active company.';
  end if;

  insert into public.marketplace_job_posts (
    company_id,
    title,
    starts_at,
    ends_at,
    location_id,
    role_id,
    pay_rate,
    hourly_rate,
    currency,
    status,
    created_by,
    notes
  )
  values (
    v_company_id,
    coalesce(nullif(trim(coalesce(p_title, '')), ''), 'Shift Posting'),
    p_start_at,
    p_end_at,
    p_location_id,
    p_role_id,
    p_hourly_rate,
    p_hourly_rate,
    upper(coalesce(nullif(trim(p_currency), ''), 'USD')),
    'open',
    v_actor,
    nullif(trim(coalesce(p_notes, '')), '')
  )
  returning * into v_job;

  insert into public.job_events (
    company_id,
    job_id,
    actor_user_id,
    event_type,
    payload
  )
  values (
    v_company_id,
    v_job.id,
    v_actor,
    'created',
    jsonb_build_object('job', to_jsonb(v_job))
  );

  return v_job;
end;
$$;

create or replace function public.update_job(
  p_job_id uuid,
  p_location_id uuid default null,
  p_role_id uuid default null,
  p_start_at timestamptz default null,
  p_end_at timestamptz default null,
  p_hourly_rate numeric default null,
  p_currency text default null,
  p_notes text default null
)
returns public.marketplace_job_posts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_actor uuid;
  v_job public.marketplace_job_posts;
  v_before jsonb;
  v_has_active_assignment boolean;
  v_next_location uuid;
  v_next_role uuid;
  v_next_start timestamptz;
  v_next_end timestamptz;
  v_next_hourly numeric;
  v_next_currency text;
  v_next_notes text;
begin
  if not public.is_management_user() then
    raise exception 'no-permission';
  end if;

  v_company_id := public.current_user_company_id();
  v_actor := auth.uid();

  select *
  into v_job
  from public.marketplace_job_posts
  where id = p_job_id
    and company_id = v_company_id
  for update;

  if not found then
    raise exception 'Job not found.';
  end if;

  if v_job.status = 'cancelled' then
    raise exception 'Cancelled jobs cannot be edited.';
  end if;

  select exists (
    select 1
    from public.marketplace_assignments ma
    where ma.post_id = p_job_id
      and ma.status = 'active'
  )
  into v_has_active_assignment;

  v_next_location := coalesce(p_location_id, v_job.location_id);
  v_next_role := coalesce(p_role_id, v_job.role_id);
  v_next_start := coalesce(p_start_at, v_job.starts_at);
  v_next_end := coalesce(p_end_at, v_job.ends_at);
  v_next_hourly := coalesce(p_hourly_rate, v_job.hourly_rate, v_job.pay_rate);
  v_next_currency := upper(coalesce(nullif(trim(coalesce(p_currency, v_job.currency)), ''), 'USD'));
  v_next_notes := nullif(trim(coalesce(p_notes, v_job.notes, '')), '');

  if v_next_end <= v_next_start then
    raise exception 'Invalid time range.';
  end if;

  if v_next_hourly is null or v_next_hourly < 0 then
    raise exception 'Hourly rate must be a non-negative number.';
  end if;

  if not exists (
    select 1
    from public.locations l
    where l.id = v_next_location
      and l.company_id = v_company_id
  ) then
    raise exception 'Location not found in active company.';
  end if;

  if not exists (
    select 1
    from public.roles r
    where r.id = v_next_role
      and r.company_id = v_company_id
  ) then
    raise exception 'Role not found in active company.';
  end if;

  if v_has_active_assignment then
    if p_location_id is not null and p_location_id <> v_job.location_id then
      raise exception 'Assigned jobs cannot change location.';
    end if;
    if p_role_id is not null and p_role_id <> v_job.role_id then
      raise exception 'Assigned jobs cannot change role.';
    end if;
    if p_hourly_rate is not null and p_hourly_rate <> coalesce(v_job.hourly_rate, v_job.pay_rate) then
      raise exception 'Assigned jobs cannot change pay rate.';
    end if;
    if p_currency is not null and upper(p_currency) <> coalesce(v_job.currency, 'USD') then
      raise exception 'Assigned jobs cannot change currency.';
    end if;

    if p_start_at is not null and abs(extract(epoch from (p_start_at - v_job.starts_at))) > 1800 then
      raise exception 'Assigned jobs only allow minor start time adjustments (<=30m).';
    end if;

    if p_end_at is not null and abs(extract(epoch from (p_end_at - v_job.ends_at))) > 1800 then
      raise exception 'Assigned jobs only allow minor end time adjustments (<=30m).';
    end if;
  end if;

  v_before := to_jsonb(v_job);

  update public.marketplace_job_posts
  set
    location_id = v_next_location,
    role_id = v_next_role,
    starts_at = v_next_start,
    ends_at = v_next_end,
    hourly_rate = v_next_hourly,
    pay_rate = v_next_hourly,
    currency = v_next_currency,
    notes = v_next_notes,
    updated_at = now()
  where id = p_job_id
  returning * into v_job;

  insert into public.job_events (
    company_id,
    job_id,
    actor_user_id,
    event_type,
    payload
  )
  values (
    v_company_id,
    p_job_id,
    v_actor,
    'edited',
    jsonb_build_object(
      'before', v_before,
      'after', to_jsonb(v_job),
      'active_assignment_guard', v_has_active_assignment
    )
  );

  return v_job;
end;
$$;

create or replace function public.close_job(
  p_job_id uuid,
  p_reason text default null
)
returns public.marketplace_job_posts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_actor uuid;
  v_job public.marketplace_job_posts;
begin
  if not public.is_management_user() then
    raise exception 'no-permission';
  end if;

  v_company_id := public.current_user_company_id();
  v_actor := auth.uid();

  select *
  into v_job
  from public.marketplace_job_posts
  where id = p_job_id
    and company_id = v_company_id
  for update;

  if not found then
    raise exception 'Job not found.';
  end if;

  if v_job.status = 'cancelled' then
    raise exception 'Cancelled jobs cannot be closed.';
  end if;

  if v_job.status <> 'open' then
    raise exception 'Only open jobs can be closed.';
  end if;

  update public.marketplace_job_posts
  set status = 'closed',
      updated_at = now()
  where id = p_job_id
  returning * into v_job;

  insert into public.job_events (
    company_id,
    job_id,
    actor_user_id,
    event_type,
    payload
  )
  values (
    v_company_id,
    p_job_id,
    v_actor,
    'closed',
    jsonb_build_object('reason', nullif(trim(coalesce(p_reason, '')), ''))
  );

  return v_job;
end;
$$;

create or replace function public.cancel_job(
  p_job_id uuid,
  p_reason text
)
returns public.marketplace_job_posts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_actor uuid;
  v_job public.marketplace_job_posts;
  v_assignment_ids uuid[];
  v_cancelled_assignments integer := 0;
  v_cancelled_applications integer := 0;
begin
  if not public.is_management_user() then
    raise exception 'no-permission';
  end if;

  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'Cancel reason is required.';
  end if;

  v_company_id := public.current_user_company_id();
  v_actor := auth.uid();

  select *
  into v_job
  from public.marketplace_job_posts
  where id = p_job_id
    and company_id = v_company_id
  for update;

  if not found then
    raise exception 'Job not found.';
  end if;

  if v_job.status = 'cancelled' then
    raise exception 'Job already cancelled.';
  end if;

  update public.marketplace_job_posts
  set status = 'cancelled',
      updated_at = now()
  where id = p_job_id
  returning * into v_job;

  with cancelled as (
    update public.marketplace_assignments
    set status = 'cancelled',
        updated_at = now()
    where post_id = p_job_id
      and status = 'active'
    returning id
  )
  select coalesce(array_agg(id), '{}'::uuid[]), coalesce(count(*), 0)
  into v_assignment_ids, v_cancelled_assignments
  from cancelled;

  with updated_apps as (
    update public.marketplace_applications
    set status = 'rejected',
        updated_at = now()
    where post_id = p_job_id
      and status in ('submitted', 'reviewing', 'invited')
    returning id
  )
  select coalesce(count(*), 0)
  into v_cancelled_applications
  from updated_apps;

  insert into public.job_events (
    company_id,
    job_id,
    actor_user_id,
    event_type,
    payload
  )
  values (
    v_company_id,
    p_job_id,
    v_actor,
    'cancelled',
    jsonb_build_object(
      'reason', trim(p_reason),
      'cancelled_assignment_ids', v_assignment_ids,
      'cancelled_assignments_count', v_cancelled_assignments,
      'cancelled_applications_count', v_cancelled_applications
    )
  );

  return v_job;
end;
$$;

create or replace function public.list_jobs(
  p_status text default null,
  p_location_id uuid default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  company_id uuid,
  location_id uuid,
  role_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  hourly_rate numeric,
  currency text,
  status text,
  notes text,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  applicants_count bigint,
  assignments_count bigint,
  active_assignments_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    j.id,
    j.company_id,
    j.location_id,
    j.role_id,
    j.starts_at,
    j.ends_at,
    coalesce(j.hourly_rate, j.pay_rate) as hourly_rate,
    coalesce(j.currency, 'USD') as currency,
    j.status,
    j.notes,
    j.created_by,
    j.created_at,
    j.updated_at,
    coalesce(apps.count_all, 0) as applicants_count,
    coalesce(assigns.count_all, 0) as assignments_count,
    coalesce(assigns.count_active, 0) as active_assignments_count
  from public.marketplace_job_posts j
  left join lateral (
    select count(*)::bigint as count_all
    from public.marketplace_applications a
    where a.post_id = j.id
  ) apps on true
  left join lateral (
    select
      count(*)::bigint as count_all,
      count(*) filter (where ma.status = 'active')::bigint as count_active
    from public.marketplace_assignments ma
    where ma.post_id = j.id
  ) assigns on true
  where j.company_id = public.current_user_company_id()
    and public.is_management_user()
    and (
      p_status is null
      or p_status = ''
      or p_status = 'all'
      or j.status = p_status
    )
    and (p_location_id is null or j.location_id = p_location_id)
    and (p_from is null or j.starts_at >= p_from)
    and (p_to is null or j.starts_at <= p_to)
  order by j.starts_at asc
  limit greatest(coalesce(p_limit, 50), 1)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.get_job(
  p_job_id uuid
)
returns table (
  id uuid,
  company_id uuid,
  location_id uuid,
  role_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  hourly_rate numeric,
  currency text,
  status text,
  notes text,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  applicants_count bigint,
  assignments_count bigint,
  active_assignments_count bigint,
  events jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    j.id,
    j.company_id,
    j.location_id,
    j.role_id,
    j.starts_at,
    j.ends_at,
    coalesce(j.hourly_rate, j.pay_rate) as hourly_rate,
    coalesce(j.currency, 'USD') as currency,
    j.status,
    j.notes,
    j.created_by,
    j.created_at,
    j.updated_at,
    coalesce(apps.count_all, 0) as applicants_count,
    coalesce(assigns.count_all, 0) as assignments_count,
    coalesce(assigns.count_active, 0) as active_assignments_count,
    coalesce(events.events_json, '[]'::jsonb) as events
  from public.marketplace_job_posts j
  left join lateral (
    select count(*)::bigint as count_all
    from public.marketplace_applications a
    where a.post_id = j.id
  ) apps on true
  left join lateral (
    select
      count(*)::bigint as count_all,
      count(*) filter (where ma.status = 'active')::bigint as count_active
    from public.marketplace_assignments ma
    where ma.post_id = j.id
  ) assigns on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', je.id,
        'event_type', je.event_type,
        'actor_user_id', je.actor_user_id,
        'payload', je.payload,
        'created_at', je.created_at
      )
      order by je.created_at desc
    ) as events_json
    from public.job_events je
    where je.job_id = j.id
  ) events on true
  where j.id = p_job_id
    and j.company_id = public.current_user_company_id()
    and public.is_management_user();
$$;

grant execute on function public.create_job(uuid, uuid, timestamptz, timestamptz, numeric, text, text, text) to authenticated;
grant execute on function public.update_job(uuid, uuid, uuid, timestamptz, timestamptz, numeric, text, text) to authenticated;
grant execute on function public.close_job(uuid, text) to authenticated;
grant execute on function public.cancel_job(uuid, text) to authenticated;
grant execute on function public.list_jobs(text, uuid, timestamptz, timestamptz, integer, integer) to authenticated;
grant execute on function public.get_job(uuid) to authenticated;

revoke execute on function public.create_job(uuid, uuid, timestamptz, timestamptz, numeric, text, text, text) from anon;
revoke execute on function public.update_job(uuid, uuid, uuid, timestamptz, timestamptz, numeric, text, text) from anon;
revoke execute on function public.close_job(uuid, text) from anon;
revoke execute on function public.cancel_job(uuid, text) from anon;
revoke execute on function public.list_jobs(text, uuid, timestamptz, timestamptz, integer, integer) from anon;
revoke execute on function public.get_job(uuid) from anon;
