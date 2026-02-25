create or replace function public.get_shifts_for_week(location_id uuid, week_start date)
returns setof public.shifts
language sql
stable
security invoker
set search_path = public
as $$
  select s.*
  from public.shifts s
  join public.locations l
    on l.id = s.location_id
  where s.location_id = get_shifts_for_week.location_id
    and (s.start_at at time zone l.timezone) >= (get_shifts_for_week.week_start)::timestamp
    and (s.start_at at time zone l.timezone) < (get_shifts_for_week.week_start + 7)::timestamp
  order by s.start_at asc
$$;

create or replace function public.get_hours_cost_report(from_date date, to_date date, location_id uuid default null)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with filtered as (
    select
      s.employee_id,
      s.location_id,
      greatest(
        0::numeric,
        (extract(epoch from (s.end_at - s.start_at)) / 3600.0)::numeric
          - (coalesce(s.break_minutes, 0)::numeric / 60.0)
      ) as hours,
      s.hourly_wage::numeric as hourly_wage
    from public.shifts s
    join public.locations l
      on l.id = s.location_id
    where (s.start_at at time zone l.timezone)::date >= get_hours_cost_report.from_date
      and (s.start_at at time zone l.timezone)::date <= get_hours_cost_report.to_date
      and (
        get_hours_cost_report.location_id is null
        or s.location_id = get_hours_cost_report.location_id
      )
  ),
  totals as (
    select
      coalesce(round(sum(f.hours), 2), 0)::numeric as total_hours,
      coalesce(round(sum(f.hours * f.hourly_wage), 2), 0)::numeric as total_cost
    from filtered f
  ),
  employee_rollup as (
    select
      f.employee_id,
      e.full_name,
      round(sum(f.hours), 2)::numeric as total_hours,
      round(sum(f.hours * f.hourly_wage), 2)::numeric as total_cost
    from filtered f
    join public.employees e
      on e.id = f.employee_id
    group by f.employee_id, e.full_name
  ),
  location_rollup as (
    select
      f.location_id,
      l.name,
      round(sum(f.hours), 2)::numeric as total_hours,
      round(sum(f.hours * f.hourly_wage), 2)::numeric as total_cost
    from filtered f
    join public.locations l
      on l.id = f.location_id
    group by f.location_id, l.name
  )
  select jsonb_build_object(
    'from', get_hours_cost_report.from_date,
    'to', get_hours_cost_report.to_date,
    'location_id', get_hours_cost_report.location_id,
    'totals', jsonb_build_object(
      'total_hours', (select t.total_hours from totals t),
      'total_cost', (select t.total_cost from totals t)
    ),
    'per_employee', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'employee_id', er.employee_id,
            'full_name', er.full_name,
            'total_hours', er.total_hours,
            'total_cost', er.total_cost
          )
          order by er.full_name
        )
        from employee_rollup er
      ),
      '[]'::jsonb
    ),
    'per_location', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'location_id', lr.location_id,
            'name', lr.name,
            'total_hours', lr.total_hours,
            'total_cost', lr.total_cost
          )
          order by lr.name
        )
        from location_rollup lr
      ),
      '[]'::jsonb
    )
  )
$$;
