import { NextResponse } from "next/server";
import { authenticateApiRequest } from "../../../../core/auth/api-auth";
import { getCurrentUserTenantContext } from "../../../../core/auth/current-user";
import { getMyUpcomingShifts } from "../../../../core/shifts/my-shifts";

function resolveStatus(errorMessage: string): number {
  if (
    errorMessage.includes("Missing access token") ||
    errorMessage.includes("Invalid or expired access token") ||
    errorMessage.includes("Auth session missing")
  ) {
    return 401;
  }
  return 400;
}

export async function GET(request: Request) {
  try {
    const { supabase, authUserId } = await authenticateApiRequest(request);
    const context = await getCurrentUserTenantContext(supabase);
    if (!context) {
      return NextResponse.json(
        { ok: false, error: { message: "User is not connected to a tenant.", code: "tenant_missing" } },
        { status: 403 },
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
      return NextResponse.json(
        { ok: false, error: { message: "Employee profile is not linked.", code: "employee_missing" } },
        { status: 403 },
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

    return NextResponse.json({ ok: true, data: shifts }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load shifts.";
    return NextResponse.json(
      { ok: false, error: { message, code: "bad_request" } },
      { status: resolveStatus(message) },
    );
  }
}
