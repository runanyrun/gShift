# QSFT-9 Verification

- Timestamp (UTC): 2026-02-23T15:09:38Z
- Branch: feature/qsft-9-user-info

## Commands

1. npm run db:push

> gshift@0.1.0 db:push
> bash scripts/db-push.sh

[db:push] Checking Supabase migrations...
[db:push] Supabase CLI not found.
[db:push] Required action:
[db:push]   Option A: Install Supabase CLI and run: supabase db push
[db:push]   Option B: Run supabase/migrations/0005_employees_foundation.sql in Supabase SQL Editor
[db:push] Notes:
[db:push]   - Supabase CLI commands may require a linked project (supabase link).
[db:push]   - CI setups typically use SUPABASE_ACCESS_TOKEN and SUPABASE_DB_PASSWORD.
[db:push] Local mode: continuing without automatic migration apply.

2. npm run typecheck

> gshift@0.1.0 typecheck
> tsc --noEmit


3. npm run test:employees

> gshift@0.1.0 test:employees
> npm run db:push && bash scripts/run-with-test-env.sh ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"Node"}' src/core/utils/tests/employees-sanity.test.ts


> gshift@0.1.0 db:push
> bash scripts/db-push.sh

[db:push] Checking Supabase migrations...
[db:push] Supabase CLI not found.
[db:push] Required action:
[db:push]   Option A: Install Supabase CLI and run: supabase db push
[db:push]   Option B: Run supabase/migrations/0005_employees_foundation.sql in Supabase SQL Editor
[db:push] Notes:
[db:push]   - Supabase CLI commands may require a linked project (supabase link).
[db:push]   - CI setups typically use SUPABASE_ACCESS_TOKEN and SUPABASE_DB_PASSWORD.
[db:push] Local mode: continuing without automatic migration apply.
PASS: Non-management users are blocked from employee writes by RLS.
PASS: Employees read endpoints remain tenant-scoped for available test users.

4. npm run test:all

> gshift@0.1.0 test:all
> npm run db:push && npm run test:env && npm run test:http && npm run test:onboarding && npm run test:employees && npm run test:shift


> gshift@0.1.0 db:push
> bash scripts/db-push.sh

[db:push] Checking Supabase migrations...
[db:push] Supabase CLI not found.
[db:push] Required action:
[db:push]   Option A: Install Supabase CLI and run: supabase db push
[db:push]   Option B: Run supabase/migrations/0005_employees_foundation.sql in Supabase SQL Editor
[db:push] Notes:
[db:push]   - Supabase CLI commands may require a linked project (supabase link).
[db:push]   - CI setups typically use SUPABASE_ACCESS_TOKEN and SUPABASE_DB_PASSWORD.
[db:push] Local mode: continuing without automatic migration apply.

> gshift@0.1.0 test:env
> bash scripts/run-with-test-env.sh ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"Node"}' src/core/utils/tests/env-validation.test.ts

PASS: Valid environment parses successfully.
PASS: Invalid URL should fail-fast
PASS: Missing anon key should fail-fast

> gshift@0.1.0 test:http
> node scripts/run-ssr-tests.mjs test:ssr:raw test:me:raw test:dashboard:raw


> gshift@0.1.0 build
> next build

   ▲ Next.js 15.5.12
   - Environments: .env.local

   Creating an optimized production build ...
 ✓ Compiled successfully in 2.9s
   Linting and checking validity of types ...
   Collecting page data ...
   Generating static pages (0/24) ...
   Generating static pages (6/24) 
   Generating static pages (12/24) 
   Generating static pages (18/24) 
 ✓ Generating static pages (24/24)
   Finalizing page optimization ...
   Collecting build traces ...

