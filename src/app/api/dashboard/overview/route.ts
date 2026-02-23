import { NextResponse } from "next/server";
import { createSupabaseClientWithAccessToken } from "../../../../core/db/supabase";
import { DashboardController } from "../../../../features/dashboard/dashboard.controller";

function resolveStatus(errorMessage: string): number {
  if (
    errorMessage.includes("Authenticated user context was not found") ||
    errorMessage.includes("Auth session missing") ||
    errorMessage.includes("Authenticated user mismatch")
  ) {
    return 401;
  }
  return 400;
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const accessToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;

    if (!accessToken) {
      return NextResponse.json({ error: "Missing access token." }, { status: 401 });
    }

    const supabase = createSupabaseClientWithAccessToken(accessToken);
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json(
        { error: "Invalid or expired access token." },
        { status: 401 },
      );
    }

    const controller = new DashboardController(supabase);
    const payload = await controller.getOverviewForCurrentUser(authData.user.id);
    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load dashboard overview.";
    return NextResponse.json({ error: message }, { status: resolveStatus(message) });
  }
}
