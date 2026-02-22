import { UserRole } from "../../../core/db/database.types";

export interface CreateUserProfileInput {
  authUserId: string;
  companyId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role: UserRole;
}

export interface UserProfile {
  id: string;
  authUserId: string;
  companyId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
  createdAt: string;
}

export interface SignupWithCompanyInput {
  email: string;
  password: string;
  firstName?: string | null;
  lastName?: string | null;
  companyName: string;
  sector?: string | null;
  countryCode?: string | null;
  currencyCode?: string | null;
  timezone?: string | null;
  planType?: string | null;
  subscriptionStatus?: string | null;
}
