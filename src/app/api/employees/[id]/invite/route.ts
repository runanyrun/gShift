import { randomBytes, createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "../../../../../core/auth/api-auth";
import { inviteEmailSender } from "../../../../../core/utils/invite-email";
import { EmployeesController } from "../../../../../features/employees/employees.controller";

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase } = await authenticateApiRequest(request);
    const body = (await request.json()) as { email: string; employeeName?: string };

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString();

    const controller = new EmployeesController(supabase);
    const invite = await controller.createInvite({
      employeeId: id,
      email: body.email,
      tokenHash,
      expiresAt,
    });

    const inviteLink = `${new URL(request.url).origin}/accept-invite?token=${encodeURIComponent(rawToken)}`;
    await inviteEmailSender.sendInvite({
      to: body.email,
      employeeName: body.employeeName ?? "Employee",
      inviteLink,
    });

    return NextResponse.json(
      {
        ok: true,
        data: {
          ...invite,
          expiresAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create employee invite.";
    return NextResponse.json({ ok: false, error: message }, { status: errorStatus(message) });
  }
}
