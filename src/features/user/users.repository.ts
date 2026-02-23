import { TypedSupabaseClient } from "../../core/db/supabase";
import {
  CreateTenantUserInput,
  TenantUser,
  UpdateTenantUserRoleInput,
  fromDbRole,
  toDbRole,
} from "./users.types";

interface UserRow {
  id: string;
  auth_user_id: string;
  company_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: "owner" | "admin" | "manager" | "employee";
  created_at: string;
}

function mapUserRow(row: UserRow): TenantUser {
  return {
    id: row.id,
    authUserId: row.auth_user_id,
    companyId: row.company_id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    role: fromDbRole(row.role),
    createdAt: row.created_at,
  };
}

export class UsersRepository {
  constructor(private readonly supabase: TypedSupabaseClient) {}

  async getCurrentCompanyId(): Promise<string> {
    const { data, error } = await this.supabase.rpc("current_user_company_id");
    if (error || !data) {
      throw new Error(`Failed to resolve current tenant company: ${error?.message ?? "unknown"}`);
    }
    return data;
  }

  async listByCurrentCompany(): Promise<TenantUser[]> {
    const companyId = await this.getCurrentCompanyId();
    const { data, error } = await this.supabase
      .from("users")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(`Failed to list users: ${error.message}`);
    }

    return data.map((row) => mapUserRow(row as UserRow));
  }

  async findById(userId: string): Promise<TenantUser | null> {
    const companyId = await this.getCurrentCompanyId();
    const { data, error } = await this.supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch user: ${error.message}`);
    }

    return data ? mapUserRow(data as UserRow) : null;
  }

  async create(input: CreateTenantUserInput): Promise<TenantUser> {
    const companyId = await this.getCurrentCompanyId();
    const { data, error } = await this.supabase
      .from("users")
      .insert({
        auth_user_id: input.authUserId,
        company_id: companyId,
        email: input.email.trim().toLowerCase(),
        first_name: input.firstName ?? null,
        last_name: input.lastName ?? null,
        role: toDbRole(input.role),
        created_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }

    return mapUserRow(data as UserRow);
  }

  async updateRole(input: UpdateTenantUserRoleInput): Promise<TenantUser> {
    const companyId = await this.getCurrentCompanyId();
    const { data, error } = await this.supabase
      .from("users")
      .update({
        role: toDbRole(input.role),
      })
      .eq("id", input.userId)
      .eq("company_id", companyId)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to update user role: ${error.message}`);
    }

    return mapUserRow(data as UserRow);
  }

  async delete(userId: string): Promise<void> {
    const companyId = await this.getCurrentCompanyId();
    const { error } = await this.supabase
      .from("users")
      .delete()
      .eq("id", userId)
      .eq("company_id", companyId);

    if (error) {
      throw new Error(`Failed to delete user: ${error.message}`);
    }
  }
}
