import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "../../../../core/auth/api-auth";
import { toApiErrorResponse } from "../../../../core/auth/api-error-response";
import { applyResponseCookies } from "../../../../core/auth/supabase-server-client";
import { EmployeesController } from "../../../../features/employees/employees.controller";

export async function GET(request: NextRequest) {
  let authResponse: NextResponse | undefined;
  try {
    const auth = await authenticateApiRequest(request);
    authResponse = auth.response;
    const { supabase } = auth;
    const controller = new EmployeesController(supabase);
    const data = await controller.listDictionary("departments");
    return applyResponseCookies(authResponse, NextResponse.json({ ok: true, data }, { status: 200 }));
  } catch (error) {
    return applyResponseCookies(authResponse, toApiErrorResponse(error, "Failed to list departments."));
  }
}

export async function POST(request: NextRequest) {
  let authResponse: NextResponse | undefined;
  try {
    const auth = await authenticateApiRequest(request);
    authResponse = auth.response;
    const { supabase } = auth;
    const body = (await request.json()) as { name: string; isActive?: boolean };
    const controller = new EmployeesController(supabase);
    const data = await controller.createDictionary("departments", body);
    return applyResponseCookies(authResponse, NextResponse.json({ ok: true, data }, { status: 201 }));
  } catch (error) {
    return applyResponseCookies(authResponse, toApiErrorResponse(error, "Failed to create department."));
  }
}
