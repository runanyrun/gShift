import { TypedSupabaseClient } from "../../core/db/supabase";
import {
  DictionaryItem,
  EmployeeFilters,
  EmployeeInvite,
  EmployeeRecord,
  UpsertEmployeeInput,
} from "./types/employees.types";

function mapDictionaryRow(row: {
  id: string;
  tenant_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}): DictionaryItem {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEmployeeRow(row: {
  id: string;
  tenant_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone1: string | null;
  phone2: string | null;
  gender: string | null;
  birth_date: string | null;
  is_active: boolean;
  job_title_id: string | null;
  department_id: string | null;
  start_date: string | null;
  end_date: string | null;
  payroll_id: string | null;
  default_break_minutes: number | null;
  default_shift_hours: number | null;
  notes: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}): EmployeeRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone1: row.phone1,
    phone2: row.phone2,
    gender: row.gender,
    birthDate: row.birth_date,
    isActive: row.is_active,
    jobTitleId: row.job_title_id,
    departmentId: row.department_id,
    startDate: row.start_date,
    endDate: row.end_date,
    payrollId: row.payroll_id,
    defaultBreakMinutes: row.default_break_minutes,
    defaultShiftHours: row.default_shift_hours,
    notes: row.notes,
    userId: row.user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapInviteRow(row: {
  id: string;
  tenant_id: string;
  employee_id: string;
  email: string;
  expires_at: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  created_by: string;
  created_at: string;
}): EmployeeInvite {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    employeeId: row.employee_id,
    email: row.email,
    expiresAt: row.expires_at,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export class EmployeesRepository {
  constructor(private readonly supabase: TypedSupabaseClient) {}

  async getTenantId(): Promise<string> {
    const { data, error } = await this.supabase.rpc("current_user_company_id");
    if (error || !data) {
      throw new Error(`Failed to resolve tenant id: ${error?.message ?? "unknown"}`);
    }
    return data;
  }

  async listDictionary(
    table: "job_titles" | "departments" | "locations",
  ): Promise<DictionaryItem[]> {
    const tenantId = await this.getTenantId();
    const { data, error } = await this.supabase
      .from(table)
      .select("*")
      .eq("tenant_id", tenantId)
      .order("name", { ascending: true });
    if (error) {
      throw new Error(`Failed to list ${table}: ${error.message}`);
    }
    return data.map((row) =>
      mapDictionaryRow(
        row as {
          id: string;
          tenant_id: string;
          name: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        },
      ),
    );
  }

  async createDictionary(
    table: "job_titles" | "departments" | "locations",
    name: string,
    isActive: boolean,
  ): Promise<DictionaryItem> {
    const tenantId = await this.getTenantId();
    const { data, error } = await this.supabase
      .from(table)
      .insert({
        tenant_id: tenantId,
        name,
        is_active: isActive,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (error) {
      throw new Error(`Failed to create ${table} item: ${error.message}`);
    }
    return mapDictionaryRow(
      data as {
        id: string;
        tenant_id: string;
        name: string;
        is_active: boolean;
        created_at: string;
        updated_at: string;
      },
    );
  }

  async updateDictionary(
    table: "job_titles" | "departments" | "locations",
    id: string,
    patch: { name?: string; isActive?: boolean },
  ): Promise<DictionaryItem> {
    const tenantId = await this.getTenantId();
    const { data, error } = await this.supabase
      .from(table)
      .update({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.isActive !== undefined ? { is_active: patch.isActive } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .select("*")
      .single();
    if (error) {
      throw new Error(`Failed to update ${table} item: ${error.message}`);
    }
    return mapDictionaryRow(
      data as {
        id: string;
        tenant_id: string;
        name: string;
        is_active: boolean;
        created_at: string;
        updated_at: string;
      },
    );
  }

  async listEmployees(filters: EmployeeFilters): Promise<EmployeeRecord[]> {
    const tenantId = await this.getTenantId();
    let query = this.supabase.from("employees").select("*").eq("tenant_id", tenantId);
    if (filters.isActive !== undefined) {
      query = query.eq("is_active", filters.isActive);
    }
    if (filters.departmentId) {
      query = query.eq("department_id", filters.departmentId);
    }
    if (filters.jobTitleId) {
      query = query.eq("job_title_id", filters.jobTitleId);
    }
    if (filters.locationId) {
      const { data: locationRows, error: locationError } = await this.supabase
        .from("employee_locations")
        .select("employee_id")
        .eq("tenant_id", tenantId)
        .eq("location_id", filters.locationId);

      if (locationError) {
        throw new Error(`Failed to filter employees by location: ${locationError.message}`);
      }
      const employeeIds = locationRows.map((row) => row.employee_id);
      if (employeeIds.length === 0) {
        return [];
      }
      query = query.in("id", employeeIds);
    }

    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) {
      throw new Error(`Failed to list employees: ${error.message}`);
    }
    return data.map((row) =>
      mapEmployeeRow(
        row as {
          id: string;
          tenant_id: string;
          first_name: string;
          last_name: string;
          email: string;
          phone1: string | null;
          phone2: string | null;
          gender: string | null;
          birth_date: string | null;
          is_active: boolean;
          job_title_id: string | null;
          department_id: string | null;
          start_date: string | null;
          end_date: string | null;
          payroll_id: string | null;
          default_break_minutes: number | null;
          default_shift_hours: number | null;
          notes: string | null;
          user_id: string | null;
          created_at: string;
          updated_at: string;
        },
      ),
    );
  }

  async getEmployeeById(id: string): Promise<EmployeeRecord | null> {
    const tenantId = await this.getTenantId();
    const { data, error } = await this.supabase
      .from("employees")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to get employee: ${error.message}`);
    }
    if (!data) {
      return null;
    }
    return mapEmployeeRow(
      data as {
        id: string;
        tenant_id: string;
        first_name: string;
        last_name: string;
        email: string;
        phone1: string | null;
        phone2: string | null;
        gender: string | null;
        birth_date: string | null;
        is_active: boolean;
        job_title_id: string | null;
        department_id: string | null;
        start_date: string | null;
        end_date: string | null;
        payroll_id: string | null;
        default_break_minutes: number | null;
        default_shift_hours: number | null;
        notes: string | null;
        user_id: string | null;
        created_at: string;
        updated_at: string;
      },
    );
  }

  async getOwnEmployeeMasked(): Promise<EmployeeRecord | null> {
    const { data, error } = await this.supabase.rpc("get_my_employee");
    if (error) {
      throw new Error(`Failed to load own employee record: ${error.message}`);
    }
    const row = Array.isArray(data) ? data[0] : null;
    if (!row) {
      return null;
    }
    return mapEmployeeRow(
      row as {
        id: string;
        tenant_id: string;
        first_name: string;
        last_name: string;
        email: string;
        phone1: string | null;
        phone2: string | null;
        gender: string | null;
        birth_date: string | null;
        is_active: boolean;
        job_title_id: string | null;
        department_id: string | null;
        start_date: string | null;
        end_date: string | null;
        payroll_id: string | null;
        default_break_minutes: number | null;
        default_shift_hours: number | null;
        notes: string | null;
        user_id: string | null;
        created_at: string;
        updated_at: string;
      },
    );
  }

  async createEmployee(input: UpsertEmployeeInput): Promise<EmployeeRecord> {
    const tenantId = await this.getTenantId();
    const { data, error } = await this.supabase
      .from("employees")
      .insert({
        tenant_id: tenantId,
        first_name: input.firstName,
        last_name: input.lastName,
        email: input.email.trim().toLowerCase(),
        phone1: input.phone1 ?? null,
        phone2: input.phone2 ?? null,
        gender: input.gender ?? null,
        birth_date: input.birthDate ?? null,
        is_active: input.isActive ?? true,
        job_title_id: input.jobTitleId ?? null,
        department_id: input.departmentId ?? null,
        start_date: input.startDate ?? null,
        end_date: input.endDate ?? null,
        payroll_id: input.payrollId ?? null,
        default_break_minutes: input.defaultBreakMinutes ?? null,
        default_shift_hours: input.defaultShiftHours ?? null,
        notes: input.notes ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (error) {
      throw new Error(`Failed to create employee: ${error.message}`);
    }

    const employee = mapEmployeeRow(
      data as {
        id: string;
        tenant_id: string;
        first_name: string;
        last_name: string;
        email: string;
        phone1: string | null;
        phone2: string | null;
        gender: string | null;
        birth_date: string | null;
        is_active: boolean;
        job_title_id: string | null;
        department_id: string | null;
        start_date: string | null;
        end_date: string | null;
        payroll_id: string | null;
        default_break_minutes: number | null;
        default_shift_hours: number | null;
        notes: string | null;
        user_id: string | null;
        created_at: string;
        updated_at: string;
      },
    );

    await this.replaceEmployeeLocations(employee.id, input.locationIds ?? []);
    return employee;
  }

  async updateEmployee(id: string, input: UpsertEmployeeInput): Promise<EmployeeRecord> {
    const tenantId = await this.getTenantId();
    const { data, error } = await this.supabase
      .from("employees")
      .update({
        first_name: input.firstName,
        last_name: input.lastName,
        email: input.email.trim().toLowerCase(),
        phone1: input.phone1 ?? null,
        phone2: input.phone2 ?? null,
        gender: input.gender ?? null,
        birth_date: input.birthDate ?? null,
        is_active: input.isActive ?? true,
        job_title_id: input.jobTitleId ?? null,
        department_id: input.departmentId ?? null,
        start_date: input.startDate ?? null,
        end_date: input.endDate ?? null,
        payroll_id: input.payrollId ?? null,
        default_break_minutes: input.defaultBreakMinutes ?? null,
        default_shift_hours: input.defaultShiftHours ?? null,
        notes: input.notes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      throw new Error(`Failed to update employee: ${error.message}`);
    }
    await this.replaceEmployeeLocations(id, input.locationIds ?? []);
    return mapEmployeeRow(
      data as {
        id: string;
        tenant_id: string;
        first_name: string;
        last_name: string;
        email: string;
        phone1: string | null;
        phone2: string | null;
        gender: string | null;
        birth_date: string | null;
        is_active: boolean;
        job_title_id: string | null;
        department_id: string | null;
        start_date: string | null;
        end_date: string | null;
        payroll_id: string | null;
        default_break_minutes: number | null;
        default_shift_hours: number | null;
        notes: string | null;
        user_id: string | null;
        created_at: string;
        updated_at: string;
      },
    );
  }

  async replaceEmployeeLocations(employeeId: string, locationIds: string[]): Promise<void> {
    const tenantId = await this.getTenantId();
    const { error: deleteError } = await this.supabase
      .from("employee_locations")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("employee_id", employeeId);
    if (deleteError) {
      throw new Error(`Failed to clear employee locations: ${deleteError.message}`);
    }

    if (locationIds.length === 0) {
      return;
    }

    const uniqueIds = [...new Set(locationIds)];
    const { error: insertError } = await this.supabase.from("employee_locations").insert(
      uniqueIds.map((locationId) => ({
        tenant_id: tenantId,
        employee_id: employeeId,
        location_id: locationId,
        created_at: new Date().toISOString(),
      })),
    );
    if (insertError) {
      throw new Error(`Failed to save employee locations: ${insertError.message}`);
    }
  }

  async createInvite(params: {
    employeeId: string;
    email: string;
    tokenHash: string;
    expiresAt: string;
    createdBy: string;
  }): Promise<EmployeeInvite> {
    const tenantId = await this.getTenantId();
    const { data, error } = await this.supabase
      .from("employee_invites")
      .insert({
        tenant_id: tenantId,
        employee_id: params.employeeId,
        email: params.email.trim().toLowerCase(),
        token_hash: params.tokenHash,
        expires_at: params.expiresAt,
        status: "pending",
        created_by: params.createdBy,
        created_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (error) {
      throw new Error(`Failed to create employee invite: ${error.message}`);
    }
    return mapInviteRow(
      data as {
        id: string;
        tenant_id: string;
        employee_id: string;
        email: string;
        expires_at: string;
        status: "pending" | "accepted" | "revoked" | "expired";
        created_by: string;
        created_at: string;
      },
    );
  }

  async acceptInvite(rawToken: string): Promise<{ employeeId: string; tenantId: string }> {
    const { data, error } = await this.supabase.rpc("accept_employee_invite", {
      p_raw_token: rawToken,
    });
    if (error) {
      throw new Error(error.message);
    }
    const row = Array.isArray(data) ? data[0] : null;
    if (!row?.employee_id || !row?.tenant_id) {
      throw new Error("Invite acceptance returned invalid response.");
    }
    return {
      employeeId: row.employee_id as string,
      tenantId: row.tenant_id as string,
    };
  }
}
