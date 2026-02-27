import { redirect } from "next/navigation";
import { getAuthenticatedUserFromCookies } from "../core/auth/server-auth";

export default async function HomePage() {
  const auth = await getAuthenticatedUserFromCookies();
  if (!auth.supabase || !auth.user) {
    redirect("/login");
  }

  const { data: userContext } = await auth.supabase
    .from("users")
    .select("company_id, role")
    .eq("auth_user_id", auth.user.id)
    .maybeSingle();

  if (!userContext?.company_id) {
    redirect("/onboarding");
  }

  const { data: employeeRow, error: employeeError } = await auth.supabase
    .from("employees")
    .select("id")
    .eq("tenant_id", userContext.company_id)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (employeeError && !employeeError.message.toLowerCase().includes("schema cache")) {
    redirect("/onboarding");
  }

  if (!employeeRow?.id) {
    redirect("/onboarding");
  }

  if (["owner", "admin", "manager"].includes(userContext.role)) {
    redirect("/dashboard");
  }

  redirect("/jobs");
}
