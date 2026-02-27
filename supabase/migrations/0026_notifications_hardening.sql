-- Sprint 6: Notifications hardening + UX support

create or replace function public.notification_dedupe_key(
  p_type text,
  p_payload jsonb
)
returns text
language sql
immutable
strict
set search_path = public
as $$
  with payload as (
    select coalesce(p_payload, '{}'::jsonb) as data
  ), entity as (
    select
      nullif(coalesce(data->>'job_post_id', data->>'job_id'), '') as job_post_id,
      nullif(data->>'assignment_id', '') as assignment_id,
      nullif(data->>'application_id', '') as application_id
    from payload
  )
  select
    case
      when coalesce(job_post_id, assignment_id, application_id) is null then null
      else concat_ws('|', coalesce(p_type, ''), coalesce(job_post_id, ''), coalesce(assignment_id, ''), coalesce(application_id, ''))
    end
  from entity;
$$;

revoke execute on function public.notification_dedupe_key(text, jsonb) from public;
revoke execute on function public.notification_dedupe_key(text, jsonb) from anon;
revoke execute on function public.notification_dedupe_key(text, jsonb) from authenticated;

alter table public.notifications
  add column if not exists dedupe_key text;

create or replace function public.notifications_set_dedupe_key()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.dedupe_key := public.notification_dedupe_key(new.type, new.payload);
  return new;
end;
$$;

revoke execute on function public.notifications_set_dedupe_key() from public;
revoke execute on function public.notifications_set_dedupe_key() from anon;
revoke execute on function public.notifications_set_dedupe_key() from authenticated;

drop trigger if exists trg_notifications_set_dedupe_key on public.notifications;
create trigger trg_notifications_set_dedupe_key
before insert or update of type, payload on public.notifications
for each row
execute function public.notifications_set_dedupe_key();

update public.notifications n
set dedupe_key = public.notification_dedupe_key(n.type, n.payload)
where n.dedupe_key is distinct from public.notification_dedupe_key(n.type, n.payload);

create index if not exists idx_notifications_dedupe_lookup
  on public.notifications(company_id, user_id, type, dedupe_key, created_at desc)
  where dedupe_key is not null;

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
     or new.created_at <> old.created_at
     or coalesce(new.dedupe_key, '') <> coalesce(old.dedupe_key, '') then
    raise exception 'Only read_at can be updated.';
  end if;

  if old.read_at is not null and new.read_at <> old.read_at then
    raise exception 'read_at cannot be modified once set.';
  end if;

  if old.read_at is null and new.read_at is null then
    raise exception 'read_at update requires a non-null value.';
  end if;

  return new;
end;
$$;

revoke execute on function public.notifications_guard_update() from public;
revoke execute on function public.notifications_guard_update() from anon;
revoke execute on function public.notifications_guard_update() from authenticated;

alter table public.notifications enable row level security;
alter table public.notifications force row level security;

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

drop policy if exists notifications_insert_denied on public.notifications;
create policy notifications_insert_denied
on public.notifications
for insert
to authenticated
with check (false);

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
  v_payload jsonb;
  v_dedupe_key text;
  v_dedupe_seconds integer;
begin
  if p_company_id is null then
    return 0;
  end if;

  if p_recipients is null or array_length(p_recipients, 1) is null then
    return 0;
  end if;

  v_payload := coalesce(p_payload, '{}'::jsonb);
  v_dedupe_key := public.notification_dedupe_key(p_type, v_payload);
  v_dedupe_seconds := greatest(coalesce(p_dedupe_window_seconds, 30), 0);

  for v_recipient in
    select distinct r
    from unnest(p_recipients) as r
    where r is not null
  loop
    if v_dedupe_key is null
       or v_dedupe_seconds = 0
       or not exists (
         select 1
         from public.notifications n
         where n.company_id = p_company_id
           and n.user_id = v_recipient
           and n.type = p_type
           and n.dedupe_key = v_dedupe_key
           and n.created_at > now() - make_interval(secs => v_dedupe_seconds)
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
        v_payload
      );
      v_inserted := v_inserted + 1;
    end if;
  end loop;

  return v_inserted;
end;
$$;

