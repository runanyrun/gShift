import { NextResponse } from "next/server";
import { getServerAuthenticatedUser } from "../../../../core/auth/server-session";

export async function GET() {
  const user = await getServerAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    {
      id: user.id,
      email: user.email ?? null,
    },
    { status: 200 },
  );
}
