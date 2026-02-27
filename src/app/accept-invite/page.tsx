import { Suspense } from "react";
import { AcceptInviteClient } from "./accept-invite-client";
import { AuthMarketingLayout } from "../../components/auth/AuthMarketingLayout";
import { Skeleton } from "../../components/ui/skeleton";

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <AuthMarketingLayout title="Accept invite" description="Confirm your invite and continue to your workspace.">
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </AuthMarketingLayout>
      }
    >
      <AcceptInviteClient />
    </Suspense>
  );
}
