import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "../../../../core/auth/api-auth";
import { toApiErrorResponse } from "../../../../core/auth/api-error-response";
import { applyResponseCookies } from "../../../../core/auth/supabase-server-client";
import { listMyCompanyMemberships } from "../../../../core/tenancy/list-memberships";

export async function GET(request: NextRequest) {
  let authResponse: NextResponse | undefined;
  try {
    if (process.env.ENABLE_MULTI_WORKSPACES !== "1") {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    const auth = await authenticateApiRequest(request);
    authResponse = auth.response;

    const memberships = await listMyCompanyMemberships(auth.supabase, auth.authUserId);

    return applyResponseCookies(
      authResponse,
      NextResponse.json(
        {
          ok: true,
          data: memberships,
        },
        { status: 200 },
      ),
    );
  } catch (error) {
    return applyResponseCookies(authResponse, toApiErrorResponse(error, "Failed to list workspaces."));
  }
}
