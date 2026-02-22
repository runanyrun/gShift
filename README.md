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
2. Company record is inserted into `public.companies`.
3. Profile record is inserted into `public.users` with `role = owner`.

## Important Notes

- All timestamps are written as UTC ISO strings.
- No service role key is used in frontend code.
- For production, configure RLS policies for `companies` and `users`.
- If email confirmation is enabled and `signUp` returns no session, onboarding should run after confirmation.
