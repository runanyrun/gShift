-- Workspace naming hardening:
-- - display name (`companies.name`) is non-unique
-- - canonical workspace address (`companies.slug`) is unique
-- - onboarding auto-generates a unique slug from company name

alter table public.companies
add column if not exists slug text;

do $$
declare
  v_name_unique_constraint text;
begin
  select c.conname
  into v_name_unique_constraint
  from pg_constraint c
  where c.conrelid = 'public.companies'::regclass
    and c.contype = 'u'
    and cardinality(c.conkey) = 1
    and c.conkey[1] = (
      select a.attnum
      from pg_attribute a
      where a.attrelid = 'public.companies'::regclass
        and a.attname = 'name'
    )
  limit 1;

  if v_name_unique_constraint is not null then
    execute format('alter table public.companies drop constraint %I', v_name_unique_constraint);
  end if;
end
$$;

create or replace function public.company_slug_base(p_name text)
returns text
language sql
immutable
set search_path = public
as $$
  select coalesce(
    nullif(
      regexp_replace(
        regexp_replace(lower(trim(coalesce(p_name, ''))), '[^a-z0-9]+', '-', 'g'),
        '(^-+|-+$)',
        '',
        'g'
      ),
      ''
    ),
    'workspace'
  );
$$;

grant execute on function public.company_slug_base(text) to authenticated;

create or replace function public.generate_unique_company_slug(p_name text)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v_base text;
  v_slug text;
  v_suffix integer := 2;
begin
  v_base := public.company_slug_base(p_name);
  v_slug := v_base;

  while exists (
    select 1
    from public.companies c
    where lower(c.slug) = lower(v_slug)
  ) loop
    v_slug := v_base || '-' || v_suffix::text;
    v_suffix := v_suffix + 1;
  end loop;

  return v_slug;
end;
$$;

grant execute on function public.generate_unique_company_slug(text) to authenticated;

do $$
declare
  r record;
begin
  lock table public.companies in share row exclusive mode;

  for r in
    select c.id, c.name
    from public.companies c
    where c.slug is null or btrim(c.slug) = ''
    order by c.created_at asc, c.id asc
  loop
    update public.companies c
    set slug = public.generate_unique_company_slug(r.name)
    where c.id = r.id;
  end loop;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_attribute a
    where a.attrelid = 'public.companies'::regclass
      and a.attname = 'slug'
      and a.attnotnull = true
  ) then
    alter table public.companies
      alter column slug set not null;
  end if;
end
$$;

create unique index if not exists idx_companies_slug_unique
on public.companies (lower(slug));

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
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid;
  v_company_id uuid;
  v_profile_id uuid;
  v_company_slug text;
  v_slug_retry_count integer := 0;
begin
  v_auth_user_id := auth.uid();
  if v_auth_user_id is null then
    raise exception 'Unauthenticated request.';
  end if;

  if v_auth_user_id <> p_auth_user_id then
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
    where u.auth_user_id = v_auth_user_id
  ) then
    raise exception 'Onboarding already completed for this user.';
  end if;

  loop
    v_company_slug := public.generate_unique_company_slug(p_company_name);
    begin
      insert into public.companies (
        name,
        slug,
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
        v_company_slug,
        nullif(trim(coalesce(p_sector, '')), ''),
        nullif(trim(coalesce(p_country_code, '')), ''),
        nullif(trim(coalesce(p_currency_code, '')), ''),
        nullif(trim(coalesce(p_timezone, '')), ''),
        nullif(trim(coalesce(p_plan_type, '')), ''),
        nullif(trim(coalesce(p_subscription_status, '')), ''),
        now()
      )
      returning id into v_company_id;
      exit;
    exception
      when unique_violation then
        v_slug_retry_count := v_slug_retry_count + 1;
        if v_slug_retry_count >= 25 then
          raise exception 'Failed to generate a unique company slug.';
        end if;
    end;
  end loop;

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
exception
  when unique_violation then
    raise exception 'Onboarding already completed for this user.';
end;
$$;

revoke all on function public.complete_owner_onboarding(
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
) from public;

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
