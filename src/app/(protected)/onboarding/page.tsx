import Link from "next/link";

interface OnboardingPageProps {
  searchParams?: Promise<{ token?: string }>;
}

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const token = params?.token;
  const inviteHref = token
    ? `/accept-invite?token=${encodeURIComponent(token)}`
    : "/accept-invite";

  return (
    <main>
      <h1>Onboarding</h1>
      <p>You&apos;re not connected to a company yet.</p>
      <p>Ask your manager to invite you.</p>
      <p>
        <Link href={inviteHref}>{token ? "Continue invite" : "Go to invite page"}</Link>
      </p>
      <p>
        <Link href="/dashboard">Retry</Link>
      </p>
    </main>
  );
}
