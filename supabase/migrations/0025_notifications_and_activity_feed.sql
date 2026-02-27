-- Sprint 5: In-app notifications + activity feed glue

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_company_user_read_created
  on public.notifications(company_id, user_id, read_at, created_at desc);

alter table public.notifications enable row level security;
alter table public.notifications force row level security;

revoke all on table public.notifications from anon;
revoke all on table public.notifications from authenticated;

drop policy if exists notifications_select_self on public.notifications;
create policy notifications_select_self
on public.notifications
for select
to authenticated
using (
  user_id = auth.uid()
  and company_id = public.current_user_company_id()
);

drop policy if exists notifications_update_self on public.notifications;
create policy notifications_update_self
on public.notifications
for update
to authenticated
using (
  user_id = auth.uid()
  and company_id = public.current_user_company_id()
)
with check (
  user_id = auth.uid()
  and company_id = public.current_user_company_id()
);

create or replace function public.notifications_guard_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.company_id <> old.company_id
     or new.user_id <> old.user_id
     or new.type <> old.type
     or new.payload <> old.payload
     or new.created_at <> old.created_at then
    raise exception 'Only read_at can be updated.';
  end if;

  if new.read_at is null then
    raise exception 'read_at cannot be reset to null.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notifications_guard_update on public.notifications;
create trigger trg_notifications_guard_update
before update on public.notifications
for each row
execute function public.notifications_guard_update();

drop policy if exists notifications_insert_denied on public.notifications;
create policy notifications_insert_denied
on public.notifications
for insert
to authenticated
with check (false);

grant select, update on table public.notifications to authenticated;

create or replace function public.emit_notification(
  p_company_id uuid,
  p_type text,
  p_payload jsonb,
  p_recipients uuid[],
  p_dedupe_window_seconds integer default 30
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer := 0;
  v_recipient uuid;
begin
  if p_company_id is null then
    return 0;
  end if;

  if p_recipients is null or array_length(p_recipients, 1) is null then
    return 0;
  end if;

  for v_recipient in
    select distinct r
    from unnest(p_recipients) as r
    where r is not null
  loop
    if not exists (
      select 1
      from public.notifications n
      where n.company_id = p_company_id
        and n.user_id = v_recipient
        and n.type = p_type
        and n.payload = coalesce(p_payload, '{}'::jsonb)
        and n.created_at > now() - make_interval(secs => greatest(coalesce(p_dedupe_window_seconds, 30), 0))
    ) then
      insert into public.notifications (
        company_id,
        user_id,
        type,
        payload
      )
      values (
        p_company_id,
        v_recipient,
        p_type,
        coalesce(p_payload, '{}'::jsonb)
      );
      v_inserted := v_inserted + 1;
    end if;
  end loop;

  return v_inserted;
end;
$$;

create or replace function public.list_notifications(
  p_limit integer default 20,
  p_cursor timestamptz default null
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select
      n.id,
      n.type,
      n.payload,
      n.read_at,
      n.created_at
    from public.notifications n
    where n.company_id = public.current_user_company_id()
      and n.user_id = auth.uid()
      and (p_cursor is null or n.created_at < p_cursor)
    order by n.created_at desc
    limit greatest(coalesce(p_limit, 20), 1)
  ),
  unread as (
    select count(*)::bigint as count_unread
    from public.notifications n
    where n.company_id = public.current_user_company_id()
      and n.user_id = auth.uid()
      and n.read_at is null
  )
  select jsonb_build_object(
    'items',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', b.id,
            'type', b.type,
            'payload', b.payload,
            'read_at', b.read_at,
            'created_at', b.created_at
          )
          order by b.created_at desc
        )
        from base b
      ),
      '[]'::jsonb
    ),
    'unread_count',
    (select count_unread from unread)
  );
$$;

create or replace function public.mark_notification_read(
  p_notification_id uuid
)
returns public.notifications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.notifications;
begin
  update public.notifications n
  set read_at = coalesce(n.read_at, now())
  where n.id = p_notification_id
    and n.company_id = public.current_user_company_id()
    and n.user_id = auth.uid()
  returning * into v_row;

  if not found then
    raise exception 'Notification not found.';
  end if;

  return v_row;
