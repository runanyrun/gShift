import { Suspense } from "react";
import { LoginClient } from "./login-client";

export default function LoginPage() {
  return (
    <Suspense fallback={<p>Loading login...</p>}>
      <LoginClient />
    </Suspense>
  );
}
