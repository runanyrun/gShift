import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "../../../../core/auth/api-auth";
import { toApiErrorResponse } from "../../../../core/auth/api-error-response";
import { applyResponseCookies } from "../../../../core/auth/supabase-server-client";

export async function POST(request: NextRequest) {
  let authResponse: NextResponse | undefined;
  try {
    const auth = await authenticateApiRequest(request);
    authResponse = auth.response;

    const { data, error } = await auth.supabase.rpc("mark_all_notifications_read" as never);
    if (error) {
      throw new Error(`Failed to mark all notifications read: ${error.message}`);
    }

    return applyResponseCookies(authResponse, NextResponse.json({ ok: true, data: { updated: data ?? 0 } }, { status: 200 }));
  } catch (error) {
    return applyResponseCookies(authResponse, toApiErrorResponse(error, "Failed to mark all notifications read."));
  }
}
