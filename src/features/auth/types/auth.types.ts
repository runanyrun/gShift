import { SignupWithCompanyInput } from "../../user/types/user.types";

export interface SignUpAndOnboardInput extends SignupWithCompanyInput {}

export interface SignUpAndOnboardResult {
  authUserId: string;
  companyId: string;
  profileId: string;
  requiresEmailVerification: boolean;
}
