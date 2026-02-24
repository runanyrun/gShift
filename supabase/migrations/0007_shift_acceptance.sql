alter table public.shifts
  add column if not exists acceptance_status text not null default 'pending',
  add column if not exists responded_at timestamptz,
  add column if not exists responded_by uuid references auth.users(id) on delete set null,
  add column if not exists response_note text;

alter table public.shifts
  drop constraint if exists shifts_acceptance_status_check;

alter table public.shifts
  add constraint shifts_acceptance_status_check
  check (acceptance_status in ('pending', 'accepted', 'declined'));

create or replace function public.respond_to_shift(
  p_shift_id uuid,
  p_status text,
  p_note text default null
)
returns table(
  id uuid,
  acceptance_status text,
  responded_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid;
  v_tenant_id uuid;
  v_profile_id uuid;
  v_status text;
  v_shift public.shifts%rowtype;
begin
  v_auth_user_id := auth.uid();
  if v_auth_user_id is null then
    raise exception 'Unauthenticated request.';
  end if;

  v_tenant_id := public.current_tenant_id();
  if v_tenant_id is null then
    raise exception 'User is not connected to a tenant.';
  end if;

  if p_shift_id is null then
    raise exception 'Shift id is required.';
  end if;

  v_status := lower(trim(coalesce(p_status, '')));
  if v_status not in ('accepted', 'declined') then
    raise exception 'Invalid shift response status.';
  end if;

  select *
  into v_shift
  from public.shifts s
  where s.id = p_shift_id
  limit 1;

  if not found then
    raise exception 'Shift not found.';
  end if;

  if v_shift.company_id <> v_tenant_id then
    raise exception 'Shift is outside current tenant.';
  end if;

  if not exists (
    select 1
    from public.employees e
    where e.tenant_id = v_tenant_id
      and e.user_id = v_auth_user_id
  ) then
    raise exception 'Employee profile is not linked.';
  end if;

  select u.id
  into v_profile_id
  from public.users u
  where u.auth_user_id = v_auth_user_id
    and u.company_id = v_tenant_id
  limit 1;

  if v_profile_id is null then
    raise exception 'User profile is not linked to tenant.';
  end if;

  if v_shift.user_id <> v_profile_id then
    raise exception 'Cannot respond to another employee shift.';
  end if;

  return query
  update public.shifts
  set acceptance_status = v_status,
      responded_at = now(),
      responded_by = v_auth_user_id,
      response_note = case when nullif(trim(coalesce(p_note, '')), '') is null then null else p_note end
  where shifts.id = v_shift.id
    and shifts.company_id = v_tenant_id
  returning shifts.id, shifts.acceptance_status, shifts.responded_at;
end;
$$;

revoke all on function public.respond_to_shift(uuid, text, text) from public;
grant execute on function public.respond_to_shift(uuid, text, text) to authenticated;
