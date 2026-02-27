import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "../../../../core/auth/api-auth";
import { toApiErrorResponse } from "../../../../core/auth/api-error-response";
import { applyResponseCookies } from "../../../../core/auth/supabase-server-client";

export async function GET(request: NextRequest) {
  let authResponse: NextResponse | undefined;
  try {
    const auth = await authenticateApiRequest(request);
    authResponse = auth.response;

    const { data, error } = await auth.supabase.rpc("list_my_applications" as never);
    if (error) {
      throw new Error(`Failed to list worker applications: ${error.message}`);
    }

    return applyResponseCookies(authResponse, NextResponse.json({ ok: true, data: data ?? [] }, { status: 200 }));
  } catch (error) {
    return applyResponseCookies(authResponse, toApiErrorResponse(error, "Failed to list worker applications."));
  }
}
