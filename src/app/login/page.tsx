import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAuthenticatedUserFromCookies } from "../../core/auth/server-auth";
import { LoginClient } from "./login-client";

export default async function LoginPage() {
  const auth = await getAuthenticatedUserFromCookies();
  if (auth.user) {
    redirect("/");
  }

  return (
    <Suspense fallback={<p>Loading login...</p>}>
      <LoginClient />
    </Suspense>
  );
}
