import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "../../../../core/auth/api-auth";
import { toApiErrorResponse } from "../../../../core/auth/api-error-response";
import { applyResponseCookies } from "../../../../core/auth/supabase-server-client";

export async function GET(request: NextRequest) {
  let authResponse: NextResponse | undefined;
  try {
    const auth = await authenticateApiRequest(request);
    authResponse = auth.response;
    const { supabase } = auth;
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw new Error("Unauthorized");
    }

    return applyResponseCookies(
      authResponse,
      NextResponse.json(
        {
          id: data.user.id,
          email: data.user.email ?? null,
        },
        { status: 200 },
      ),
    );
  } catch (error) {
    return applyResponseCookies(authResponse, toApiErrorResponse(error, "Failed to load authenticated user."));
  }
}
