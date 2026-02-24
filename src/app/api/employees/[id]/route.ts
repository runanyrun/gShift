import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "../../../../core/auth/api-auth";
import { toApiErrorResponse } from "../../../../core/auth/api-error-response";
import { requireManagePermissions } from "../../../../core/auth/manage-permissions";
import { applyResponseCookies } from "../../../../core/auth/supabase-server-client";
import { EmployeesController } from "../../../../features/employees/employees.controller";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let authResponse: NextResponse | undefined;
  try {
    const { id } = await params;
    const auth = await authenticateApiRequest(request);
    authResponse = auth.response;
    const { supabase } = auth;
    const controller = new EmployeesController(supabase);
    const data = await controller.getEmployeeById(id);
    if (!data) {
      return applyResponseCookies(authResponse, NextResponse.json({ ok: false, error: "Employee not found." }, { status: 404 }));
    }
    return applyResponseCookies(authResponse, NextResponse.json({ ok: true, data }, { status: 200 }));
  } catch (error) {
    return applyResponseCookies(authResponse, toApiErrorResponse(error, "Failed to get employee."));
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let authResponse: NextResponse | undefined;
  try {
    const { id } = await params;
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
    const data = await controller.updateEmployee(id, body);
    return applyResponseCookies(authResponse, NextResponse.json({ ok: true, data }, { status: 200 }));
  } catch (error) {
    return applyResponseCookies(authResponse, toApiErrorResponse(error, "Failed to update employee."));
  }
}
