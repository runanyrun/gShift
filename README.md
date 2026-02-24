# gShift SaaS Core Setup

## Environment Variables

Cloud-only quickstart:

1. Copy `.env.local.example` -> `.env.local`
2. Set your live project URL and publishable key
3. Run `npm run dev`
4. Open `/signup` to start onboarding

Required `.env.local` values:

```bash
# Live Supabase (web project)
SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<publishable-key>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable-key>
```

`SUPABASE_URL` cannot be a placeholder; app/test boot fails fast if invalid.
Accepted format:
- `https://<project-ref>.supabase.co`

## Signup Onboarding Flow

Endpoint:

```bash
POST /api/auth/signup
```

Expected JSON body:

```json
{
  "email": "owner@company.com",
  "password": "strong-password",
  "firstName": "Jane",
  "lastName": "Doe",
  "companyName": "Acme Inc",
  "sector": "construction",
  "countryCode": "US",
  "currencyCode": "USD",
  "timezone": "America/New_York",
  "planType": "starter",
  "subscriptionStatus": "trial"
}
```

Flow:

1. User is created via Supabase Auth.
2. `AuthService` calls `complete_owner_onboarding` RPC.
3. RPC creates `public.companies` + `public.users` in one DB transaction.
4. Profile record is created with `role = owner`.
5. If onboarding fails, the transaction rolls back (no half-created company/profile).

## Service Structure

- `src/features/auth/services/auth.service.ts`
  - Owns sign-up + onboarding orchestration.
- `src/features/company/services/company.service.ts`
  - Company reads/writes.
- `src/features/user/services/user.service.ts`
  - User profile reads/writes + onboarding RPC bridge.

## Session & Auth Utilities

- `src/core/auth/session.ts`
  - Session listener (`onSupabaseSessionChange`)
  - Persistent session reads (`getCurrentSession`)
  - Current authenticated user (`getCurrentAuthenticatedUser`)
- `src/core/auth/current-user.ts`
  - `getCurrentUserTenantContext` for `company_id` + `role`
- `src/core/auth/AuthGuard.tsx`
  - Reusable protected-route wrapper (`/login` redirect)

Protected route example:

- `src/app/(protected)/layout.tsx`
- `src/app/(protected)/dashboard/page.tsx`

Dashboard bootstrap API:

- `GET /api/dashboard/bootstrap`
- Returns authenticated tenant-scoped user/company/metrics payload

## Manual Ops Checklist

1. Supabase SQL Editor'da çalıştır:
   - `supabase/migrations/0002_onboarding_and_rls.sql`
2. Signup UI:
   - `src/app/signup/page.tsx`
   - `202` durumunda `requiresEmailVerification` mesajı gösterir.
3. Protected login redirect hedefi:
   - `src/app/login/page.tsx`

## Multi-Tenant Isolation Pattern

- Helper: `src/core/permissions/tenant-scope.ts`
- Use `withCompanyScope(query, companyId)` for all tenant-owned data.
- User listing example already applies this in `UserService.listUsersByCompany`.

## Database Migrations

Run both migrations:

- `supabase/migrations/0001_initial_schema.sql`
- `supabase/migrations/0002_onboarding_and_rls.sql`

`0002` includes:

- `complete_owner_onboarding` transactional RPC
- `companies` policies (own-company access)
- `users` policies (same-company access)
- helper function `current_user_company_id()`

## Development Test Flow

Run one command after pulling changes:

```bash
npm run verify:cloud
```

This command runs `typecheck`, `test:env`, and `test:all` in cloud mode.

## Permission Guard Smoke Check

1. Run checks:
   - `npm run typecheck`
   - `npm run test:ui-permissions`
   - `npm run test:routing`
   - `npm run test:manage-guard`
2. Apply SQL migrations in Supabase Dashboard SQL editor (including `0008_is_management_user_invoker.sql`).
3. Manual verify with two users in same tenant:
   - Manager/admin user: `/employees` list + `/employees/new` write actions succeed.
   - Non-manager user: `/employees` is readable in scoped mode, write actions return `403` with `no-permission`.

## Post-Migration Verification

If you apply migrations manually, re-run:

```bash
npm run verify:qsft9
```

Then confirm manually:
- `GET /api/me` returns `ok=true` with `user`, `tenant`, `permissions`, `employee|null`
- `/employees` loads after login
## Important Notes

