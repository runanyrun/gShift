-- Onboarding RPC edge-case checks for public.complete_owner_onboarding
-- Replace the UUID placeholders with real auth.users ids in your environment.

-- 1) NULL auth.uid() should raise exception
do $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform *
    from public.complete_owner_onboarding(
      '00000000-0000-0000-0000-000000000000',
      'null-auth@test.com',
      null,
      null,
      'Null Auth Company',
      null,
      null,
      null,
      null,
      null,
      null
    );
    raise exception 'Expected unauthenticated exception was not raised.';
  exception
    when others then
      if position('Unauthenticated' in SQLERRM) = 0 then
        raise;
      end if;
  end;
end $$;

-- 2) Duplicate onboarding should raise exception
-- Replace with a real authenticated user that already has a profile row.
do $$
declare
  v_user_id uuid := '11111111-1111-1111-1111-111111111111';
begin
  perform set_config('request.jwt.claim.sub', v_user_id::text, true);
  begin
    perform *
    from public.complete_owner_onboarding(
      v_user_id,
      'duplicate@test.com',
      null,
      null,
      'Duplicate Company',
      null,
      null,
      null,
      null,
      null,
      null
    );
    raise exception 'Expected duplicate onboarding exception was not raised.';
  exception
    when others then
      if position('Onboarding already completed' in SQLERRM) = 0 then
        raise;
      end if;
  end;
end $$;

-- 3) Multiple companies mapped to same user should raise exception
-- This test assumes data anomaly was manually introduced by an admin.
do $$
declare
  v_user_id uuid := '22222222-2222-2222-2222-222222222222';
begin
  perform set_config('request.jwt.claim.sub', v_user_id::text, true);
  begin
    perform public.current_user_company_id();
    raise exception 'Expected multiple company exception was not raised.';
  exception
    when others then
      if position('Multiple companies found' in SQLERRM) = 0 then
        raise;
      end if;
  end;
end $$;