create or replace function public.list_notifications(
  p_limit integer default 20,
  p_cursor timestamptz default null,
  p_unread_only boolean default false
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
      and (coalesce(p_unread_only, false) = false or n.read_at is null)
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
  select public.list_notifications(p_limit, p_cursor, false);
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
  v_extra_manager_recipients uuid[];
  v_worker_recipients uuid[];
  v_worker_user_id uuid;
  v_worker_employee_id uuid;
begin
  select *
  into v_job
  from public.marketplace_job_posts p
  where p.id = new.job_id
  limit 1;

  v_manager_recipients := case when v_job.created_by is null then '{}'::uuid[] else array[v_job.created_by] end;

  select array_agg(distinct u.auth_user_id)
  into v_extra_manager_recipients
  from public.users u
  where u.company_id = new.company_id
    and u.auth_user_id is not null
    and u.role in ('owner', 'admin', 'manager');

  if v_extra_manager_recipients is not null and array_length(v_extra_manager_recipients, 1) is not null then
    select array_agg(distinct recipient)
    into v_manager_recipients
    from unnest(v_manager_recipients || v_extra_manager_recipients) as recipient
    where recipient is not null;
  end if;

  if new.event_type in ('invited', 'applicant_rejected') then
    v_worker_user_id := nullif(new.payload->>'worker_user_id', '')::uuid;
    if v_worker_user_id is null then
      v_worker_employee_id := nullif(new.payload->>'worker_employee_id', '')::uuid;
      if v_worker_employee_id is not null then
        select e.user_id
        into v_worker_user_id
        from public.employees e
        where e.id = v_worker_employee_id
          and e.tenant_id = new.company_id
        limit 1;
      end if;
    end if;
  end if;

  if new.event_type = 'applied' then
    perform public.emit_notification(
      new.company_id,
      'job_applied',
      jsonb_build_object(
        'job_post_id', new.job_id,
        'application_id', new.payload->>'application_id',
        'worker_user_id', new.payload->>'worker_user_id'
      ),
      v_manager_recipients
    );
  elsif new.event_type = 'invited' then
    perform public.emit_notification(
      new.company_id,
      'invited',
      jsonb_build_object(
        'job_post_id', new.job_id,
        'assignment_id', new.payload->>'assignment_id',
        'application_id', new.payload->>'application_id'
      ),
      case when v_worker_user_id is null then null else array[v_worker_user_id] end
    );
  elsif new.event_type = 'applicant_rejected' then
    perform public.emit_notification(
      new.company_id,
      'applicant_rejected',
      jsonb_build_object(
        'job_post_id', new.job_id,
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
        'job_post_id', new.job_id,
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
        'job_post_id', new.job_id,
        'assignment_id', new.payload->>'assignment_id',
        'application_id', new.payload->>'application_id'
      ),
      v_manager_recipients
    );
  elsif new.event_type = 'cancelled' then
    select array_agg(distinct a.worker_user_id)
    into v_worker_recipients
    from public.marketplace_applications a
    where a.company_id = new.company_id
      and a.post_id = new.job_id
      and a.worker_user_id is not null
      and a.status in ('applied', 'invited', 'accepted');

    perform public.emit_notification(
      new.company_id,
      'job_cancelled',
      jsonb_build_object(
        'job_post_id', new.job_id,
        'reason', new.payload->>'reason'
      ),
      v_worker_recipients
    );
  end if;

  return new;
end;
$$;

grant execute on function public.list_notifications(integer, timestamptz, boolean) to authenticated;
grant execute on function public.list_notifications(integer, timestamptz) to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;

revoke execute on function public.emit_notification(uuid, text, jsonb, uuid[], integer) from public;
revoke execute on function public.emit_notification(uuid, text, jsonb, uuid[], integer) from anon;
revoke execute on function public.emit_notification(uuid, text, jsonb, uuid[], integer) from authenticated;
revoke execute on function public.notify_from_job_event() from public;
revoke execute on function public.notify_from_job_event() from anon;
revoke execute on function public.notify_from_job_event() from authenticated;
revoke execute on function public.list_notifications(integer, timestamptz, boolean) from public;
revoke execute on function public.list_notifications(integer, timestamptz, boolean) from anon;
revoke execute on function public.list_notifications(integer, timestamptz) from public;
revoke execute on function public.list_notifications(integer, timestamptz) from anon;
revoke execute on function public.mark_notification_read(uuid) from public;
revoke execute on function public.mark_notification_read(uuid) from anon;
revoke execute on function public.mark_all_notifications_read() from public;
revoke execute on function public.mark_all_notifications_read() from anon;
