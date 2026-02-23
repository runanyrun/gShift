# QSFT-9 Verification

- Timestamp (UTC): 2026-02-23T20:38:18Z
- Branch: feature/qsft-9-user-info

## Commands

1. npm run db:push

> gshift@0.1.0 db:push
> bash scripts/db-push.sh

[db:push] Checking Supabase migrations...
[db:push] supabase db push failed.
[db:push] Required action:
[db:push]   Option A: Install Supabase CLI and run: supabase db push
[db:push]   Option B: Run migrations in Supabase SQL Editor (at least 0005 + 0006)
[db:push] Notes:
[db:push]   - Supabase CLI commands may require a linked project (supabase link).
[db:push]   - CI setups typically use SUPABASE_ACCESS_TOKEN and SUPABASE_DB_PASSWORD.
[db:push] Local mode: continuing with current schema.

2. npm run typecheck

> gshift@0.1.0 typecheck
> tsc --noEmit


3. npm run test:employees

> gshift@0.1.0 test:employees
> npm run db:push && bash scripts/run-with-test-env.sh ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"Node"}' src/core/utils/tests/employees-sanity.test.ts


> gshift@0.1.0 db:push
> bash scripts/db-push.sh

[db:push] Checking Supabase migrations...
[db:push] supabase db push failed.
[db:push] Required action:
[db:push]   Option A: Install Supabase CLI and run: supabase db push
[db:push]   Option B: Run migrations in Supabase SQL Editor (at least 0005 + 0006)
[db:push] Notes:
[db:push]   - Supabase CLI commands may require a linked project (supabase link).
[db:push]   - CI setups typically use SUPABASE_ACCESS_TOKEN and SUPABASE_DB_PASSWORD.
[db:push] Local mode: continuing with current schema.
PASS: Non-management users are blocked from employee writes by RLS.
PASS: Employees read endpoints remain tenant-scoped for available test users.

4. npm run test:all

> gshift@0.1.0 test:all
> npm run db:push && npm run test:env && npm run test:ui-permissions && npm run test:routing && npm run test:http && npm run test:onboarding && npm run test:employees && npm run test:my-shifts && npm run test:shift


> gshift@0.1.0 db:push
> bash scripts/db-push.sh

[db:push] Checking Supabase migrations...
[db:push] supabase db push failed.
[db:push] Required action:
[db:push]   Option A: Install Supabase CLI and run: supabase db push
[db:push]   Option B: Run migrations in Supabase SQL Editor (at least 0005 + 0006)
[db:push] Notes:
[db:push]   - Supabase CLI commands may require a linked project (supabase link).
[db:push]   - CI setups typically use SUPABASE_ACCESS_TOKEN and SUPABASE_DB_PASSWORD.
[db:push] Local mode: continuing with current schema.

> gshift@0.1.0 test:env
> bash scripts/run-with-test-env.sh ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"Node"}' src/core/utils/tests/env-validation.test.ts

PASS: Valid environment parses successfully.
PASS: Placeholder URL should fail-fast
PASS: Non-Supabase URL should fail-fast
PASS: Missing SUPABASE_URL should fail-fast
PASS: Missing anon key should fail-fast
PASS: Local Supabase URL is accepted.

> gshift@0.1.0 test:ui-permissions
> bash scripts/run-with-test-env.sh ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"Node"}' src/core/utils/tests/ui-permissions.test.ts

PASS: Permission helper logic is correct.

> gshift@0.1.0 test:routing
> bash scripts/run-with-test-env.sh ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"Node"}' src/core/utils/tests/post-login-routing.test.ts

PASS: tenant=null routes to /onboarding
PASS: employee=null routes to /onboarding
PASS: non-manager routes to /my
PASS: management routes to /dashboard

> gshift@0.1.0 test:http
> node scripts/run-ssr-tests.mjs test:ssr:raw test:me:raw test:dashboard:raw


> gshift@0.1.0 build
> next build

   ▲ Next.js 15.5.12
   - Environments: .env.local

   Creating an optimized production build ...
 ✓ Compiled successfully in 3.5s
   Linting and checking validity of types ...
   Collecting page data ...
   Generating static pages (0/27) ...
   Generating static pages (6/27) 
   Generating static pages (13/27) 
   Generating static pages (20/27) 
 ✓ Generating static pages (27/27)
   Finalizing page optimization ...
   Collecting build traces ...

