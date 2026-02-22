import {
  createSupabaseClient,
  createSupabaseClientWithAccessToken,
} from "../../../core/db/supabase";
import { CompanyService } from "../../company/services/company.service";
import { SignupWithCompanyInput, UserProfile } from "../types/user.types";
import { UserService } from "./user.service";

export interface SignupOnboardingResult {
  companyId: string;
  profileId: string;
  authUserId: string;
}

function normalizeSignupInput(input: SignupWithCompanyInput): SignupWithCompanyInput {
  return {
    ...input,
    email: input.email.trim().toLowerCase(),
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

function assertSignupInput(input: SignupWithCompanyInput): void {
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

async function createOwnerProfile(
  accessToken: string,
  authUserId: string,
  input: SignupWithCompanyInput,
): Promise<{ companyId: string; profile: UserProfile }> {
  const authorizedClient = createSupabaseClientWithAccessToken(accessToken);
  const companyService = new CompanyService(authorizedClient);
  const userService = new UserService(authorizedClient);

  const company = await companyService.createCompany({
    name: input.companyName,
    sector: input.sector,
    countryCode: input.countryCode,
    currencyCode: input.currencyCode,
    timezone: input.timezone,
    planType: input.planType,
    subscriptionStatus: input.subscriptionStatus,
  });

  const profile = await userService.createUserProfile({
    authUserId,
    companyId: company.id,
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    role: "owner",
  });

  return { companyId: company.id, profile };
}

export async function signupWithCompany(
  rawInput: SignupWithCompanyInput,
): Promise<SignupOnboardingResult> {
  const input = normalizeSignupInput(rawInput);
  assertSignupInput(input);

  const publicClient = createSupabaseClient();

  const { data, error } = await publicClient.auth.signUp({
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
    throw new Error(
      "Sign-up succeeded but no active session was returned. If email confirmation is enabled, complete verification first or implement a post-confirmation onboarding hook.",
    );
  }

  const { companyId, profile } = await createOwnerProfile(
    accessToken,
    authUserId,
    input,
  );

  return {
    companyId,
    profileId: profile.id,
    authUserId,
  };
}
