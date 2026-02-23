import { TypedSupabaseClient } from "../../../core/db/supabase";
import { withCompanyScope } from "../../../core/permissions/tenant-scope";
import {
  CompleteOwnerOnboardingInput,
  CreateUserProfileInput,
  OwnerOnboardingResult,
  UserProfile,
} from "../types/user.types";

function mapUserRowToProfile(row: {
  id: string;
  auth_user_id: string;
  company_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: "owner" | "admin" | "manager" | "employee";
  created_at: string;
}): UserProfile {
  return {
    id: row.id,
    authUserId: row.auth_user_id,
    companyId: row.company_id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    role: row.role,
    createdAt: row.created_at,
  };
}

export class UserService {
  constructor(private readonly supabase: TypedSupabaseClient) {}

  async createUserProfile(input: CreateUserProfileInput): Promise<UserProfile> {
    const email = input.email.trim().toLowerCase();
    if (!email) {
      throw new Error("Email is required.");
    }

    const { data, error } = await this.supabase
      .from("users")
      .insert({
        auth_user_id: input.authUserId,
        company_id: input.companyId,
        email,
        first_name: input.firstName ?? null,
        last_name: input.lastName ?? null,
        role: input.role,
        created_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to create user profile: ${error.message}`);
    }

    return mapUserRowToProfile(data);
  }

  async completeOwnerOnboarding(
    input: CompleteOwnerOnboardingInput,
  ): Promise<OwnerOnboardingResult> {
    const { data, error } = await this.supabase.rpc("complete_owner_onboarding", {
      p_auth_user_id: input.authUserId,
      p_email: input.email.trim().toLowerCase(),
      p_first_name: input.firstName ?? null,
      p_last_name: input.lastName ?? null,
      p_company_name: input.companyName.trim(),
      p_sector: input.sector ?? null,
      p_country_code: input.countryCode ?? null,
      p_currency_code: input.currencyCode ?? null,
      p_timezone: input.timezone ?? null,
      p_plan_type: input.planType ?? null,
      p_subscription_status: input.subscriptionStatus ?? null,
    });

    if (error) {
      throw new Error(`Failed to complete onboarding: ${error.message}`);
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.company_id || !row?.profile_id) {
      throw new Error("Failed to complete onboarding: invalid RPC response.");
    }

    return {
      companyId: row.company_id as string,
      profileId: row.profile_id as string,
    };
  }

  async getCurrentUserProfile(authUserId: string): Promise<UserProfile | null> {
    const { data, error } = await this.supabase
      .from("users")
      .select("*")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch user profile: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return mapUserRowToProfile(data);
  }

  async listUsersByCompany(companyId: string): Promise<UserProfile[]> {
    const companyScopedQuery = withCompanyScope(
      this.supabase.from("users").select("*"),
      companyId,
    );
    const { data, error } = await companyScopedQuery;

    if (error) {
      throw new Error(`Failed to list users by company: ${error.message}`);
    }

    return data.map(mapUserRowToProfile);
  }
}
