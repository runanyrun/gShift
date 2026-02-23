import { TypedSupabaseClient } from "../../core/db/supabase";
import { EmployeesService } from "./services/employees.service";
import {
  DictionaryItem,
  EmployeeFilters,
  EmployeeRecord,
  InviteCreateResult,
  UpsertEmployeeInput,
} from "./types/employees.types";

export class EmployeesController {
  private readonly service: EmployeesService;

  constructor(supabase: TypedSupabaseClient) {
    this.service = new EmployeesService(supabase);
  }

  async listDictionary(
    table: "job_titles" | "departments" | "locations",
  ): Promise<DictionaryItem[]> {
    return this.service.listDictionary(table);
  }

  async createDictionary(
    table: "job_titles" | "departments" | "locations",
    input: { name: string; isActive?: boolean },
  ): Promise<DictionaryItem> {
    return this.service.createDictionary(table, input);
  }

  async updateDictionary(
    table: "job_titles" | "departments" | "locations",
    id: string,
    patch: { name?: string; isActive?: boolean },
  ): Promise<DictionaryItem> {
    return this.service.updateDictionary(table, id, patch);
  }

  async listEmployees(filters: EmployeeFilters): Promise<EmployeeRecord[]> {
    return this.service.listEmployees(filters);
  }

  async getEmployeeById(id: string): Promise<EmployeeRecord | null> {
    return this.service.getEmployeeById(id);
  }

  async createEmployee(input: UpsertEmployeeInput): Promise<EmployeeRecord> {
    return this.service.createEmployee(input);
  }

  async updateEmployee(id: string, input: UpsertEmployeeInput): Promise<EmployeeRecord> {
    return this.service.updateEmployee(id, input);
  }

  async createInvite(input: {
    employeeId: string;
    email: string;
    tokenHash: string;
    expiresAt: string;
  }): Promise<InviteCreateResult> {
    return this.service.createInvite(input);
  }

  async acceptInvite(rawToken: string): Promise<{ employeeId: string; tenantId: string }> {
    return this.service.acceptInvite(rawToken);
  }
}
