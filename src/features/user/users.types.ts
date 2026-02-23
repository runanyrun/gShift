import { UserRole } from "../../core/db/database.types";

export type TenantManagedRole = "owner" | "admin" | "user";

export interface TenantUser {
  id: string;
  authUserId: string;
  companyId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: TenantManagedRole;
  createdAt: string;
}

export interface CreateTenantUserInput {
  authUserId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role: TenantManagedRole;
}

export interface UpdateTenantUserRoleInput {
  userId: string;
  role: TenantManagedRole;
}

export interface DeleteTenantUserInput {
  userId: string;
}

export function fromDbRole(role: UserRole): TenantManagedRole {
  if (role === "owner" || role === "admin") {
    return role;
  }
  return "user";
}

export function toDbRole(role: TenantManagedRole): UserRole {
  if (role === "owner" || role === "admin") {
    return role;
  }
  return "employee";
}
