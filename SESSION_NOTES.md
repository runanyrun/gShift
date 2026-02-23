# Session Notes

## Date
- 2026-02-23

## Completed
- Supabase onboarding flow is working end-to-end:
  - Auth user creation
  - Company creation
  - User profile creation (`role = owner`)
- `companies` and `users` records are confirmed in Supabase.
- RLS migration (`0002_onboarding_and_rls.sql`) was applied and validated.
- Dashboard bootstrap is tenant-scoped and returns company/user context.
- Login page is now connected to Supabase auth.
- Dashboard has a working sign-out button.
- API/dashboard token flow fixed:
  - Client sends `Authorization: Bearer <access_token>`
  - API reads token and creates scoped Supabase client
- Next.js runtime scaffolding was added:
  - `package.json`, `tsconfig.json`, `next.config.ts`, `next-env.d.ts`
  - `src/app/layout.tsx`, `src/app/page.tsx`

## Important Notes
- `.env.local` must contain:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `src/core/config/env.ts` was fixed to use direct `process.env.NEXT_PUBLIC_*` access for Next.js client bundling compatibility.

## Current Branch
- `feature/tenant-dashboard-bootstrap`

## Next Suggested Step
- Open/merge PR: `feature/tenant-dashboard-bootstrap -> develop`
- Start `feature/shift-module-foundation`:
  - Add `shifts` table (with `company_id`)
  - Add shift service + API
  - Add dashboard `upcomingShiftsCount` metric
