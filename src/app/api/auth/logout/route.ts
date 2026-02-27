import { NextRequest, NextResponse } from "next/server";
import { applyResponseCookies, createSupabaseServerClient } from "../../../../core/auth/supabase-server-client";

export async function POST(request: NextRequest) {
  const authResponse = NextResponse.next();
  const supabase = createSupabaseServerClient(request, authResponse);

  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      return applyResponseCookies(
        authResponse,
        NextResponse.json({ ok: false, error: { message: error.message } }, { status: 400 }),
      );
    }

    return applyResponseCookies(authResponse, NextResponse.json({ ok: true }, { status: 200 }));
  } catch (error) {
    console.error("Logout API failure", error);
    return applyResponseCookies(
      authResponse,
      NextResponse.json({ ok: false, error: { message: "Failed to sign out." } }, { status: 500 }),
    );
  }
}
