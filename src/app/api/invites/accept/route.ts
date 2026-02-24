import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "../../../../core/auth/api-auth";
import { toApiErrorResponse } from "../../../../core/auth/api-error-response";
import { applyResponseCookies } from "../../../../core/auth/supabase-server-client";
import { EmployeesController } from "../../../../features/employees/employees.controller";

function mapInviteAcceptError(error: unknown): NextResponse | null {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("user-already-in-company")) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "user-already-in-company",
          message: "User is already associated with a different workspace.",
        },
      },
      { status: 409 },
    );
  }

  if (message.includes("invite-invalid")) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "invite-invalid",
          message: "Invite token is invalid.",
        },
      },
      { status: 404 },
    );
  }

  if (message.includes("invite-expired")) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "invite-expired",
          message: "Invite token has expired.",
        },
      },
      { status: 410 },
    );
  }

  if (message.includes("invite-not-pending") || message.includes("invite-already-claimed")) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "invite-not-pending",
          message: "Invite cannot be accepted in its current state.",
        },
      },
      { status: 400 },
    );
  }

  return null;
}

export async function POST(request: NextRequest) {
  let authResponse: NextResponse | undefined;
  try {
    const auth = await authenticateApiRequest(request);
    authResponse = auth.response;
    const { supabase } = auth;
    const body = (await request.json()) as { token?: string };
    const token = body.token?.trim();
    if (!token) {
      return applyResponseCookies(
        authResponse,
        NextResponse.json({ ok: false, error: "Invite token is required." }, { status: 400 }),
      );
    }

    const controller = new EmployeesController(supabase);
    const data = await controller.acceptInvite(token);
    return applyResponseCookies(authResponse, NextResponse.json({ ok: true, data }, { status: 200 }));
  } catch (error) {
    const mapped = mapInviteAcceptError(error);
    if (mapped) {
      return applyResponseCookies(authResponse, mapped);
    }
    return applyResponseCookies(authResponse, toApiErrorResponse(error, "Failed to accept invite."));
  }
}
