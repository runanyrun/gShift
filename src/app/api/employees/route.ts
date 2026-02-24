import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "../../../core/auth/api-auth";
import { toApiErrorResponse } from "../../../core/auth/api-error-response";
import { requireManagePermissions } from "../../../core/auth/manage-permissions";
import { applyResponseCookies } from "../../../core/auth/supabase-server-client";
import { EmployeesController } from "../../../features/employees/employees.controller";

function parseBooleanParam(value: string | null): boolean | undefined {
  if (value === null) {
    return undefined;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return undefined;
}

export async function GET(request: NextRequest) {
  let authResponse: NextResponse | undefined;
  try {
    const auth = await authenticateApiRequest(request);
    authResponse = auth.response;
    const { supabase } = auth;
    const controller = new EmployeesController(supabase);
    const url = new URL(request.url);
    const data = await controller.listEmployees({
      isActive: parseBooleanParam(url.searchParams.get("is_active")),
      locationId: url.searchParams.get("location_id") ?? undefined,
      departmentId: url.searchParams.get("department_id") ?? undefined,
      jobTitleId: url.searchParams.get("job_title_id") ?? undefined,
    });
    return applyResponseCookies(authResponse, NextResponse.json({ ok: true, data }, { status: 200 }));
  } catch (error) {
    return applyResponseCookies(authResponse, toApiErrorResponse(error, "Failed to list employees."));
  }
}

export async function POST(request: NextRequest) {
  let authResponse: NextResponse | undefined;
  try {
    const auth = await authenticateApiRequest(request);
    authResponse = auth.response;
    const { supabase } = auth;
    await requireManagePermissions(supabase);
    const body = (await request.json()) as {
      firstName: string;
      lastName: string;
      email: string;
      phone1?: string | null;
      phone2?: string | null;
      gender?: string | null;
      birthDate?: string | null;
      isActive?: boolean;
      jobTitleId?: string | null;
      departmentId?: string | null;
      startDate?: string | null;
      endDate?: string | null;
      payrollId?: string | null;
      defaultBreakMinutes?: number | null;
      defaultShiftHours?: number | null;
      notes?: string | null;
      locationIds?: string[];
    };

    const controller = new EmployeesController(supabase);
    const data = await controller.createEmployee(body);
    return applyResponseCookies(authResponse, NextResponse.json({ ok: true, data }, { status: 201 }));
  } catch (error) {
    return applyResponseCookies(authResponse, toApiErrorResponse(error, "Failed to create employee."));
  }
}
