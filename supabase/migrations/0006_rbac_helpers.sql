create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_company_id();
$$;

grant execute on function public.current_tenant_id() to authenticated;

create or replace function public.has_permission(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.employees e
    join public.employee_permissions ep
      on ep.employee_id = e.id
     and ep.tenant_id = e.tenant_id
    where e.user_id = auth.uid()
      and e.tenant_id = public.current_tenant_id()
      and ep.permission_key = p_key
  );
$$;

grant execute on function public.has_permission(text) to authenticated;

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
      and u.company_id = public.current_tenant_id()
      and u.role in ('owner', 'admin', 'manager')
  )
  or public.has_permission('management')
  or public.has_permission('administration');
$$;

grant execute on function public.is_management_user() to authenticated;

create or replace function public.is_administration_user()
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
      and u.company_id = public.current_tenant_id()
      and u.role in ('owner', 'admin')
  )
  or public.has_permission('administration');
$$;

grant execute on function public.is_administration_user() to authenticated;

drop policy if exists job_titles_insert_management on public.job_titles;
drop policy if exists job_titles_update_management on public.job_titles;
drop policy if exists job_titles_delete_management on public.job_titles;

create policy job_titles_insert_management
on public.job_titles
for insert
to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and (
    public.is_management_user()
    or public.is_administration_user()
  )
);

create policy job_titles_update_management
on public.job_titles
for update
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and (
    public.is_management_user()
    or public.is_administration_user()
  )
)
with check (
  tenant_id = public.current_tenant_id()
  and (
    public.is_management_user()
    or public.is_administration_user()
  )
);

create policy job_titles_delete_management
on public.job_titles
for delete
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and (
    public.is_management_user()
    or public.is_administration_user()
  )
);

drop policy if exists departments_insert_management on public.departments;
drop policy if exists departments_update_management on public.departments;
drop policy if exists departments_delete_management on public.departments;

create policy departments_insert_management
on public.departments
for insert
to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and (
    public.is_management_user()
    or public.is_administration_user()
  )
);

create policy departments_update_management
on public.departments
for update
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and (
    public.is_management_user()
    or public.is_administration_user()
  )
)
with check (
  tenant_id = public.current_tenant_id()
  and (
    public.is_management_user()
    or public.is_administration_user()
  )
);

create policy departments_delete_management
on public.departments
for delete
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and (
    public.is_management_user()
    or public.is_administration_user()
  )
);

drop policy if exists locations_insert_management on public.locations;
drop policy if exists locations_update_management on public.locations;
drop policy if exists locations_delete_management on public.locations;

create policy locations_insert_management
on public.locations
for insert
to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and (
    public.is_management_user()
    or public.is_administration_user()
  )
);

create policy locations_update_management
on public.locations
for update
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and (
    public.is_management_user()
    or public.is_administration_user()
  )
)
with check (
  tenant_id = public.current_tenant_id()
  and (
    public.is_management_user()
    or public.is_administration_user()
  )
);

create policy locations_delete_management
on public.locations
for delete
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and (
    public.is_management_user()
    or public.is_administration_user()
  )
);

drop policy if exists employees_insert_management on public.employees;
drop policy if exists employees_update_management on public.employees;
drop policy if exists employees_delete_management on public.employees;

create policy employees_insert_management
on public.employees
for insert
to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and (
    public.is_management_user()
    or public.is_administration_user()
  )
);

create policy employees_update_management
on public.employees
for update
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and (
    public.is_management_user()
    or public.is_administration_user()
  )
)
with check (
  tenant_id = public.current_tenant_id()
  and (
    public.is_management_user()
    or public.is_administration_user()
  )
);

create policy employees_delete_management
on public.employees
for delete
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and (
    public.is_management_user()
    or public.is_administration_user()
  )
);

drop policy if exists employee_locations_insert_management on public.employee_locations;
drop policy if exists employee_locations_delete_management on public.employee_locations;

create policy employee_locations_insert_management
on public.employee_locations
for insert
to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and (
    public.is_management_user()
    or public.is_administration_user()
  )
);

create policy employee_locations_delete_management
on public.employee_locations
for delete
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and (
    public.is_management_user()
    or public.is_administration_user()
  )
);

drop policy if exists employee_permissions_insert_management on public.employee_permissions;
drop policy if exists employee_permissions_delete_management on public.employee_permissions;

create policy employee_permissions_insert_management
on public.employee_permissions
for insert
to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and (
    public.is_management_user()
    or public.is_administration_user()
  )
);

create policy employee_permissions_delete_management
on public.employee_permissions
for delete
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and (
    public.is_management_user()
    or public.is_administration_user()
  )
);

drop policy if exists employee_invites_insert_management on public.employee_invites;
drop policy if exists employee_invites_update_management on public.employee_invites;
drop policy if exists employee_invites_delete_management on public.employee_invites;

create policy employee_invites_insert_management
on public.employee_invites
for insert
to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and (
    public.is_management_user()
    or public.is_administration_user()
  )
);

create policy employee_invites_update_management
on public.employee_invites
for update
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and (
    public.is_management_user()
    or public.is_administration_user()
  )
)
with check (
  tenant_id = public.current_tenant_id()
  and (
    public.is_management_user()
    or public.is_administration_user()
  )
);

create policy employee_invites_delete_management
on public.employee_invites
for delete
to authenticated
using (
  tenant_id = public.current_tenant_id()
  and (
    public.is_management_user()
    or public.is_administration_user()
  )
);

