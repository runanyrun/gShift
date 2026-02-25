-- Employee permissions hardening:
-- - keep table protected with default deny
-- - require RPC/guard access patterns instead of direct table reads

alter table public.employee_permissions enable row level security;
alter table public.employee_permissions force row level security;

revoke all on table public.employee_permissions from anon;
revoke all on table public.employee_permissions from authenticated;

-- Security-definer helper for current user's permission list.
create or replace function public.my_employee_permissions()
returns table(permission_key text)
language sql
stable
security definer
set search_path = public
as $$
  select ep.permission_key
  from public.employee_permissions ep
  join public.employees e
    on e.id = ep.employee_id
   and e.tenant_id = ep.tenant_id
  where auth.uid() is not null
    and e.user_id = auth.uid();
$$;

grant execute on function public.my_employee_permissions() to authenticated;
revoke execute on function public.my_employee_permissions() from anon;

do $$
begin
  if to_regprocedure('public.is_management_user()') is not null then
    grant execute on function public.is_management_user() to authenticated;
  end if;
end
$$;
