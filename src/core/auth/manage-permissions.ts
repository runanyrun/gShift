import { TypedSupabaseClient } from "../db/supabase";

export type ManagePermissionClient = Pick<TypedSupabaseClient, "rpc">;

export async function requireManagePermissions(supabase: ManagePermissionClient): Promise<void> {
  const { data, error } = await supabase.rpc("is_management_user");

  if (error) {
    throw new Error(`Failed to validate management permissions: ${error.message}`);
  }

  if (!data) {
    throw new Error("no-permission");
  }
}
