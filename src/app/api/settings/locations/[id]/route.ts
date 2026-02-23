import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "../../../../../core/auth/api-auth";
import { EmployeesController } from "../../../../../features/employees/employees.controller";

function statusFor(message: string): number {
  if (message.includes("Missing access token") || message.includes("Invalid or expired access token")) {
    return 401;
  }
  if (message.includes("Only management/admin")) {
    return 403;
  }
  return 400;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase } = await authenticateApiRequest(request);
    const body = (await request.json()) as { name?: string; isActive?: boolean };
    const controller = new EmployeesController(supabase);
    const data = await controller.updateDictionary("locations", id, body);
    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update location.";
    return NextResponse.json({ ok: false, error: message }, { status: statusFor(message) });
  }
}
