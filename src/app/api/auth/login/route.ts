import { NextRequest, NextResponse } from "next/server";
import { applyResponseCookies, createSupabaseServerClient } from "../../../../core/auth/supabase-server-client";

interface LoginBody {
  email?: string;
  password?: string;
}

function hasAuthCookies(response: NextResponse): boolean {
  const headersWithGetSetCookie = response.headers as Headers & { getSetCookie?: () => string[] };
  const setCookieList = headersWithGetSetCookie.getSetCookie?.() ?? [];
  if (setCookieList.length > 0) {
    return true;
  }

  const rawSetCookie = response.headers.get("set-cookie");
  if (rawSetCookie && rawSetCookie.trim().length > 0) {
    return true;
  }

  return response.cookies.getAll().length > 0;
}
export async function POST(request: NextRequest) {
  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json({ ok: false, error: { message: "Invalid JSON body." } }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  if (!email || !password) {
    return NextResponse.json({ ok: false, error: { message: "Email and password are required." } }, { status: 400 });
  }

  const authResponse = NextResponse.next();
  const supabase = createSupabaseServerClient(request, authResponse);

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data?.user) {
      return applyResponseCookies(
        authResponse,
        NextResponse.json({ ok: false, error: { message: error?.message ?? "Invalid credentials." } }, { status: 401 }),
      );
    }
    if (!data.session) {
      return applyResponseCookies(
        authResponse,
        NextResponse.json({ ok: false, error: { message: "Auth session missing." } }, { status: 502 }),
      );
    }
    if (!hasAuthCookies(authResponse)) {
      console.error("Login API: missing Set-Cookie after sign-in", { userId: data.user.id });
      return applyResponseCookies(
        authResponse,
        NextResponse.json({ ok: false, error: { message: "Failed to establish auth cookie." } }, { status: 500 }),
      );
    }
    return applyResponseCookies(
      authResponse,
      NextResponse.json(
        {
          ok: true,
          data: {
            userId: data.user.id,
            accessToken: data.session.access_token,
          },
        },
        { status: 200 },
      ),
    );
  } catch (error) {
    console.error("Login API failure", error);
    return applyResponseCookies(
      authResponse,
      NextResponse.json({ ok: false, error: { message: "Authentication service unavailable." } }, { status: 503 }),
    );
  }
}
