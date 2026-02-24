import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "../../../../core/auth/api-auth";
import { toApiErrorResponse } from "../../../../core/auth/api-error-response";
import { applyResponseCookies } from "../../../../core/auth/supabase-server-client";
import { DashboardBootstrapService } from "../../../../features/dashboard/services/dashboard-bootstrap.service";

export async function GET(request: NextRequest) {
  let authResponse: NextResponse | undefined;
  try {
    const auth = await authenticateApiRequest(request);
    authResponse = auth.response;
    const { supabase } = auth;
    const service = new DashboardBootstrapService(supabase);
    const payload = await service.getBootstrap();
    return applyResponseCookies(authResponse, NextResponse.json(payload, { status: 200 }));
  } catch (error) {
    return applyResponseCookies(authResponse, toApiErrorResponse(error, "Failed to load dashboard bootstrap."));
  }
}
