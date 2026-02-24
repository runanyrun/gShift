-- Debug-only RPC to inspect request auth context in PostgREST session.
create or replace function public.debug_auth_context()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'auth_uid', auth.uid(),
    'auth_role', auth.role(),
    'jwt', current_setting('request.jwt.claims', true),
    'headers', current_setting('request.headers', true)
  );
$$;

grant execute on function public.debug_auth_context() to authenticated;
