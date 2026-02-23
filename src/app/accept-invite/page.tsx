import { Suspense } from "react";
import { AcceptInviteClient } from "./accept-invite-client";

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<p>Loading invite...</p>}>
      <AcceptInviteClient />
    </Suspense>
  );
}
