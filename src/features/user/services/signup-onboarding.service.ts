import { AuthService } from "../../auth/services/auth.service";
import { SignupWithCompanyInput } from "../types/user.types";

export interface SignupOnboardingResult {
  companyId: string;
  profileId: string;
  authUserId: string;
}

export async function signupWithCompany(
  input: SignupWithCompanyInput,
): Promise<SignupOnboardingResult> {
  const authService = new AuthService();
  const result = await authService.signUpAndOnboardOwner(input);

  if (result.requiresEmailVerification) {
    throw new Error(
      "Sign-up completed but email verification is required before onboarding can finish.",
    );
  }

  return {
    authUserId: result.authUserId,
    companyId: result.companyId,
    profileId: result.profileId,
  };
}
