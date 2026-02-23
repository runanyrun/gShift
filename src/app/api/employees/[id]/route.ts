import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "../../../../core/auth/api-auth";
import { EmployeesController } from "../../../../features/employees/employees.controller";

function errorStatus(message: string): number {
  if (
    message.includes("Missing access token") ||
    message.includes("Invalid or expired access token") ||
    message.includes("Authenticated user context was not found")
  ) {
    return 401;
  }
  if (message.includes("Only management/admin")) {
    return 403;
  }
  return 400;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase } = await authenticateApiRequest(request);
    const controller = new EmployeesController(supabase);
    const data = await controller.getEmployeeById(id);
    if (!data) {
      return NextResponse.json({ ok: false, error: "Employee not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get employee.";
    return NextResponse.json({ ok: false, error: message }, { status: errorStatus(message) });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase } = await authenticateApiRequest(request);
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
    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update employee.";
    return NextResponse.json({ ok: false, error: message }, { status: errorStatus(message) });
  }
}
