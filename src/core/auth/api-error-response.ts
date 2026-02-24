import { NextResponse } from "next/server";

function isUnauthorized(message: string): boolean {
  return (
    message.includes("Missing access token") ||
    message.includes("Invalid or expired access token") ||
    message.includes("Unauthorized") ||
    message.includes("Authenticated user context was not found") ||
    message.includes("Auth session missing") ||
    message.includes("Unauthenticated request")
  );
}

export function toApiErrorResponse(err: unknown, fallback: string): NextResponse {
  const message = err instanceof Error ? err.message : fallback;

  if (message === "no-permission") {
    return NextResponse.json({ ok: false, error: "no-permission" }, { status: 403 });
  }

  if (isUnauthorized(message)) {
    return NextResponse.json({ ok: false, error: message }, { status: 401 });
  }

  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}
