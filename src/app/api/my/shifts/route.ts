import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "../../../../core/auth/api-auth";
import { toApiErrorResponse } from "../../../../core/auth/api-error-response";
import { applyResponseCookies } from "../../../../core/auth/supabase-server-client";
import { getCurrentUserTenantContext } from "../../../../core/auth/current-user";
import { getMyUpcomingShifts } from "../../../../core/shifts/my-shifts";

export async function GET(request: NextRequest) {
  let authResponse: NextResponse | undefined;
  try {
    const auth = await authenticateApiRequest(request);
    authResponse = auth.response;
    const { supabase, authUserId } = auth;
    const context = await getCurrentUserTenantContext(supabase);
    if (!context) {
      return applyResponseCookies(
        authResponse,
        NextResponse.json(
          { ok: false, error: { message: "User is not connected to a tenant.", code: "tenant_missing" } },
          { status: 403 },
        ),
      );
    }

    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select("id")
      .eq("tenant_id", context.companyId)
      .eq("user_id", authUserId)
      .maybeSingle();
    if (employeeError) {
      throw new Error(`Failed to resolve employee context: ${employeeError.message}`);
    }
    if (!employee) {
      return applyResponseCookies(
        authResponse,
        NextResponse.json(
          { ok: false, error: { message: "Employee profile is not linked.", code: "employee_missing" } },
          { status: 403 },
        ),
      );
    }

    const url = new URL(request.url);
    const daysParam = Number.parseInt(url.searchParams.get("days") ?? "7", 10);
    const days = Number.isFinite(daysParam) && daysParam > 0 ? daysParam : 7;

    const shifts = await getMyUpcomingShifts({
      supabase,
      tenantId: context.companyId,
      userId: authUserId,
      days,
    });

    return applyResponseCookies(authResponse, NextResponse.json({ ok: true, data: shifts }, { status: 200 }));
  } catch (error) {
    return applyResponseCookies(authResponse, toApiErrorResponse(error, "Failed to load shifts."));
  }
}
