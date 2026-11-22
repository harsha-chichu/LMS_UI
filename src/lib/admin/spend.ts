import "server-only";
import { estimateCostUsd } from "@/lib/admin/pricing";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/** Estimated Claude spend since midnight UTC, in USD. */
export async function getSpendToday(): Promise<number> {
  const { data, error } = await getSupabaseAdmin().rpc("lms_admin_spend_today");
  if (error) throw new Error(`lms_admin_spend_today: ${error.message}`);
  return ((data ?? []) as { model: string | null; input_tokens: number; output_tokens: number }[]).reduce(
    (sum, r) => sum + estimateCostUsd(r.model, Number(r.input_tokens), Number(r.output_tokens)),
    0,
  );
}
