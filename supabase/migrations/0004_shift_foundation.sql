create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists idx_shifts_company_id on public.shifts(company_id);
create index if not exists idx_shifts_user_id on public.shifts(user_id);
create index if not exists idx_shifts_starts_at on public.shifts(starts_at);

alter table public.shifts enable row level security;

create or replace function public.prevent_shift_company_id_change()
returns trigger
language plpgsql
as $$
begin
  if new.company_id <> old.company_id then
    raise exception 'company_id is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_shift_company_id_change on public.shifts;
create trigger trg_prevent_shift_company_id_change
before update on public.shifts
for each row
execute function public.prevent_shift_company_id_change();

drop policy if exists shifts_select_company on public.shifts;
drop policy if exists shifts_insert_company on public.shifts;
drop policy if exists shifts_update_company on public.shifts;
drop policy if exists shifts_delete_company on public.shifts;

create policy shifts_select_company
on public.shifts
for select
to authenticated
using (company_id = public.current_user_company_id());

create policy shifts_insert_company
on public.shifts
for insert
to authenticated
with check (
  company_id = public.current_user_company_id()
  and created_by = auth.uid()
);

create policy shifts_update_denied
on public.shifts
for update
to authenticated
using (false)
with check (false);

create policy shifts_delete_denied
on public.shifts
for delete
to authenticated
using (false);
