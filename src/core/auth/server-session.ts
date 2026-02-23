import { cookies } from "next/headers";
import { createSupabaseClientWithAccessToken } from "../db/supabase";

export async function getServerAuthenticatedUser() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("sb_access_token")?.value;

  if (!accessToken) {
    return null;
  }

  const supabase = createSupabaseClientWithAccessToken(accessToken);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return null;
  }

  return data.user;
}
