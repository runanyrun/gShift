import { NextRequest, NextResponse } from "next/server";
import { applyResponseCookies, createSupabaseServerClient } from "../../../../core/auth/supabase-server-client";

interface LoginBody {
  email?: string;
  password?: string;
}

export async function POST(request: NextRequest) {
  if (process.env.ENABLE_TEST_AUTH_ROUTES !== "1") {
    return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  }

  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  if (!email || !password) {
    return NextResponse.json({ ok: false, error: "email-and-password-required" }, { status: 400 });
  }

  const authResponse = NextResponse.next();
  const supabase = createSupabaseServerClient(request, authResponse);
  let data: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>["data"] | null = null;
  let error: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>["error"] | null = null;
  try {
    const signIn = await supabase.auth.signInWithPassword({ email, password });
    data = signIn.data;
    error = signIn.error;
  } catch {
    return applyResponseCookies(
      authResponse,
      NextResponse.json({ ok: false, error: "auth-upstream-unreachable" }, { status: 503 }),
    );
  }

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("fetch failed") || message.includes("getaddrinfo") || message.includes("network")) {
      return applyResponseCookies(
        authResponse,
        NextResponse.json({ ok: false, error: "auth-upstream-unreachable" }, { status: 503 }),
      );
    }
  }

  if (error || !data?.user) {
    return applyResponseCookies(
      authResponse,
      NextResponse.json({ ok: false, error: "invalid-credentials" }, { status: 401 }),
    );
  }

  return applyResponseCookies(
    authResponse,
    NextResponse.json(
      {
        ok: true,
        data: {
          userId: data.user.id,
          accessToken: data.session?.access_token ?? null,
        },
      },
      { status: 200 },
    ),
  );
}
