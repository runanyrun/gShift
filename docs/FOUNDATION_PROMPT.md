# gShift Tenant-Safe SaaS Foundation Execution Prompt

## Role
Act as Senior Fullstack Architect + Developer + QA (implementation-first).

## Goal
Build, maintain, and verify a complete tenant-safe foundation for a global multi-tenant SaaS workforce management platform.

## Stack
- Next.js App Router (fullstack)
- TypeScript (strict)
- Supabase (Auth + Postgres + RLS)
- Feature-based architecture
- Branch strategy: feature/* -> develop -> PR -> main (main protected, no direct push)

## Current Baseline
- Migrations: `0001_initial_schema.sql`, `0002_onboarding_and_rls.sql`, `0003_security_hardening.sql`, `0004_shift_foundation.sql`
- Tenant-safe modules exist: Users, Company, Shift
- SSR auth enforcement exists
- Tenant helpers exist (`current-user.ts`)
- Tests exist (ts-node, fail-fast): env-validation, ssr-auth, onboarding-edge-case, shift-sanity
- Bootstrap users script exists (edge, tenantA, tenantB)
- Env validation exists (Zod fail-fast)

## Required Tasks
1. Verify DB foundation
- Confirm migrations are present and applied.
- Confirm tables: `public.users`, `public.companies`, `public.shifts`.
- Confirm functions: `current_user_company_id()`, `complete_owner_onboarding()`.

2. Enforce tenant-safe RLS
- No cross-tenant read/write leakage.
- `companies`, `users`, `shifts` policies active and restrictive.
- Block unsafe update/delete paths unless explicitly allowed.

3. Maintain tenant-safe modules
- Users module: service + repository + controller + types.
- Company module: tenant-scoped service.
- Shift module: tenant-scoped service + immutability checks + permission matrix.

4. Shift foundation hardening
- `company_id` immutable (trigger + policy behavior).
- Insert only inside current tenant.
- Update/delete denied unless policy says otherwise.
- Permission matrix role-safe (`owner/admin/user`).

5. SSR/Auth hardening
- Protected layout server-side redirect.
- Protected API routes require bearer token and `supabase.auth.getUser()`.
- No client-only trust for protected access.

6. Env fail-fast
- Validate `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` with Zod.
- Fail startup on invalid/missing env.

7. Bootstrap + tests
- Ensure bootstrap users exist (edge/tenantA/tenantB) or create them.
- Run ts-node chain with `.env.test.local`:
  - `npm run test:env`
  - `npm run test:ssr`
  - `npm run test:onboarding`
  - `npm run test:shift`
  - `npm run test:all`
- Fail-fast on any failure.
- Multi-company step may SKIP if token missing.

8. Branch workflow + PR discipline
- Work only on `feature/*`.
- Push feature branch, open PR to `develop`.
- No direct push to `main`.
- After merge: sync `develop`, delete local/remote feature branch.

## Acceptance Criteria
- No cross-tenant leakage.
- Shift immutability enforced and tested.
- SSR/API auth enforcement verified.
- All tests PASS (except optional multi-company SKIP).
- Branch and PR workflow follows protection rules.
- Code/migrations/tests remain synchronized.

## Output Format (mandatory)
1. Branch + commit info
2. Migration/RLS verification summary
3. Module-level changes (Users/Company/Shift/Auth)
4. Test results (PASS/FAIL/SKIP)
5. PR link + merge readiness
6. Post-merge cleanup commands
