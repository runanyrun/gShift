import { createSupabaseClientWithAccessToken, TypedSupabaseClient } from "../db/supabase";

export interface ApiAuthContext {
  supabase: TypedSupabaseClient;
  authUserId: string;
}

export async function authenticateApiRequest(request: Request): Promise<ApiAuthContext> {
  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!accessToken) {
    throw new Error("Missing access token.");
  }

  const supabase = createSupabaseClientWithAccessToken(accessToken);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error("Invalid or expired access token.");
  }

  return {
    supabase,
    authUserId: data.user.id,
  };
}
