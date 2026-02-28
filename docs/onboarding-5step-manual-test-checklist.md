# Onboarding 5-Step Completion Sprint Manual Test Checklist

## Core flow

1. Sign in with a fresh tenant owner or manager account.
2. Open `/onboarding`.
3. Complete:
   - Company
   - Location
   - Role
   - Employee (without email)
   - Schedule
4. Confirm the success state shows "You're ready".
5. Confirm the CTA buttons navigate to:
   - `/schedule`
   - `/dashboard`

## Employee access flow

1. Open `/employees/new`.
2. Create an employee with:
   - email filled
   - portal access enabled
3. Open the new employee detail page.
4. Confirm the Access section shows portal access enabled.
5. If invite infrastructure is available in the environment, trigger "Send invite" and verify the request succeeds.

## Work-day presets

1. In onboarding Schedule step, switch work days to `All`.
2. Finish setup and open `/schedule`.
3. Confirm no day is marked as non-working.
4. Open `/settings/company`, switch work days to `Weekdays`.
5. Return to `/schedule` and confirm Saturday/Sunday are marked as non-working.
6. Repeat with `Weekends` and confirm Monday-Friday are marked as non-working.

## Empty-state checks

1. Visit `/employees/new` before any location or role exists.
2. Confirm the page explains what is missing instead of showing a broken form.
3. Visit `/schedule` with locations but no shifts.
4. Confirm "Create first shift" is visible and creates a starter shift.
