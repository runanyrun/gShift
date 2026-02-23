import { NextResponse } from "next/server";
import { authenticateApiRequest } from "../../../core/auth/api-auth";
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

export async function GET(request: Request) {
  try {
    const { supabase } = await authenticateApiRequest(request);
    const controller = new EmployeesController(supabase);
    const url = new URL(request.url);
    const data = await controller.listEmployees({
      isActive: parseBooleanParam(url.searchParams.get("is_active")),
      locationId: url.searchParams.get("location_id") ?? undefined,
      departmentId: url.searchParams.get("department_id") ?? undefined,
      jobTitleId: url.searchParams.get("job_title_id") ?? undefined,
    });
    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list employees.";
    return NextResponse.json({ ok: false, error: message }, { status: errorStatus(message) });
  }
}

export async function POST(request: Request) {
  try {
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
    const data = await controller.createEmployee(body);
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create employee.";
    return NextResponse.json({ ok: false, error: message }, { status: errorStatus(message) });
  }
}
