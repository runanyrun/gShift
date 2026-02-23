import { TypedSupabaseClient } from "../db/supabase";

export interface MyShiftItem {
  id: string;
  company_id: string;
  user_id: string;
  starts_at: string;
  ends_at: string;
  created_by: string;
  created_at: string;
}

export interface GetMyUpcomingShiftsInput {
  supabase: TypedSupabaseClient;
  tenantId: string;
  userId: string;
  now?: Date;
  days?: number;
}

export async function getMyUpcomingShifts({
  supabase,
  tenantId,
  userId,
  now = new Date(),
  days = 7,
}: GetMyUpcomingShiftsInput): Promise<MyShiftItem[]> {
  const from = now.toISOString();
  const to = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("id")
    .eq("auth_user_id", userId)
    .eq("company_id", tenantId)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Failed to resolve user profile for shifts: ${profileError.message}`);
  }

  if (!profile) {
    return [];
  }

  const { data, error } = await supabase
    .from("shifts")
    .select("id, company_id, user_id, starts_at, ends_at, created_by, created_at")
    .eq("company_id", tenantId)
    .eq("user_id", profile.id)
    .gte("starts_at", from)
    .lt("starts_at", to)
    .order("starts_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load my upcoming shifts: ${error.message}`);
  }

  return data;
}
