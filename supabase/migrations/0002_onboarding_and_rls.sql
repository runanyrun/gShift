create or replace function public.current_user_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.company_id
  from public.users u
  where u.auth_user_id = auth.uid()
  limit 1;
$$;

grant execute on function public.current_user_company_id() to authenticated;

drop policy if exists companies_select_own on public.companies;
create policy companies_select_own
on public.companies
for select
to authenticated
using (id = public.current_user_company_id());

drop policy if exists companies_update_own on public.companies;
create policy companies_update_own
on public.companies
for update
to authenticated
using (id = public.current_user_company_id())
with check (id = public.current_user_company_id());

drop policy if exists companies_insert_onboarding on public.companies;
create policy companies_insert_onboarding
on public.companies
for insert
to authenticated
with check (
  auth.role() = 'authenticated'
  and not exists (
    select 1
    from public.users u
    where u.auth_user_id = auth.uid()
  )
);

drop policy if exists users_select_company on public.users;
create policy users_select_company
on public.users
for select
to authenticated
using (
  auth.uid() = auth_user_id
  or company_id = public.current_user_company_id()
);

drop policy if exists users_update_company on public.users;
create policy users_update_company
on public.users
for update
to authenticated
using (company_id = public.current_user_company_id())
with check (company_id = public.current_user_company_id());

drop policy if exists users_insert_owner_bootstrap on public.users;
create policy users_insert_owner_bootstrap
on public.users
for insert
to authenticated
with check (
  auth.role() = 'authenticated'
  and auth.uid() = auth_user_id
  and role = 'owner'
  and not exists (
    select 1
    from public.users u
    where u.auth_user_id = auth.uid()
  )
);

create or replace function public.complete_owner_onboarding(
  p_auth_user_id uuid,
  p_email text,
  p_first_name text default null,
  p_last_name text default null,
  p_company_name text default null,
  p_sector text default null,
  p_country_code text default null,
  p_currency_code text default null,
  p_timezone text default null,
  p_plan_type text default null,
  p_subscription_status text default null
)
returns table(company_id uuid, profile_id uuid)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_company_id uuid;
  v_profile_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Unauthenticated request.';
  end if;

  if auth.uid() <> p_auth_user_id then
    raise exception 'auth_user_id does not match authenticated user.';
  end if;

  if coalesce(trim(p_email), '') = '' then
    raise exception 'Email is required.';
  end if;

  if coalesce(trim(p_company_name), '') = '' then
    raise exception 'Company name is required.';
  end if;

  if exists (
    select 1
    from public.users u
    where u.auth_user_id = auth.uid()
  ) then
    raise exception 'Onboarding already completed for this user.';
  end if;

  insert into public.companies (
    name,
    sector,
    country_code,
    currency_code,
    timezone,
    plan_type,
    subscription_status,
    created_at
  )
  values (
    trim(p_company_name),
    nullif(trim(coalesce(p_sector, '')), ''),
    nullif(trim(coalesce(p_country_code, '')), ''),
    nullif(trim(coalesce(p_currency_code, '')), ''),
    nullif(trim(coalesce(p_timezone, '')), ''),
    nullif(trim(coalesce(p_plan_type, '')), ''),
    nullif(trim(coalesce(p_subscription_status, '')), ''),
    now()
  )
  returning id into v_company_id;

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
    p_auth_user_id,
    v_company_id,
    lower(trim(p_email)),
    nullif(trim(coalesce(p_first_name, '')), ''),
    nullif(trim(coalesce(p_last_name, '')), ''),
    'owner',
    now()
  )
  returning id into v_profile_id;

  return query
  select v_company_id, v_profile_id;
end;
$$;

grant execute on function public.complete_owner_onboarding(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) to authenticated;
