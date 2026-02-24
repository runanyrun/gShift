-- Dependencies:
-- - public.current_tenant_id()
-- - public.users(auth_user_id, company_id, role)
-- - public.employees(user_id, tenant_id, id)
-- - public.employee_permissions(employee_id, tenant_id, permission_key)
-- Usage:
-- - Called by API guards with end-user JWT (anon client + bearer token/cookie session).
-- - Returns false for unauthenticated callers.
create or replace function public.is_management_user()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select
    case
      when auth.uid() is null then false
      else (
        exists (
          select 1
          from public.users u
          where u.auth_user_id = auth.uid()
            and u.company_id = public.current_tenant_id()
            and u.role in ('owner', 'admin', 'manager')
        )
        or exists (
          select 1
          from public.employees e
          join public.employee_permissions ep
            on ep.employee_id = e.id
           and ep.tenant_id = e.tenant_id
          where e.user_id = auth.uid()
            and e.tenant_id = public.current_tenant_id()
            and ep.permission_key in ('administration', 'management')
        )
      )
    end;
$$;

grant execute on function public.is_management_user() to authenticated;
