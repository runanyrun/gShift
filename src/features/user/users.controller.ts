import { getCurrentUserTenantContextOrThrow } from "../../core/auth/current-user";
import { TypedSupabaseClient } from "../../core/db/supabase";
import {
  CreateTenantUserInput,
  DeleteTenantUserInput,
  TenantManagedRole,
  TenantUser,
  UpdateTenantUserRoleInput,
} from "./users.types";
import { UsersRepository } from "./users.repository";

function canManageUsers(role: TenantManagedRole): boolean {
  return role === "owner" || role === "admin";
}

export class UsersController {
  private readonly repository: UsersRepository;

  constructor(private readonly supabase: TypedSupabaseClient) {
    this.repository = new UsersRepository(supabase);
  }

  async listUsers(): Promise<TenantUser[]> {
    await getCurrentUserTenantContextOrThrow(this.supabase);
    return this.repository.listByCurrentCompany();
  }

  async getUserById(userId: string): Promise<TenantUser | null> {
    await getCurrentUserTenantContextOrThrow(this.supabase);
    return this.repository.findById(userId);
  }

  async createUser(input: CreateTenantUserInput): Promise<TenantUser> {
    const context = await getCurrentUserTenantContextOrThrow(this.supabase);
    const actorRole = context.role === "owner" || context.role === "admin" ? context.role : "user";
    if (!canManageUsers(actorRole)) {
      throw new Error("Only owner/admin can create users.");
    }

    return this.repository.create(input);
  }

  async updateUserRole(input: UpdateTenantUserRoleInput): Promise<TenantUser> {
    const context = await getCurrentUserTenantContextOrThrow(this.supabase);
    const actorRole = context.role === "owner" || context.role === "admin" ? context.role : "user";
    if (!canManageUsers(actorRole)) {
      throw new Error("Only owner/admin can update user roles.");
    }

    if (input.role === "owner" && actorRole !== "owner") {
      throw new Error("Only owner can assign owner role.");
    }

    return this.repository.updateRole(input);
  }

  async deleteUser(input: DeleteTenantUserInput): Promise<void> {
    const context = await getCurrentUserTenantContextOrThrow(this.supabase);
    const actorRole = context.role === "owner" || context.role === "admin" ? context.role : "user";
    if (!canManageUsers(actorRole)) {
      throw new Error("Only owner/admin can delete users.");
    }

    await this.repository.delete(input.userId);
  }
}
