import { NextResponse } from "next/server";
import { authenticateApiRequest } from "../../../../../../core/auth/api-auth";
import { getCurrentUserTenantContext } from "../../../../../../core/auth/current-user";

type ShiftResponseStatus = "accepted" | "declined";

interface RespondRequestBody {
  status?: unknown;
  note?: unknown;
}

function resolveStatus(errorMessage: string): number {
  if (
    errorMessage.includes("Missing access token") ||
    errorMessage.includes("Invalid or expired access token") ||
    errorMessage.includes("Auth session missing") ||
    errorMessage.includes("Unauthenticated request")
  ) {
    return 401;
  }

  if (
    errorMessage.includes("User is not connected to a tenant") ||
    errorMessage.includes("Employee profile is not linked") ||
    errorMessage.includes("Cannot respond to another employee shift") ||
    errorMessage.includes("outside current tenant")
  ) {
    return 403;
  }

  if (errorMessage.includes("Shift not found")) {
    return 404;
  }

  return 400;
}

function parseStatus(value: unknown): ShiftResponseStatus {
  if (value === "accepted" || value === "declined") {
    return value;
  }
  throw new Error("Invalid shift response status.");
}

function parseNote(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error("Shift response note must be a string.");
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, authUserId } = await authenticateApiRequest(request);
    const context = await getCurrentUserTenantContext(supabase);

    if (!context) {
      return NextResponse.json(
        { ok: false, error: { message: "User is not connected to a tenant.", code: "tenant_missing" } },
        { status: 403 },
      );
    }

    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select("id")
      .eq("tenant_id", context.companyId)
      .eq("user_id", authUserId)
      .maybeSingle();

    if (employeeError) {
      throw new Error(`Failed to resolve employee context: ${employeeError.message}`);
    }

    if (!employee) {
      return NextResponse.json(
        { ok: false, error: { message: "Employee profile is not linked.", code: "employee_missing" } },
        { status: 403 },
      );
    }

    const payload = (await request.json()) as RespondRequestBody;
    const status = parseStatus(payload.status);
    const note = parseNote(payload.note);

    const { data, error } = await supabase
      .rpc("respond_to_shift", {
        p_shift_id: id,
        p_status: status,
        p_note: note,
      })
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json(
      {
        ok: true,
        data: {
          id: data.id,
          acceptance_status: data.acceptance_status,
          responded_at: data.responded_at,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to respond to shift.";
    return NextResponse.json(
      { ok: false, error: { message, code: "bad_request" } },
      { status: resolveStatus(message) },
    );
  }
}
