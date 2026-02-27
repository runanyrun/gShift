-- Sprint 4: Worker apply + manager review + invite/respond lifecycle

alter table public.marketplace_applications
  add column if not exists company_id uuid references public.companies(id) on delete cascade,
  add column if not exists worker_employee_id uuid references public.employees(id) on delete set null,
  add column if not exists note text;

update public.marketplace_applications ma
set company_id = p.company_id
from public.marketplace_job_posts p
where p.id = ma.post_id
  and ma.company_id is null;

alter table public.marketplace_applications
  alter column company_id set default public.current_user_company_id();

alter table public.marketplace_applications
  alter column company_id set not null;

alter table public.marketplace_applications
  drop constraint if exists marketplace_applications_status_check;

alter table public.marketplace_applications
  add constraint marketplace_applications_status_check
  check (status in ('applied', 'submitted', 'reviewing', 'rejected', 'withdrawn', 'invited', 'accepted'));

update public.marketplace_applications
set status = 'applied'
where status in ('submitted', 'reviewing');

create index if not exists idx_marketplace_applications_company_status
  on public.marketplace_applications(company_id, status, created_at desc);

create index if not exists idx_marketplace_applications_worker_employee
  on public.marketplace_applications(worker_employee_id);

alter table public.marketplace_assignments
  add column if not exists invited_at timestamptz,
  add column if not exists responded_at timestamptz,
  add column if not exists responded_by uuid references auth.users(id) on delete set null,
  add column if not exists response_note text;

update public.marketplace_assignments
set invited_at = coalesce(invited_at, created_at);

alter table public.marketplace_assignments
  alter column status set default 'pending';

alter table public.marketplace_assignments
  drop constraint if exists marketplace_assignments_status_check;

alter table public.marketplace_assignments
  add constraint marketplace_assignments_status_check
  check (status in ('pending', 'active', 'completed', 'cancelled'));

update public.marketplace_assignments
set status = 'pending'
where status not in ('pending', 'active', 'completed', 'cancelled');

alter table public.job_events
  drop constraint if exists job_events_event_type_check;

alter table public.job_events
  add constraint job_events_event_type_check
  check (
    event_type in (
      'created',
      'edited',
      'closed',
      'cancelled',
      'reopened',
      'applied',
      'applicant_rejected',
      'invited',
      'invite_accepted',
      'invite_rejected'
    )
  );

