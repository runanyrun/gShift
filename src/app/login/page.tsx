import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAuthenticatedUserFromCookies } from "../../core/auth/server-auth";
import { AuthMarketingLayout } from "../../components/auth/AuthMarketingLayout";
import { Skeleton } from "../../components/ui/skeleton";
import { LoginClient } from "./login-client";

export default async function LoginPage() {
  const auth = await getAuthenticatedUserFromCookies();
  if (auth.user) {
    redirect("/");
  }

  return (
    <Suspense
      fallback={
        <AuthMarketingLayout title="Sign in" description="Use your work email to access your workspace.">
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </AuthMarketingLayout>
      }
    >
      <LoginClient />
    </Suspense>
  );
}
