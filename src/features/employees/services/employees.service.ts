import { getCurrentUserTenantContextOrThrow } from "../../../core/auth/current-user";
import { TypedSupabaseClient } from "../../../core/db/supabase";
import { resolveCurrentCompanySlug } from "../../../core/tenancy/resolve-company";
import { EmployeesRepository } from "../employees.repository";
import {
  DictionaryItem,
  EmployeeFilters,
  EmployeeRecord,
  InviteCreateResult,
  UpsertEmployeeInput,
} from "../types/employees.types";

function isManagementRole(role: "owner" | "admin" | "manager" | "employee"): boolean {
  return role === "owner" || role === "admin" || role === "manager";
}

function maskEmployeeNotes(employee: EmployeeRecord): EmployeeRecord {
  return {
    ...employee,
    notes: null,
  };
}

export class EmployeesService {
  private readonly repository: EmployeesRepository;

  constructor(private readonly supabase: TypedSupabaseClient) {
    this.repository = new EmployeesRepository(supabase);
  }

  async listDictionary(
    table: "job_titles" | "departments" | "locations",
  ): Promise<DictionaryItem[]> {
    await getCurrentUserTenantContextOrThrow(this.supabase);
    return this.repository.listDictionary(table);
  }

  async createDictionary(
    table: "job_titles" | "departments" | "locations",
    input: { name: string; isActive?: boolean },
  ): Promise<DictionaryItem> {
    const context = await getCurrentUserTenantContextOrThrow(this.supabase);
    if (!isManagementRole(context.role)) {
      throw new Error("Only management/admin can create dictionary records.");
    }
    const trimmedName = input.name.trim();
    if (!trimmedName) {
      throw new Error("Name is required.");
    }
    return this.repository.createDictionary(table, trimmedName, input.isActive ?? true);
  }

  async updateDictionary(
    table: "job_titles" | "departments" | "locations",
    id: string,
    patch: { name?: string; isActive?: boolean },
  ): Promise<DictionaryItem> {
    const context = await getCurrentUserTenantContextOrThrow(this.supabase);
    if (!isManagementRole(context.role)) {
      throw new Error("Only management/admin can update dictionary records.");
    }
    const normalizedPatch = {
      ...patch,
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
    };
    return this.repository.updateDictionary(table, id, normalizedPatch);
  }

  async listEmployees(filters: EmployeeFilters): Promise<EmployeeRecord[]> {
    const context = await getCurrentUserTenantContextOrThrow(this.supabase);
    if (!isManagementRole(context.role)) {
      const own = await this.repository.getOwnEmployeeMasked();
      return own ? [own] : [];
    }
    return this.repository.listEmployees(filters);
  }

  async getEmployeeById(id: string): Promise<EmployeeRecord | null> {
    const context = await getCurrentUserTenantContextOrThrow(this.supabase);
    if (!isManagementRole(context.role)) {
      const own = await this.repository.getOwnEmployeeMasked();
      if (!own || own.id !== id) {
        return null;
      }
      return own;
    }
    return this.repository.getEmployeeById(id);
  }

  async createEmployee(input: UpsertEmployeeInput): Promise<EmployeeRecord> {
    const context = await getCurrentUserTenantContextOrThrow(this.supabase);
    if (!isManagementRole(context.role)) {
      throw new Error("Only management/admin can create employees.");
    }
    return this.repository.createEmployee(input);
  }

  async updateEmployee(id: string, input: UpsertEmployeeInput): Promise<EmployeeRecord> {
    const context = await getCurrentUserTenantContextOrThrow(this.supabase);
    if (!isManagementRole(context.role)) {
      throw new Error("Only management/admin can update employees.");
    }
    return this.repository.updateEmployee(id, input);
  }

  async createInvite(params: {
    employeeId: string;
    email: string;
    tokenHash: string;
    expiresAt: string;
  }): Promise<InviteCreateResult> {
    const context = await getCurrentUserTenantContextOrThrow(this.supabase);
    if (!isManagementRole(context.role)) {
      throw new Error("Only management/admin can create invites.");
    }
    const invite = await this.repository.createInvite({
      employeeId: params.employeeId,
      email: params.email,
      tokenHash: params.tokenHash,
      expiresAt: params.expiresAt,
      createdBy: context.authUserId,
    });
    const companySlug = await resolveCurrentCompanySlug(this.supabase);
    return {
      inviteId: invite.id,
      status: invite.status,
      companySlug,
    };
  }

  async acceptInvite(rawToken: string): Promise<{ employeeId: string; tenantId: string }> {
    if (!rawToken.trim()) {
      throw new Error("Invite token is required.");
    }
    return this.repository.acceptInvite(rawToken.trim());
  }
}
