import {
  createServerSupabaseClient,
  createSupabaseClientWithAccessToken,
  TypedSupabaseClient,
} from "../../../core/db/supabase";
import { CompanyService } from "../../company/services/company.service";
import { UserService } from "../../user/services/user.service";
import { SignupWithCompanyInput } from "../../user/types/user.types";
import { SignUpAndOnboardInput, SignUpAndOnboardResult } from "../types/auth.types";

function normalizeInput(input: SignUpAndOnboardInput): SignUpAndOnboardInput {
  return {
    ...input,
    email: input.email.trim().toLowerCase(),
    password: input.password,
    firstName: input.firstName?.trim() ?? null,
    lastName: input.lastName?.trim() ?? null,
    companyName: input.companyName.trim(),
    sector: input.sector?.trim() ?? null,
    countryCode: input.countryCode?.trim() ?? null,
    currencyCode: input.currencyCode?.trim() ?? null,
    timezone: input.timezone?.trim() ?? null,
    planType: input.planType?.trim() ?? null,
    subscriptionStatus: input.subscriptionStatus?.trim() ?? null,
  };
}

function assertInput(input: SignUpAndOnboardInput): void {
  if (!input.email) {
    throw new Error("Email is required.");
  }
  if (!input.password) {
    throw new Error("Password is required.");
  }
  if (!input.companyName) {
    throw new Error("Company name is required.");
  }
}

async function completeOwnerOnboarding(
  authorizedClient: TypedSupabaseClient,
  authUserId: string,
  input: SignupWithCompanyInput,
): Promise<{ companyId: string; profileId: string }> {
  const companyService = new CompanyService(authorizedClient);
  const userService = new UserService(authorizedClient);

  const onboarding = await userService.completeOwnerOnboarding({
    authUserId,
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    companyName: input.companyName,
    sector: input.sector,
    countryCode: input.countryCode,
    currencyCode: input.currencyCode,
    timezone: input.timezone,
    planType: input.planType,
    subscriptionStatus: input.subscriptionStatus,
  });

  const company = await companyService.getScopedCompany(onboarding.companyId);
  if (!company) {
    throw new Error("Onboarding failed: company could not be loaded.");
  }

  return onboarding;
}

export class AuthService {
  constructor(
    private readonly publicClient: TypedSupabaseClient = createServerSupabaseClient(),
  ) {}

  async signUpAndOnboardOwner(
    rawInput: SignUpAndOnboardInput,
  ): Promise<SignUpAndOnboardResult> {
    const input = normalizeInput(rawInput);
    assertInput(input);

    const { data, error } = await this.publicClient.auth.signUp({
      email: input.email,
      password: input.password,
    });

    if (error) {
      throw new Error(`Sign-up failed: ${error.message}`);
    }

    const authUserId = data.user?.id;
    if (!authUserId) {
      throw new Error("Sign-up failed: auth user was not created.");
    }

    const accessToken = data.session?.access_token;
    if (!accessToken) {
      return {
        authUserId,
        companyId: "",
        profileId: "",
        requiresEmailVerification: true,
      };
    }

    const authorizedClient = createSupabaseClientWithAccessToken(accessToken);

    try {
      const onboarding = await completeOwnerOnboarding(
        authorizedClient,
        authUserId,
        input,
      );

      return {
        authUserId,
        companyId: onboarding.companyId,
        profileId: onboarding.profileId,
        requiresEmailVerification: false,
      };
    } catch (error) {
      await authorizedClient.auth.signOut();
      throw error;
    }
  }
}
