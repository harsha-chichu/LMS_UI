import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/** Records an admin action. Throws if it can't be written, so a missing audit trail is never silent. */
export async function logAdminAction(
  adminId: string,
  action: string,
  target: { type: string; id?: string | null } | null,
  details: Record<string, unknown> = {},
) {
  const { error } = await getSupabaseAdmin()
    .from("lms_admin_audit")
    .insert({ admin_id: adminId, action, target_type: target?.type ?? null, target_id: target?.id ?? null, details });
  if (error) throw new Error(`audit log write failed: ${error.message}`);
}
