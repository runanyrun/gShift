import OnboardingClient from "./onboarding-client";

interface OnboardingPageProps {
  searchParams?: Promise<{ token?: string }>;
}

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const token = params?.token;

  return (
    <main>
      <h1>Onboarding</h1>
      <OnboardingClient token={token} />
    </main>
  );
}
