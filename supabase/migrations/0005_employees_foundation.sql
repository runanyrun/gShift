create table if not exists public.job_titles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone1 text,
  phone2 text,
  gender text,
  birth_date date,
  is_active boolean not null default true,
  job_title_id uuid references public.job_titles(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  start_date date,
  end_date date,
  payroll_id text,
  default_break_minutes integer,
  default_shift_hours numeric,
  notes text,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.employee_locations (
  tenant_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (tenant_id, employee_id, location_id)
);

create table if not exists public.employee_invites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  status text not null check (status in ('pending', 'accepted', 'revoked', 'expired')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.employee_permissions (
  tenant_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  permission_key text not null check (
    permission_key in (
      'administration',
      'management',
      'report_management',
      'time_off_management',
      'timesheet_management'
    )
  ),
  created_at timestamptz not null default now(),
  primary key (tenant_id, employee_id, permission_key)
);

create index if not exists idx_job_titles_tenant_id on public.job_titles(tenant_id);
create index if not exists idx_departments_tenant_id on public.departments(tenant_id);
create index if not exists idx_locations_tenant_id on public.locations(tenant_id);
create index if not exists idx_employees_tenant_id on public.employees(tenant_id);
create index if not exists idx_employees_user_id on public.employees(user_id);
create unique index if not exists employees_tenant_email_uq on public.employees(tenant_id, lower(email));
create index if not exists idx_employee_locations_employee on public.employee_locations(employee_id);
create index if not exists idx_employee_invites_employee on public.employee_invites(employee_id);
create index if not exists idx_employee_invites_status on public.employee_invites(status);
create index if not exists idx_employee_permissions_employee on public.employee_permissions(employee_id);

create or replace function public.is_management_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.auth_user_id = auth.uid()
      and u.company_id = public.current_user_company_id()
      and u.role in ('owner', 'admin', 'manager')
  );
$$;

grant execute on function public.is_management_user() to authenticated;

create or replace function public.get_my_employee()
returns table(
  id uuid,
  tenant_id uuid,
  first_name text,
  last_name text,
  email text,
  phone1 text,
  phone2 text,
  gender text,
  birth_date date,
  is_active boolean,
  job_title_id uuid,
  department_id uuid,
  start_date date,
  end_date date,
  payroll_id text,
  default_break_minutes integer,
  default_shift_hours numeric,
  notes text,
  user_id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id,
    e.tenant_id,
    e.first_name,
    e.last_name,
    e.email,
    e.phone1,
    e.phone2,
    e.gender,
    e.birth_date,
    e.is_active,
    e.job_title_id,
    e.department_id,
    e.start_date,
    e.end_date,
    e.payroll_id,
    e.default_break_minutes,
    e.default_shift_hours,
    null::text as notes,
    e.user_id,
    e.created_at,
    e.updated_at
  from public.employees e
  where e.tenant_id = public.current_user_company_id()
    and e.user_id = auth.uid()
  limit 1;
$$;

grant execute on function public.get_my_employee() to authenticated;

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
begin
  v_auth_user_id := auth.uid();
  if v_auth_user_id is null then
    raise exception 'Unauthenticated request.';
  end if;

  if coalesce(trim(p_raw_token), '') = '' then
    raise exception 'Invite token is required.';
  end if;

  v_hash := encode(digest(p_raw_token, 'sha256'), 'hex');

  select *
  into v_invite
  from public.employee_invites ei
  where ei.token_hash = v_hash
  limit 1;

  if not found then
    raise exception 'Invalid invite token.';
  end if;

  if v_invite.status <> 'pending' then
    raise exception 'Invite is not pending.';
  end if;

  if v_invite.expires_at <= now() then
    update public.employee_invites
    set status = 'expired'
    where id = v_invite.id;
    raise exception 'Invite has expired.';
  end if;

  select *
  into v_employee
  from public.employees e
  where e.id = v_invite.employee_id
    and e.tenant_id = v_invite.tenant_id
  limit 1;

  if not found then
    raise exception 'Employee for invite was not found.';
  end if;

  if v_employee.user_id is not null and v_employee.user_id <> v_auth_user_id then
    raise exception 'Employee is already linked to another user.';
  end if;

  select *
  into v_existing_user
  from public.users u
  where u.auth_user_id = v_auth_user_id
  limit 1;

  if found and v_existing_user.company_id <> v_invite.tenant_id then
    raise exception 'Authenticated user belongs to another tenant.';
  end if;

  if not found then
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
  where id = v_invite.id;

  return query
  select v_employee.id, v_invite.tenant_id;
end;
$$;

revoke all on function public.accept_employee_invite(text) from public;
grant execute on function public.accept_employee_invite(text) to authenticated;

alter table public.job_titles enable row level security;
alter table public.departments enable row level security;
alter table public.locations enable row level security;
alter table public.employees enable row level security;
alter table public.employee_locations enable row level security;
alter table public.employee_invites enable row level security;
alter table public.employee_permissions enable row level security;

drop policy if exists job_titles_select_tenant on public.job_titles;
drop policy if exists job_titles_insert_management on public.job_titles;
drop policy if exists job_titles_update_management on public.job_titles;
drop policy if exists job_titles_delete_management on public.job_titles;

create policy job_titles_select_tenant
on public.job_titles
for select
to authenticated
using (tenant_id = public.current_user_company_id());

create policy job_titles_insert_management
on public.job_titles
for insert
to authenticated
with check (
  tenant_id = public.current_user_company_id()
  and public.is_management_user()
);

create policy job_titles_update_management
on public.job_titles
for update
to authenticated
using (
  tenant_id = public.current_user_company_id()
  and public.is_management_user()
)
with check (
  tenant_id = public.current_user_company_id()
  and public.is_management_user()
);

create policy job_titles_delete_management
on public.job_titles
for delete
to authenticated
using (
  tenant_id = public.current_user_company_id()
  and public.is_management_user()
);

drop policy if exists departments_select_tenant on public.departments;
drop policy if exists departments_insert_management on public.departments;
drop policy if exists departments_update_management on public.departments;
drop policy if exists departments_delete_management on public.departments;

create policy departments_select_tenant
on public.departments
for select
to authenticated
using (tenant_id = public.current_user_company_id());

create policy departments_insert_management
on public.departments
for insert
to authenticated
with check (
  tenant_id = public.current_user_company_id()
  and public.is_management_user()
);

create policy departments_update_management
on public.departments
for update
to authenticated
using (
  tenant_id = public.current_user_company_id()
  and public.is_management_user()
)
with check (
  tenant_id = public.current_user_company_id()
  and public.is_management_user()
);

create policy departments_delete_management
on public.departments
for delete
to authenticated
using (
  tenant_id = public.current_user_company_id()
  and public.is_management_user()
);

drop policy if exists locations_select_tenant on public.locations;
drop policy if exists locations_insert_management on public.locations;
drop policy if exists locations_update_management on public.locations;
drop policy if exists locations_delete_management on public.locations;

create policy locations_select_tenant
on public.locations
for select
to authenticated
using (tenant_id = public.current_user_company_id());

create policy locations_insert_management
on public.locations
for insert
to authenticated
with check (
  tenant_id = public.current_user_company_id()
  and public.is_management_user()
);

create policy locations_update_management
on public.locations
for update
to authenticated
using (
  tenant_id = public.current_user_company_id()
  and public.is_management_user()
)
with check (
  tenant_id = public.current_user_company_id()
  and public.is_management_user()
);

create policy locations_delete_management
on public.locations
for delete
to authenticated
using (
  tenant_id = public.current_user_company_id()
  and public.is_management_user()
);

drop policy if exists employees_select_management on public.employees;
drop policy if exists employees_select_self on public.employees;
drop policy if exists employees_insert_management on public.employees;
drop policy if exists employees_update_management on public.employees;
drop policy if exists employees_delete_management on public.employees;

create policy employees_select_management
on public.employees
for select
to authenticated
using (
  tenant_id = public.current_user_company_id()
  and public.is_management_user()
);

create policy employees_select_self
on public.employees
for select
to authenticated
using (
  tenant_id = public.current_user_company_id()
  and user_id = auth.uid()
);

create policy employees_insert_management
on public.employees
for insert
to authenticated
with check (
  tenant_id = public.current_user_company_id()
  and public.is_management_user()
);

create policy employees_update_management
on public.employees
for update
to authenticated
using (
  tenant_id = public.current_user_company_id()
  and public.is_management_user()
)
with check (
  tenant_id = public.current_user_company_id()
  and public.is_management_user()
);

create policy employees_delete_management
on public.employees
for delete
to authenticated
using (
  tenant_id = public.current_user_company_id()
  and public.is_management_user()
);

drop policy if exists employee_locations_select_tenant on public.employee_locations;
drop policy if exists employee_locations_insert_management on public.employee_locations;
drop policy if exists employee_locations_delete_management on public.employee_locations;

create policy employee_locations_select_tenant
on public.employee_locations
for select
to authenticated
using (tenant_id = public.current_user_company_id());

create policy employee_locations_insert_management
on public.employee_locations
for insert
to authenticated
with check (
  tenant_id = public.current_user_company_id()
  and public.is_management_user()
);

create policy employee_locations_delete_management
on public.employee_locations
for delete
to authenticated
using (
  tenant_id = public.current_user_company_id()
  and public.is_management_user()
);

drop policy if exists employee_permissions_select_tenant on public.employee_permissions;
drop policy if exists employee_permissions_insert_management on public.employee_permissions;
drop policy if exists employee_permissions_delete_management on public.employee_permissions;

create policy employee_permissions_select_tenant
on public.employee_permissions
for select
to authenticated
using (
  tenant_id = public.current_user_company_id()
  and (
    public.is_management_user()
    or exists (
      select 1
      from public.employees e
      where e.id = employee_id
        and e.tenant_id = tenant_id
        and e.user_id = auth.uid()
    )
  )
);

create policy employee_permissions_insert_management
on public.employee_permissions
for insert
to authenticated
with check (
  tenant_id = public.current_user_company_id()
  and public.is_management_user()
);

create policy employee_permissions_delete_management
on public.employee_permissions
for delete
to authenticated
using (
  tenant_id = public.current_user_company_id()
  and public.is_management_user()
);

drop policy if exists employee_invites_select_management on public.employee_invites;
drop policy if exists employee_invites_insert_management on public.employee_invites;
drop policy if exists employee_invites_update_management on public.employee_invites;
drop policy if exists employee_invites_delete_management on public.employee_invites;

create policy employee_invites_select_management
on public.employee_invites
for select
to authenticated
using (
  tenant_id = public.current_user_company_id()
  and public.is_management_user()
);

create policy employee_invites_insert_management
on public.employee_invites
for insert
to authenticated
with check (
  tenant_id = public.current_user_company_id()
  and public.is_management_user()
);

create policy employee_invites_update_management
on public.employee_invites
for update
to authenticated
using (
  tenant_id = public.current_user_company_id()
  and public.is_management_user()
)
with check (
  tenant_id = public.current_user_company_id()
  and public.is_management_user()
);

create policy employee_invites_delete_management
on public.employee_invites
for delete
to authenticated
using (
  tenant_id = public.current_user_company_id()
  and public.is_management_user()
);
