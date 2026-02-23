import { NextResponse } from "next/server";
import { createSupabaseClientWithAccessToken } from "../../../../core/db/supabase";
import { DashboardBootstrapService } from "../../../../features/dashboard/services/dashboard-bootstrap.service";

function resolveStatus(errorMessage: string): number {
  if (
    errorMessage.includes("Authenticated user context was not found") ||
    errorMessage.includes("Auth session missing")
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

    const service = new DashboardBootstrapService(supabase);
    const payload = await service.getBootstrap();
    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load dashboard bootstrap.";
    return NextResponse.json({ error: message }, { status: resolveStatus(message) });
  }
}
