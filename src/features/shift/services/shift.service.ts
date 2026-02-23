import { getCurrentUserTenantContextOrThrow } from "../../../core/auth/current-user";
import { TypedSupabaseClient } from "../../../core/db/supabase";

export interface CreateShiftInput {
  starts_at: string;
  ends_at: string;
  user_id: string;
}

export interface ShiftRecord {
  id: string;
  company_id: string;
  user_id: string;
  starts_at: string;
  ends_at: string;
  created_by: string;
  created_at: string;
}

export class ShiftService {
  constructor(private readonly supabase: TypedSupabaseClient) {}

  async createShift(input: CreateShiftInput): Promise<ShiftRecord> {
    const context = await getCurrentUserTenantContextOrThrow(this.supabase);

    const { data, error } = await this.supabase
      .from("shifts")
      .insert({
        company_id: context.companyId,
        user_id: input.user_id,
        starts_at: input.starts_at,
        ends_at: input.ends_at,
        created_by: context.authUserId,
        created_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to create shift: ${error.message}`);
    }

    return data;
  }

  async listShifts(): Promise<ShiftRecord[]> {
    const { data, error } = await this.supabase
      .from("shifts")
      .select("*")
      .order("starts_at", { ascending: true });

    if (error) {
      throw new Error(`Failed to list shifts: ${error.message}`);
    }

    return data;
  }
}