Route (app)                                 Size  First Load JS
┌ ○ /                                      167 B         102 kB
├ ○ /_not-found                            993 B         103 kB
├ ○ /accept-invite                       2.22 kB         171 kB
├ ƒ /api/auth/signup                       167 B         102 kB
├ ƒ /api/dashboard/bootstrap               167 B         102 kB
├ ƒ /api/dashboard/overview                167 B         102 kB
├ ƒ /api/dashboard/shifts                  167 B         102 kB
├ ƒ /api/employees                         167 B         102 kB
├ ƒ /api/employees/[id]                    167 B         102 kB
├ ƒ /api/employees/[id]/invite             167 B         102 kB
├ ƒ /api/invites/accept                    167 B         102 kB
├ ƒ /api/me                                167 B         102 kB
├ ƒ /api/my/shifts                         167 B         102 kB
├ ƒ /api/protected/me                      167 B         102 kB
├ ƒ /api/settings/departments              167 B         102 kB
├ ƒ /api/settings/departments/[id]         167 B         102 kB
├ ƒ /api/settings/job-titles               167 B         102 kB
├ ƒ /api/settings/job-titles/[id]          167 B         102 kB
├ ƒ /api/settings/locations                167 B         102 kB
├ ƒ /api/settings/locations/[id]           167 B         102 kB
├ ƒ /dashboard                           2.62 kB         171 kB
├ ƒ /employees                           2.28 kB         171 kB
├ ƒ /employees/[id]                      3.03 kB         168 kB
├ ƒ /employees/new                       2.69 kB         168 kB
├ ○ /login                               1.69 kB         167 kB
├ ƒ /my                                  2.53 kB         171 kB
├ ƒ /onboarding                            162 B         106 kB
├ ƒ /settings/departments                2.45 kB         167 kB
├ ƒ /settings/job-titles                 2.45 kB         167 kB
├ ƒ /settings/locations                  2.45 kB         167 kB
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
 ✓ Ready in 677ms

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

> gshift@0.1.0 test:employees
> npm run db:push && bash scripts/run-with-test-env.sh ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"Node"}' src/core/utils/tests/employees-sanity.test.ts


> gshift@0.1.0 db:push
> bash scripts/db-push.sh

[db:push] Checking Supabase migrations...
[db:push] supabase db push failed.
[db:push] Required action:
[db:push]   Option A: Install Supabase CLI and run: supabase db push
[db:push]   Option B: Run migrations in Supabase SQL Editor (at least 0005 + 0006)
[db:push] Notes:
[db:push]   - Supabase CLI commands may require a linked project (supabase link).
[db:push]   - CI setups typically use SUPABASE_ACCESS_TOKEN and SUPABASE_DB_PASSWORD.
[db:push] Local mode: continuing with current schema.
PASS: Non-management users are blocked from employee writes by RLS.
PASS: Employees read endpoints remain tenant-scoped for available test users.

> gshift@0.1.0 test:my-shifts
> npm run test:my-shifts:service && npm run test:api-my-shifts


> gshift@0.1.0 test:my-shifts:service
> bash scripts/run-with-test-env.sh ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"Node"}' src/core/utils/tests/my-shifts.test.ts

PASS: User1 gets only own in-window shifts, sorted and tenant-safe.
PASS: User2 gets only own in-window shift.

> gshift@0.1.0 test:api-my-shifts
> node scripts/run-ssr-tests.mjs test:api-my-shifts:raw


> gshift@0.1.0 build
> next build

   ▲ Next.js 15.5.12
   - Environments: .env.local

   Creating an optimized production build ...
 ✓ Compiled successfully in 2.2s
   Linting and checking validity of types ...
   Collecting page data ...
   Generating static pages (0/27) ...
   Generating static pages (6/27) 
   Generating static pages (13/27) 
   Generating static pages (20/27) 
 ✓ Generating static pages (27/27)
   Finalizing page optimization ...
   Collecting build traces ...

Route (app)                                 Size  First Load JS
┌ ○ /                                      167 B         102 kB
├ ○ /_not-found                            993 B         103 kB
├ ○ /accept-invite                       2.22 kB         171 kB
├ ƒ /api/auth/signup                       167 B         102 kB
├ ƒ /api/dashboard/bootstrap               167 B         102 kB
├ ƒ /api/dashboard/overview                167 B         102 kB
├ ƒ /api/dashboard/shifts                  167 B         102 kB
├ ƒ /api/employees                         167 B         102 kB
├ ƒ /api/employees/[id]                    167 B         102 kB
├ ƒ /api/employees/[id]/invite             167 B         102 kB
├ ƒ /api/invites/accept                    167 B         102 kB
├ ƒ /api/me                                167 B         102 kB
├ ƒ /api/my/shifts                         167 B         102 kB
├ ƒ /api/protected/me                      167 B         102 kB
├ ƒ /api/settings/departments              167 B         102 kB
├ ƒ /api/settings/departments/[id]         167 B         102 kB
├ ƒ /api/settings/job-titles               167 B         102 kB
├ ƒ /api/settings/job-titles/[id]          167 B         102 kB
├ ƒ /api/settings/locations                167 B         102 kB
├ ƒ /api/settings/locations/[id]           167 B         102 kB
├ ƒ /dashboard                           2.62 kB         171 kB
├ ƒ /employees                           2.28 kB         171 kB
├ ƒ /employees/[id]                      3.03 kB         168 kB
├ ƒ /employees/new                       2.69 kB         168 kB
├ ○ /login                               1.69 kB         167 kB
├ ƒ /my                                  2.53 kB         171 kB
├ ƒ /onboarding                            162 B         106 kB
├ ƒ /settings/departments                2.45 kB         167 kB
├ ƒ /settings/job-titles                 2.45 kB         167 kB
├ ƒ /settings/locations                  2.45 kB         167 kB
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
 ✓ Ready in 684ms

> gshift@0.1.0 test:api-my-shifts:raw
> bash scripts/run-with-test-env.sh ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"Node"}' src/core/utils/tests/api-my-shifts.test.ts

