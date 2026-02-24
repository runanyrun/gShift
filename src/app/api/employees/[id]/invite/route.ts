import { randomBytes, createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "../../../../../core/auth/api-auth";
import { toApiErrorResponse } from "../../../../../core/auth/api-error-response";
import { requireManagePermissions } from "../../../../../core/auth/manage-permissions";
import { applyResponseCookies } from "../../../../../core/auth/supabase-server-client";
import { inviteEmailSender } from "../../../../../core/utils/invite-email";
import { EmployeesController } from "../../../../../features/employees/employees.controller";

export async function POST(
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

    const workspaceParam = invite.companySlug
      ? `&workspace=${encodeURIComponent(invite.companySlug)}`
      : "";
    const inviteLink = `${new URL(request.url).origin}/accept-invite?token=${encodeURIComponent(rawToken)}${workspaceParam}`;
    await inviteEmailSender.sendInvite({
      to: body.email,
      employeeName: body.employeeName ?? "Employee",
      inviteLink,
    });

    return applyResponseCookies(
      authResponse,
      NextResponse.json(
      {
        ok: true,
        data: {
          ...invite,
          expiresAt,
        },
      },
      { status: 201 },
      ),
    );
  } catch (error) {
    return applyResponseCookies(authResponse, toApiErrorResponse(error, "Failed to create employee invite."));
  }
}
