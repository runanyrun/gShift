import { TypedSupabaseClient } from "../../../core/db/supabase";
import { CreateUserProfileInput, UserProfile } from "../types/user.types";

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
}
