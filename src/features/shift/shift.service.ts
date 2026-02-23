import { getCurrentUserTenantContextOrThrow } from "../../core/auth/current-user";
import { TypedSupabaseClient } from "../../core/db/supabase";

export interface CreateShiftInput {
  userId: string;
  startsAt: string;
  endsAt: string;
}

export interface ShiftRecord {
  id: string;
  companyId: string;
  userId: string;
  startsAt: string;
  endsAt: string;
  createdBy: string;
  createdAt: string;
}

function mapShiftRow(row: {
  id: string;
  company_id: string;
  user_id: string;
  starts_at: string;
  ends_at: string;
  created_by: string;
  created_at: string;
}): ShiftRecord {
  return {
    id: row.id,
    companyId: row.company_id,
    userId: row.user_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export class ShiftService {
  constructor(private readonly supabase: TypedSupabaseClient) {}

  async createShift(input: CreateShiftInput): Promise<ShiftRecord> {
    const context = await getCurrentUserTenantContextOrThrow(this.supabase);

    const { data, error } = await this.supabase
      .from("shifts")
      .insert({
        company_id: context.companyId,
        user_id: input.userId,
        starts_at: input.startsAt,
        ends_at: input.endsAt,
        created_by: context.authUserId,
        created_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to create shift: ${error.message}`);
    }

    return mapShiftRow(data);
  }

  async listShifts(): Promise<ShiftRecord[]> {
    const { data, error } = await this.supabase
      .from("shifts")
      .select("*")
      .order("starts_at", { ascending: true });

    if (error) {
      throw new Error(`Failed to list shifts: ${error.message}`);
    }

    return data.map(mapShiftRow);
  }
}
