import { NextResponse } from "next/server";
import { DashboardBootstrapService } from "../../../../features/dashboard/services/dashboard-bootstrap.service";

function resolveStatus(errorMessage: string): number {
  if (errorMessage.includes("Authenticated user context was not found")) {
    return 401;
  }
  return 400;
}

export async function GET() {
  try {
    const service = new DashboardBootstrapService();
    const payload = await service.getBootstrap();
    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load dashboard bootstrap.";
    return NextResponse.json({ error: message }, { status: resolveStatus(message) });
  }
}