create or replace function public.list_open_jobs_for_worker(
  p_search text default null,
  p_location_id uuid default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  company_id uuid,
  title text,
  starts_at timestamptz,
  ends_at timestamptz,
  location_id uuid,
  role_id uuid,
  hourly_rate numeric,
  currency text,
  status text,
  notes text,
  application_id uuid,
  application_status text,
  has_applied boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.company_id,
    p.title,
    p.starts_at,
    p.ends_at,
    p.location_id,
    p.role_id,
    coalesce(p.hourly_rate, p.pay_rate) as hourly_rate,
    coalesce(p.currency, 'USD') as currency,
    p.status,
    p.notes,
    a.id as application_id,
    a.status as application_status,
    (a.id is not null) as has_applied
  from public.marketplace_job_posts p
  left join lateral (
    select ma.id, ma.status
    from public.marketplace_applications ma
    where ma.post_id = p.id
      and ma.worker_user_id = auth.uid()
    order by ma.created_at desc
    limit 1
  ) a on true
  where p.company_id = public.current_user_company_id()
    and p.status = 'open'
    and (p_location_id is null or p.location_id = p_location_id)
    and (
      p_search is null
      or trim(p_search) = ''
      or p.title ilike ('%' || trim(p_search) || '%')
    )
  order by p.starts_at asc
  limit greatest(coalesce(p_limit, 50), 1)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.get_open_job_for_worker(
  p_job_id uuid
)
returns table (
  id uuid,
  company_id uuid,
  title text,
  starts_at timestamptz,
  ends_at timestamptz,
  location_id uuid,
  role_id uuid,
  hourly_rate numeric,
  currency text,
  status text,
  notes text,
  application_id uuid,
  application_status text,
  has_applied boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.company_id,
    p.title,
    p.starts_at,
    p.ends_at,
    p.location_id,
    p.role_id,
    coalesce(p.hourly_rate, p.pay_rate) as hourly_rate,
    coalesce(p.currency, 'USD') as currency,
    p.status,
    p.notes,
    a.id as application_id,
    a.status as application_status,
    (a.id is not null) as has_applied
  from public.marketplace_job_posts p
  left join lateral (
    select ma.id, ma.status
    from public.marketplace_applications ma
    where ma.post_id = p.id
      and ma.worker_user_id = auth.uid()
    order by ma.created_at desc
    limit 1
  ) a on true
  where p.id = p_job_id
    and p.company_id = public.current_user_company_id()
    and p.status in ('open', 'assigned');
$$;

create or replace function public.apply_to_job(
  p_job_id uuid,
  p_note text default null
)
returns table (
  application_id uuid,
  status text,
  already_applied boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_actor uuid;
  v_employee_id uuid;
  v_post public.marketplace_job_posts;
  v_app public.marketplace_applications;
  v_changed boolean := false;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'Unauthorized';
  end if;

  v_company_id := public.current_user_company_id();

  select e.id
  into v_employee_id
  from public.employees e
  where e.tenant_id = v_company_id
    and e.user_id = v_actor
  limit 1;

  if v_employee_id is null then
    raise exception 'Employee profile required to apply.';
  end if;

  select *
  into v_post
  from public.marketplace_job_posts p
  where p.id = p_job_id
    and p.company_id = v_company_id
  for update;

  if not found then
    raise exception 'Job not found.';
  end if;

  if v_post.status <> 'open' then
    raise exception 'Only open jobs accept applications.';
  end if;

  select *
  into v_app
  from public.marketplace_applications ma
  where ma.post_id = p_job_id
    and ma.worker_user_id = v_actor
  for update;

  if found then
    if v_app.status in ('applied', 'submitted', 'reviewing', 'invited', 'accepted') then
      return query select v_app.id, v_app.status, true;
      return;
    end if;

    update public.marketplace_applications
    set
      company_id = v_company_id,
      worker_employee_id = v_employee_id,
      status = 'applied',
      note = nullif(trim(coalesce(p_note, '')), ''),
      updated_at = now()
    where id = v_app.id
    returning * into v_app;
    v_changed := true;
  else
    insert into public.marketplace_applications (
      company_id,
      post_id,
      worker_user_id,
      worker_employee_id,
      status,
      note
    )
    values (
      v_company_id,
      p_job_id,
      v_actor,
      v_employee_id,
      'applied',
      nullif(trim(coalesce(p_note, '')), '')
    )
    returning * into v_app;
    v_changed := true;
  end if;

  if v_changed then
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
      'applied',
      jsonb_build_object(
        'application_id', v_app.id,
        'worker_user_id', v_actor,
        'worker_employee_id', v_employee_id
      )
    );
  end if;

  return query select v_app.id, v_app.status, false;
end;
$$;

create or replace function public.list_my_applications()
returns table (
  application_id uuid,
  job_id uuid,
  title text,
  starts_at timestamptz,
  ends_at timestamptz,
  location_id uuid,
  role_id uuid,
  application_status text,
  note text,
  applied_at timestamptz,
  updated_at timestamptz,
  invitation_id uuid,
  invitation_status text,
  invited_at timestamptz,
  responded_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id as application_id,
    p.id as job_id,
    p.title,
    p.starts_at,
    p.ends_at,
    p.location_id,
    p.role_id,
    a.status as application_status,
    a.note,
    a.created_at as applied_at,
    a.updated_at,
    m.id as invitation_id,
    m.status as invitation_status,
    m.invited_at,
    m.responded_at
  from public.marketplace_applications a
  join public.marketplace_job_posts p
    on p.id = a.post_id
  left join public.marketplace_assignments m
    on m.post_id = a.post_id
   and m.worker_user_id = a.worker_user_id
  where a.company_id = public.current_user_company_id()
    and a.worker_user_id = auth.uid()
  order by a.created_at desc;
$$;

create or replace function public.list_applicants_for_job(
  p_job_id uuid
)
returns table (
  application_id uuid,
  worker_id uuid,
  worker_user_id uuid,
  worker_name text,
  worker_email text,
  status text,
  note text,
  created_at timestamptz,
  invitation_id uuid,
  invitation_status text,
  invited_at timestamptz,
  responded_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id as application_id,
    a.worker_employee_id as worker_id,
    a.worker_user_id,
    coalesce(e.first_name || ' ' || e.last_name, e.email, a.worker_user_id::text) as worker_name,
    coalesce(e.email, u.email) as worker_email,
    a.status,
    a.note,
    a.created_at,
    m.id as invitation_id,
    m.status as invitation_status,
    m.invited_at,
    m.responded_at
  from public.marketplace_applications a
  join public.marketplace_job_posts p
    on p.id = a.post_id
  left join public.employees e
    on e.id = a.worker_employee_id
  left join auth.users u
    on u.id = a.worker_user_id
  left join public.marketplace_assignments m
    on m.post_id = a.post_id
   and m.worker_user_id = a.worker_user_id
  where public.is_management_user()
    and p.company_id = public.current_user_company_id()
    and a.company_id = public.current_user_company_id()
    and a.post_id = p_job_id
  order by a.created_at desc;
$$;

create or replace function public.reject_applicant(
  p_job_id uuid,
  p_worker_id uuid,
  p_reason text default null
)
returns table (
  application_id uuid,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_actor uuid;
  v_worker_user_id uuid;
  v_app public.marketplace_applications;
begin
  if not public.is_management_user() then
    raise exception 'no-permission';
  end if;

  v_company_id := public.current_user_company_id();
  v_actor := auth.uid();

  select e.user_id
  into v_worker_user_id
  from public.employees e
  where e.id = p_worker_id
    and e.tenant_id = v_company_id
  limit 1;

  if v_worker_user_id is null then
    raise exception 'Worker not found in active company.';
  end if;

  select *
  into v_app
  from public.marketplace_applications a
  where a.company_id = v_company_id
    and a.post_id = p_job_id
    and a.worker_user_id = v_worker_user_id
  for update;

  if not found then
    raise exception 'Application not found.';
  end if;

  if v_app.status = 'rejected' then
    return query select v_app.id, v_app.status;
    return;
  end if;

  if v_app.status = 'accepted' then
    raise exception 'Accepted application cannot be rejected.';
  end if;

  update public.marketplace_applications
  set
    status = 'rejected',
    updated_at = now()
  where id = v_app.id
  returning * into v_app;

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
    'applicant_rejected',
    jsonb_build_object(
      'application_id', v_app.id,
      'worker_user_id', v_worker_user_id,
      'reason', nullif(trim(coalesce(p_reason, '')), '')
    )
  );

  return query select v_app.id, v_app.status;
end;
$$;

create or replace function public.invite_applicant(
  p_job_id uuid,
  p_worker_id uuid,
  p_note text default null
)
returns public.marketplace_assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_actor uuid;
  v_post public.marketplace_job_posts;
  v_worker_user_id uuid;
  v_app public.marketplace_applications;
  v_assignment public.marketplace_assignments;
begin
  if not public.is_management_user() then
    raise exception 'no-permission';
  end if;

  v_company_id := public.current_user_company_id();
  v_actor := auth.uid();

  select *
  into v_post
  from public.marketplace_job_posts p
  where p.id = p_job_id
    and p.company_id = v_company_id
  for update;

  if not found then
    raise exception 'Job not found.';
  end if;

  if v_post.status <> 'open' then
    raise exception 'Only open jobs can send invites.';
  end if;

  select e.user_id
  into v_worker_user_id
  from public.employees e
  where e.id = p_worker_id
    and e.tenant_id = v_company_id
  limit 1;

  if v_worker_user_id is null then
    raise exception 'Worker not found in active company.';
  end if;

  select *
  into v_app
  from public.marketplace_applications a
  where a.company_id = v_company_id
    and a.post_id = p_job_id
    and a.worker_user_id = v_worker_user_id
  for update;

  if not found then
    raise exception 'Application not found for worker.';
  end if;

  if v_app.status = 'rejected' or v_app.status = 'withdrawn' then
    raise exception 'Cannot invite a rejected or withdrawn application.';
  end if;

  select *
  into v_assignment
  from public.marketplace_assignments m
  where m.post_id = p_job_id
  for update;

  if found then
    if v_assignment.worker_user_id <> v_worker_user_id and v_assignment.status in ('pending', 'active', 'completed') then
      raise exception 'Job already has another worker invite/assignment.';
    end if;

    update public.marketplace_assignments
    set
      worker_user_id = v_worker_user_id,
      status = 'pending',
      invited_at = now(),
      responded_at = null,
      responded_by = null,
      response_note = nullif(trim(coalesce(p_note, '')), ''),
      updated_at = now()
    where id = v_assignment.id
    returning * into v_assignment;
  else
    insert into public.marketplace_assignments (
      post_id,
      worker_user_id,
      company_id,
      starts_at,
      ends_at,
      status,
      invited_at,
      response_note
    )
    values (
      p_job_id,
      v_worker_user_id,
      v_company_id,
      v_post.starts_at,
      v_post.ends_at,
      'pending',
      now(),
      nullif(trim(coalesce(p_note, '')), '')
    )
    returning * into v_assignment;
  end if;

  update public.marketplace_applications
  set
    status = 'invited',
    updated_at = now()
  where id = v_app.id
  returning * into v_app;

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
    'invited',
    jsonb_build_object(
      'application_id', v_app.id,
      'worker_id', p_worker_id,
      'worker_user_id', v_worker_user_id,
      'assignment_id', v_assignment.id,
      'note', nullif(trim(coalesce(p_note, '')), '')
    )
  );

  return v_assignment;
end;
$$;

create or replace function public.respond_invite(
  p_invite_id uuid,
  p_decision text,
  p_note text default null
)
returns public.marketplace_assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_company_id uuid;
  v_assignment public.marketplace_assignments;
  v_post public.marketplace_job_posts;
  v_app public.marketplace_applications;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'Unauthorized';
  end if;

  if p_decision not in ('accept', 'reject') then
    raise exception 'Decision must be accept or reject.';
  end if;

  v_company_id := public.current_user_company_id();

  select *
  into v_assignment
  from public.marketplace_assignments m
  where m.id = p_invite_id
    and m.worker_user_id = v_actor
    and m.company_id = v_company_id
  for update;

  if not found then
    raise exception 'Invite not found.';
  end if;

  select *
  into v_post
  from public.marketplace_job_posts p
  where p.id = v_assignment.post_id
    and p.company_id = v_company_id
  for update;

  if not found then
    raise exception 'Job not found.';
  end if;

  select *
  into v_app
  from public.marketplace_applications a
  where a.post_id = v_assignment.post_id
    and a.worker_user_id = v_actor
    and a.company_id = v_company_id
  for update;

  if p_decision = 'accept' then
    if v_assignment.status = 'active' then
      return v_assignment;
    end if;
    if v_assignment.status <> 'pending' then
      raise exception 'Only pending invites can be accepted.';
    end if;

    update public.marketplace_assignments
    set
      status = 'active',
      responded_at = now(),
      responded_by = v_actor,
      response_note = nullif(trim(coalesce(p_note, '')), ''),
      updated_at = now()
    where id = v_assignment.id
    returning * into v_assignment;

    if found then
      update public.marketplace_applications
      set status = 'accepted', updated_at = now()
      where id = v_app.id;
    end if;

    update public.marketplace_job_posts
    set status = 'assigned', updated_at = now()
    where id = v_assignment.post_id;

    insert into public.job_events (
      company_id,
      job_id,
      actor_user_id,
      event_type,
      payload
    )
    values (
      v_company_id,
      v_assignment.post_id,
      v_actor,
      'invite_accepted',
      jsonb_build_object(
        'assignment_id', v_assignment.id,
        'application_id', v_app.id,
        'note', nullif(trim(coalesce(p_note, '')), '')
      )
    );
  else
    if v_assignment.status = 'cancelled' and v_assignment.responded_at is not null then
      return v_assignment;
    end if;
    if v_assignment.status <> 'pending' then
      raise exception 'Only pending invites can be rejected.';
    end if;

    update public.marketplace_assignments
    set
      status = 'cancelled',
      responded_at = now(),
      responded_by = v_actor,
      response_note = nullif(trim(coalesce(p_note, '')), ''),
      updated_at = now()
    where id = v_assignment.id
    returning * into v_assignment;

    if found then
      update public.marketplace_applications
      set status = 'rejected', updated_at = now()
      where id = v_app.id;
    end if;

    update public.marketplace_job_posts
    set status = 'open', updated_at = now()
    where id = v_assignment.post_id
      and status = 'assigned';

    insert into public.job_events (
      company_id,
      job_id,
      actor_user_id,
      event_type,
      payload
    )
    values (
      v_company_id,
      v_assignment.post_id,
      v_actor,
      'invite_rejected',
      jsonb_build_object(
        'assignment_id', v_assignment.id,
        'application_id', v_app.id,
        'note', nullif(trim(coalesce(p_note, '')), '')
      )
    );
  end if;

  return v_assignment;
end;
$$;

grant execute on function public.list_open_jobs_for_worker(text, uuid, integer, integer) to authenticated;
grant execute on function public.get_open_job_for_worker(uuid) to authenticated;
grant execute on function public.apply_to_job(uuid, text) to authenticated;
grant execute on function public.list_my_applications() to authenticated;
grant execute on function public.list_applicants_for_job(uuid) to authenticated;
grant execute on function public.reject_applicant(uuid, uuid, text) to authenticated;
grant execute on function public.invite_applicant(uuid, uuid, text) to authenticated;
grant execute on function public.respond_invite(uuid, text, text) to authenticated;

revoke execute on function public.list_open_jobs_for_worker(text, uuid, integer, integer) from anon;
revoke execute on function public.get_open_job_for_worker(uuid) from anon;
revoke execute on function public.apply_to_job(uuid, text) from anon;
revoke execute on function public.list_my_applications() from anon;
revoke execute on function public.list_applicants_for_job(uuid) from anon;
revoke execute on function public.reject_applicant(uuid, uuid, text) from anon;
revoke execute on function public.invite_applicant(uuid, uuid, text) from anon;
revoke execute on function public.respond_invite(uuid, text, text) from anon;
