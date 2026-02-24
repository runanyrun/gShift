import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "../../../../../core/auth/api-auth";
import { toApiErrorResponse } from "../../../../../core/auth/api-error-response";
import { applyResponseCookies } from "../../../../../core/auth/supabase-server-client";
import { EmployeesController } from "../../../../../features/employees/employees.controller";

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
    const body = (await request.json()) as { name?: string; isActive?: boolean };
    const controller = new EmployeesController(supabase);
    const data = await controller.updateDictionary("locations", id, body);
    return applyResponseCookies(authResponse, NextResponse.json({ ok: true, data }, { status: 200 }));
  } catch (error) {
    return applyResponseCookies(authResponse, toApiErrorResponse(error, "Failed to update location."));
  }
}
