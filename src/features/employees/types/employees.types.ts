export type PermissionKey =
  | "administration"
  | "management"
  | "report_management"
  | "time_off_management"
  | "timesheet_management";

export interface DictionaryItem {
  id: string;
  tenantId: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeRecord {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone1: string | null;
  phone2: string | null;
  gender: string | null;
  birthDate: string | null;
  isActive: boolean;
  jobTitleId: string | null;
  departmentId: string | null;
  startDate: string | null;
  endDate: string | null;
  payrollId: string | null;
  defaultBreakMinutes: number | null;
  defaultShiftHours: number | null;
  notes: string | null;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeFilters {
  isActive?: boolean;
  locationId?: string;
  departmentId?: string;
  jobTitleId?: string;
}

export interface UpsertEmployeeInput {
  firstName: string;
  lastName: string;
  email: string;
  phone1?: string | null;
  phone2?: string | null;
  gender?: string | null;
  birthDate?: string | null;
  isActive?: boolean;
  jobTitleId?: string | null;
  departmentId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  payrollId?: string | null;
  defaultBreakMinutes?: number | null;
  defaultShiftHours?: number | null;
  notes?: string | null;
  locationIds?: string[];
}

export interface EmployeeInvite {
  id: string;
  tenantId: string;
  employeeId: string;
  email: string;
  expiresAt: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  createdBy: string;
  createdAt: string;
}

export interface InviteCreateResult {
  inviteId: string;
  status: EmployeeInvite["status"];
  companySlug: string | null;
}