- All timestamps are written as UTC ISO strings.
- No service role key is used in frontend code.
- RLS is secure-by-default and company-scoped.
- If email confirmation is enabled and `signUp` returns no session, API returns `202` with `requiresEmailVerification = true`.
- Stripe integration can be added later under `src/features/billing/` and `src/features/subscription/`.
- `public.is_management_user()` RPC must grant execute to `authenticated`; unauthenticated calls return `false` and management guards return `no-permission`.
- Debug auth probe (`/api/me?debugAuth=1`) is disabled by default and only enabled when `NODE_ENV` is not `production` and `ENABLE_DEBUG_AUTH=1`.

## Workspace Naming

- `companies.name` is a display name and can be duplicated across tenants.
- `companies.slug` is the unique workspace address used for collision-safe lookup.
- On signup/onboarding, slug is auto-generated from name (`apple`, `apple-2`, `apple-3`, ...).
- UX copy guideline: show separate fields/labels for `Workspace name` and `Workspace address (slug)`.
- Current model uses `users.company_id` as the active tenant pointer; migration path for multi-membership is to add `tenant_memberships(user_id, company_id, role)` and convert `users.company_id` into `active_company_id`.
- Invite accept follows the same single-pointer model:
  - if `users.company_id` is `NULL`, invite acceptance links the user to invite workspace
  - if `users.company_id` points to a different workspace, invite acceptance returns `409 user-already-in-company`
  - if `users.company_id` already matches invite workspace, repeated accepts are idempotent

## Invite Accept UX + API Contract

- Invite screen reads `token` and optional `workspace` from query string.
- API: `POST /api/invites/accept` with `{ token }`.
- Error contract (`error.code`) used by UI routing/messages:
  - `user-already-in-company` -> show account/workspace mismatch actions
  - `invite-invalid` -> invite not found
  - `invite-expired` -> invite expired
  - `invite-not-pending` -> invite already consumed/revoked/non-pending
- Login deep-link can carry workspace context:
  - `/login?workspace=<slug>&reason=invite`

## Auth Debug + Test Env

- `/api/me?debugAuth=1` is available only when:
  - `NODE_ENV !== "production"`
  - `ENABLE_DEBUG_AUTH=1`
- Integration test auth helper route `/api/test/login` requires:
  - `ENABLE_TEST_AUTH_ROUTES=1`
- Required env vars for auth-context test:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `TENANT_A_EMAIL`
  - `TENANT_A_PASSWORD`
- Marketplace scaffold API routes are disabled by default and require:
  - `ENABLE_MARKETPLACE=1` (dev/testing only until implementation is complete)
  - `ENABLE_MULTI_WORKSPACES=1` for `/api/my/workspaces` phase-1 membership listing endpoint

## Multi-Workspaces (Phase 1)

- Added `public.company_memberships` with backfill from current `public.users` rows.
- App remains backward-compatible and still uses `users.company_id` as active workspace pointer.
- New optional endpoint: `GET /api/my/workspaces` (flag: `ENABLE_MULTI_WORKSPACES=1`).
- Migration path:
  - Phase 1: maintain dual write/backfill compatibility
  - Phase 2: introduce active workspace switcher and move pointer semantics to dedicated field

## Marketplace (Future)

- Planned flow: `job post -> worker apply -> manager invite -> assignment -> work log -> rating`.
- Current DB scaffold exists (`marketplace_*` tables) but API behavior remains `501 Not Implemented`.
- Marketplace tables are `RLS enabled` with `FORCE ROW LEVEL SECURITY`; policies are TODO, so default access is deny.
- Direct table access is additionally revoked from `anon` and `authenticated` until launch policies are added.
- Marketplace MVP (flag: `ENABLE_MARKETPLACE=1`) now includes:
  - manager create post: `POST /api/marketplace/posts`
  - authenticated list posts: `GET /api/marketplace/posts`
  - worker apply: `POST /api/marketplace/posts/:id/apply`
  - apply response contract:
    - `201` created: `{ ok:true, data:{ id, postId, workerUserId, status, createdAt } }`
    - `200` already applied: `{ ok:true, data:{ postId, alreadyApplied:true, status } }`
    - `404` post not found
    - `409` post not open
- Role expectations:
  - create post (`POST /api/marketplace/posts`): management only (`owner/admin/manager`)
  - apply (`POST /api/marketplace/posts/:id/apply`): any authenticated worker
- DB security layering:
  - `0012` sets RLS+FORCE and baseline revoke for marketplace tables
  - `0014` adds authenticated grants and MVP RLS policies
- Smoke command:
  - `npm run smoke:marketplace` (uses `ENABLE_MARKETPLACE=1`; missing env/network prints warning and exits cleanly)
- This marketplace flow is assignment-based and can evolve independently from full multi-membership tenancy.
- Current tenant pointer remains single-workspace (`users.company_id`); multi-membership is a separate migration track.
