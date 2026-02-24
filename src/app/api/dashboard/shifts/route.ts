import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "../../../../core/auth/api-auth";
import { toApiErrorResponse } from "../../../../core/auth/api-error-response";
import { applyResponseCookies } from "../../../../core/auth/supabase-server-client";
import { DashboardController } from "../../../../features/dashboard/dashboard.controller";

export async function GET(request: NextRequest) {
  let authResponse: NextResponse | undefined;
  try {
    const auth = await authenticateApiRequest(request);
    authResponse = auth.response;
    const { supabase, authUserId } = auth;
    const controller = new DashboardController(supabase);
    const payload = await controller.getShiftsForCurrentUser(authUserId);
    return applyResponseCookies(authResponse, NextResponse.json(payload, { status: 200 }));
  } catch (error) {
    return applyResponseCookies(authResponse, toApiErrorResponse(error, "Failed to load dashboard shifts."));
  }
}