end;
$$;

create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  update public.notifications n
  set read_at = coalesce(n.read_at, now())
  where n.company_id = public.current_user_company_id()
    and n.user_id = auth.uid()
    and n.read_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.notify_from_job_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.marketplace_job_posts;
  v_manager_recipients uuid[];
  v_worker_recipients uuid[];
  v_worker_user_id uuid;
begin
  select *
  into v_job
  from public.marketplace_job_posts p
  where p.id = new.job_id
  limit 1;

  select array_agg(distinct u.auth_user_id)
  into v_manager_recipients
  from public.users u
  where u.company_id = new.company_id
    and u.auth_user_id is not null
    and u.role in ('owner', 'admin', 'manager');

  if (v_manager_recipients is null or array_length(v_manager_recipients, 1) is null)
     and v_job.created_by is not null then
    v_manager_recipients := array[v_job.created_by];
  end if;

  if new.event_type = 'applied' then
    perform public.emit_notification(
      new.company_id,
      'job_applied',
      jsonb_build_object(
        'job_id', new.job_id,
        'application_id', new.payload->>'application_id',
        'worker_user_id', new.payload->>'worker_user_id'
      ),
      v_manager_recipients
    );
  elsif new.event_type = 'invited' then
    v_worker_user_id := nullif(new.payload->>'worker_user_id', '')::uuid;
    perform public.emit_notification(
      new.company_id,
      'invited',
      jsonb_build_object(
        'job_id', new.job_id,
        'assignment_id', new.payload->>'assignment_id',
        'application_id', new.payload->>'application_id'
      ),
      case when v_worker_user_id is null then null else array[v_worker_user_id] end
    );
  elsif new.event_type = 'applicant_rejected' then
    v_worker_user_id := nullif(new.payload->>'worker_user_id', '')::uuid;
    perform public.emit_notification(
      new.company_id,
      'applicant_rejected',
      jsonb_build_object(
        'job_id', new.job_id,
        'application_id', new.payload->>'application_id',
        'reason', new.payload->>'reason'
      ),
      case when v_worker_user_id is null then null else array[v_worker_user_id] end
    );
  elsif new.event_type = 'invite_accepted' then
    perform public.emit_notification(
      new.company_id,
      'invite_accepted',
      jsonb_build_object(
        'job_id', new.job_id,
        'assignment_id', new.payload->>'assignment_id',
        'application_id', new.payload->>'application_id'
      ),
      v_manager_recipients
    );
  elsif new.event_type = 'invite_rejected' then
    perform public.emit_notification(
      new.company_id,
      'invite_rejected',
      jsonb_build_object(
        'job_id', new.job_id,
        'assignment_id', new.payload->>'assignment_id',
        'application_id', new.payload->>'application_id'
      ),
      v_manager_recipients
    );
  elsif new.event_type = 'cancelled' then
    select array_agg(distinct a.worker_user_id)
    into v_worker_recipients
    from public.marketplace_applications a
    where a.post_id = new.job_id
      and a.worker_user_id is not null;

    perform public.emit_notification(
      new.company_id,
      'job_cancelled',
      jsonb_build_object(
        'job_id', new.job_id,
        'reason', new.payload->>'reason'
      ),
      v_worker_recipients
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_from_job_event on public.job_events;
create trigger trg_notify_from_job_event
after insert on public.job_events
for each row
execute function public.notify_from_job_event();

grant execute on function public.list_notifications(integer, timestamptz) to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;

revoke execute on function public.emit_notification(uuid, text, jsonb, uuid[], integer) from anon;
revoke execute on function public.emit_notification(uuid, text, jsonb, uuid[], integer) from authenticated;
revoke execute on function public.notify_from_job_event() from anon;
revoke execute on function public.notify_from_job_event() from authenticated;
revoke execute on function public.notifications_guard_update() from anon;
revoke execute on function public.notifications_guard_update() from authenticated;
revoke execute on function public.list_notifications(integer, timestamptz) from anon;
revoke execute on function public.mark_notification_read(uuid) from anon;
revoke execute on function public.mark_all_notifications_read() from anon;
