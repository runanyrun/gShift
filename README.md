# gShift SaaS Core Setup

## Environment Variables

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

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

After pulling new changes, apply migrations before local tests:

```bash
supabase db push
```

If Supabase CLI is not available, run `supabase/migrations/0005_employees_foundation.sql` in Supabase SQL Editor.
For CLI usage, your project may need to be linked first (`supabase link`).
CI environments typically provide `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` for CLI auth.

Then run:

```bash
npm run test:employees
npm run test:all
```

## Post-Migration Verification

After applying migrations, verify runtime and tests:

```bash
npm run test:employees
npm run test:all
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
