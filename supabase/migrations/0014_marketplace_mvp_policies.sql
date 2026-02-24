-- Marketplace MVP policies and grants
-- Requires 0012_marketplace_scaffold.sql

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.marketplace_applications'::regclass
      and conname = 'marketplace_applications_post_worker_uq'
  ) then
    alter table public.marketplace_applications
      add constraint marketplace_applications_post_worker_uq
      unique (post_id, worker_user_id);
  end if;
end $$;

grant select, insert, update, delete on table public.marketplace_job_posts to authenticated;
grant select, insert on table public.marketplace_applications to authenticated;
revoke all on table public.marketplace_job_posts from anon;
revoke all on table public.marketplace_applications from anon;

drop policy if exists marketplace_job_posts_select_authenticated on public.marketplace_job_posts;
create policy marketplace_job_posts_select_authenticated
on public.marketplace_job_posts
for select
to authenticated
using (true);

drop policy if exists marketplace_job_posts_insert_management on public.marketplace_job_posts;
create policy marketplace_job_posts_insert_management
on public.marketplace_job_posts
for insert
to authenticated
with check (
  public.is_management_user()
  and company_id = public.current_user_company_id()
);

drop policy if exists marketplace_job_posts_update_management on public.marketplace_job_posts;
create policy marketplace_job_posts_update_management
on public.marketplace_job_posts
for update
to authenticated
using (
  public.is_management_user()
  and company_id = public.current_user_company_id()
)
with check (
  public.is_management_user()
  and company_id = public.current_user_company_id()
);

drop policy if exists marketplace_job_posts_delete_management on public.marketplace_job_posts;
create policy marketplace_job_posts_delete_management
on public.marketplace_job_posts
for delete
to authenticated
using (
  public.is_management_user()
  and company_id = public.current_user_company_id()
);

drop policy if exists marketplace_applications_insert_self on public.marketplace_applications;
create policy marketplace_applications_insert_self
on public.marketplace_applications
for insert
to authenticated
with check (
  worker_user_id = auth.uid()
  and exists (
    select 1
    from public.marketplace_job_posts p
    where p.id = marketplace_applications.post_id
      and p.status = 'open'
  )
);

drop policy if exists marketplace_applications_select_worker_or_company on public.marketplace_applications;
create policy marketplace_applications_select_worker_or_company
on public.marketplace_applications
for select
to authenticated
using (
  worker_user_id = auth.uid()
  or exists (
    select 1
    from public.marketplace_job_posts p
    join public.users u
      on u.company_id = p.company_id
    where p.id = marketplace_applications.post_id
      and u.auth_user_id = auth.uid()
      and u.role in ('owner', 'admin', 'manager')
  )
);
