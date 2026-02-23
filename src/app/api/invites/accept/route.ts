import { NextResponse } from "next/server";
import { authenticateApiRequest } from "../../../../core/auth/api-auth";
import { EmployeesController } from "../../../../features/employees/employees.controller";

function errorStatus(message: string): number {
  if (
    message.includes("Missing access token") ||
    message.includes("Invalid or expired access token") ||
    message.includes("Unauthenticated")
  ) {
    return 401;
  }
  if (message.includes("expired") || message.includes("Invalid invite token")) {
    return 400;
  }
  return 400;
}

export async function POST(request: Request) {
  try {
    const { supabase } = await authenticateApiRequest(request);
    const body = (await request.json()) as { token?: string };
    const token = body.token?.trim();
    if (!token) {
      return NextResponse.json({ ok: false, error: "Invite token is required." }, { status: 400 });
    }

    const controller = new EmployeesController(supabase);
    const data = await controller.acceptInvite(token);
    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to accept invite.";
    return NextResponse.json({ ok: false, error: message }, { status: errorStatus(message) });
  }
}
