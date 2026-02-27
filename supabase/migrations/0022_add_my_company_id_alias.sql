-- Compatibility helper:
-- Canonical function is public.current_user_company_id().
-- Keep public.my_company_id() as temporary alias for backward compatibility.
-- Follow-up: remove this alias after all application code and deployed environments
-- are fully migrated to current_user_company_id().

create or replace function public.my_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_company_id();
$$;

grant execute on function public.my_company_id() to authenticated;
revoke execute on function public.my_company_id() from anon;