Route (app)                                 Size  First Load JS
┌ ○ /                                      165 B         102 kB
├ ○ /_not-found                            993 B         103 kB
├ ○ /accept-invite                       1.97 kB         170 kB
├ ƒ /api/auth/signup                       165 B         102 kB
├ ƒ /api/dashboard/bootstrap               165 B         102 kB
├ ƒ /api/dashboard/overview                165 B         102 kB
├ ƒ /api/dashboard/shifts                  165 B         102 kB
├ ƒ /api/employees                         165 B         102 kB
├ ƒ /api/employees/[id]                    165 B         102 kB
├ ƒ /api/employees/[id]/invite             165 B         102 kB
├ ƒ /api/invites/accept                    165 B         102 kB
├ ƒ /api/me                                165 B         102 kB
├ ƒ /api/protected/me                      165 B         102 kB
├ ƒ /api/settings/departments              165 B         102 kB
├ ƒ /api/settings/departments/[id]         165 B         102 kB
├ ƒ /api/settings/job-titles               165 B         102 kB
├ ƒ /api/settings/job-titles/[id]          165 B         102 kB
├ ƒ /api/settings/locations                165 B         102 kB
├ ƒ /api/settings/locations/[id]           165 B         102 kB
├ ƒ /dashboard                           1.72 kB         170 kB
├ ƒ /employees                           1.82 kB         170 kB
├ ƒ /employees/[id]                      2.65 kB         168 kB
├ ƒ /employees/new                       2.26 kB         167 kB
├ ○ /login                               1.43 kB         166 kB
├ ƒ /settings/departments                1.54 kB         166 kB
├ ƒ /settings/job-titles                 1.54 kB         166 kB
├ ƒ /settings/locations                  1.54 kB         166 kB
└ ○ /signup                                945 B         103 kB
+ First Load JS shared by all             102 kB
  ├ chunks/255-ebd51be49873d76c.js         46 kB
  ├ chunks/4bd1b696-c023c6e3521b1417.js  54.2 kB
  └ other shared chunks (total)          1.91 kB


○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand


> gshift@0.1.0 start
> next start -p 3100

   ▲ Next.js 15.5.12
   - Local:        http://localhost:3100
   - Network:      http://192.168.1.132:3100

 ✓ Starting...
 ✓ Ready in 751ms

> gshift@0.1.0 test:ssr:raw
> bash scripts/run-with-test-env.sh ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"Node"}' src/core/utils/tests/ssr-auth.test.ts

PASS: Protected layout redirects unauthenticated users to /login.
PASS: Protected API route enforces server-side auth with 401.

> gshift@0.1.0 test:me:raw
> bash scripts/run-with-test-env.sh ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"Node"}' src/core/utils/tests/me-sanity.test.ts

PASS: /api/me requires auth token.
PASS: /api/me returns user, tenant, permissions and safe employee payload.

> gshift@0.1.0 test:dashboard:raw
> bash scripts/run-with-test-env.sh ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"Node"}' src/core/utils/tests/dashboard-sanity.test.ts

PASS: Dashboard overview API returns 401 when token is missing.
PASS: Protected dashboard page redirects unauthenticated users.
PASS: Dashboard shifts API returns 401 when token is missing.
PASS: Dashboard overview is tenant-scoped.
PASS: Dashboard shifts are tenant-scoped for tenant A.
PASS: Dashboard shifts are tenant-scoped for tenant B.

> gshift@0.1.0 test:onboarding
> bash scripts/run-with-test-env.sh ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"Node"}' src/core/utils/tests/onboarding-edge-case.test.ts

PASS: Duplicate onboarding is blocked.
PASS: NULL auth.uid() path is blocked.
SKIP: MULTI_COMPANY_ACCESS_TOKEN not provided. Provide token for an intentionally anomalous user to runtime-verify multi-company exception.

> gshift@0.1.0 test:employees
> npm run db:push && bash scripts/run-with-test-env.sh ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"Node"}' src/core/utils/tests/employees-sanity.test.ts


> gshift@0.1.0 db:push
> bash scripts/db-push.sh

[db:push] Checking Supabase migrations...
[db:push] Supabase CLI not found.
[db:push] Required action:
[db:push]   Option A: Install Supabase CLI and run: supabase db push
[db:push]   Option B: Run supabase/migrations/0005_employees_foundation.sql in Supabase SQL Editor
[db:push] Notes:
[db:push]   - Supabase CLI commands may require a linked project (supabase link).
[db:push]   - CI setups typically use SUPABASE_ACCESS_TOKEN and SUPABASE_DB_PASSWORD.
[db:push] Local mode: continuing without automatic migration apply.
PASS: Non-management users are blocked from employee writes by RLS.
PASS: Employees read endpoints remain tenant-scoped for available test users.

> gshift@0.1.0 test:shift
> bash scripts/run-with-test-env.sh ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"Node"}' src/core/utils/tests/shift-sanity.test.ts

PASS: createShift() works for current tenant.
PASS: listShifts() returns only current tenant data.
PASS: Cross-tenant insert is blocked by RLS.
PASS: company_id is immutable through tenant-safe RLS/update rules.

## Result

PASS
