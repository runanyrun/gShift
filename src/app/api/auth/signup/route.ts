import { NextRequest, NextResponse } from "next/server";
import { signupWithCompany } from "../../../../features/user/services/signup-onboarding.service";

interface SignupRequestBody {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  companyName: string;
  sector?: string;
  countryCode?: string;
  currencyCode?: string;
  timezone?: string;
  planType?: string;
  subscriptionStatus?: string;
}

export async function POST(request: NextRequest) {
  let body: SignupRequestBody;

  try {
    body = (await request.json()) as SignupRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  try {
    const result = await signupWithCompany({
      email: body.email,
      password: body.password,
      firstName: body.firstName ?? null,
      lastName: body.lastName ?? null,
      companyName: body.companyName,
      sector: body.sector ?? null,
      countryCode: body.countryCode ?? null,
      currencyCode: body.currencyCode ?? null,
      timezone: body.timezone ?? null,
      planType: body.planType ?? null,
      subscriptionStatus: body.subscriptionStatus ?? null,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected sign-up failure.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
