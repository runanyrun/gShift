-- Invite acceptance hardening for single-tenant pointer model.
-- users.company_id is the only active tenant pointer for now.
-- Behavior:
-- - users.company_id is null  -> set to invite tenant on accept
-- - users.company_id differs  -> reject with user-already-in-company
-- - same tenant + already accepted invite -> idempotent success
create or replace function public.accept_employee_invite(p_raw_token text)
returns table(employee_id uuid, tenant_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid;
  v_hash text;
  v_invite public.employee_invites%rowtype;
  v_employee public.employees%rowtype;
  v_existing_user public.users%rowtype;
  v_has_user boolean := false;
begin
  v_auth_user_id := auth.uid();
  if v_auth_user_id is null then
    raise exception 'Unauthenticated request.';
  end if;

  if coalesce(trim(p_raw_token), '') = '' then
    raise exception using errcode = 'P0001', message = 'invite-invalid';
  end if;

  v_hash := encode(digest(p_raw_token, 'sha256'), 'hex');

  select *
  into v_invite
  from public.employee_invites ei
  where ei.token_hash = v_hash
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'invite-invalid';
  end if;

  if v_invite.expires_at <= now() then
    update public.employee_invites
    set status = 'expired'
    where id = v_invite.id
      and status = 'pending';
    raise exception using errcode = 'P0001', message = 'invite-expired';
  end if;

  select *
  into v_employee
  from public.employees e
  where e.id = v_invite.employee_id
    and e.tenant_id = v_invite.tenant_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'invite-invalid';
  end if;

  select *
  into v_existing_user
  from public.users u
  where u.auth_user_id = v_auth_user_id
  for update;
  v_has_user := found;

  if v_has_user and v_existing_user.company_id <> v_invite.tenant_id then
    raise exception using errcode = 'P0001', message = 'user-already-in-company';
  end if;

  if v_invite.status = 'accepted' then
    if v_employee.user_id is not null and v_employee.user_id <> v_auth_user_id then
      raise exception using errcode = 'P0001', message = 'invite-already-claimed';
    end if;

    if v_employee.user_id is distinct from v_auth_user_id then
      update public.employees
      set user_id = v_auth_user_id,
          updated_at = now()
      where id = v_employee.id
        and tenant_id = v_invite.tenant_id;
    end if;

    if not v_has_user then
      insert into public.users (
        auth_user_id,
        company_id,
        email,
        first_name,
        last_name,
        role,
        created_at
      )
      values (
        v_auth_user_id,
        v_invite.tenant_id,
        lower(trim(v_invite.email)),
        v_employee.first_name,
        v_employee.last_name,
        'employee',
        now()
      );
    end if;

    return query
    select v_employee.id, v_invite.tenant_id;
    return;
  end if;

  if v_invite.status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'invite-not-pending';
  end if;

  if v_employee.user_id is not null and v_employee.user_id <> v_auth_user_id then
    raise exception using errcode = 'P0001', message = 'invite-already-claimed';
  end if;

  if not v_has_user then
    insert into public.users (
      auth_user_id,
      company_id,
      email,
      first_name,
      last_name,
      role,
      created_at
    )
    values (
      v_auth_user_id,
      v_invite.tenant_id,
      lower(trim(v_invite.email)),
      v_employee.first_name,
      v_employee.last_name,
      'employee',
      now()
    );
  end if;

  update public.employees
  set user_id = v_auth_user_id,
      updated_at = now()
  where id = v_employee.id
    and tenant_id = v_invite.tenant_id;

  update public.employee_invites
  set status = 'accepted'
  where id = v_invite.id
    and status = 'pending';

  return query
  select v_employee.id, v_invite.tenant_id;
end;
$$;

revoke all on function public.accept_employee_invite(text) from public;
grant execute on function public.accept_employee_invite(text) to authenticated;
