import { z } from "zod";
import { logAdminAction } from "@/lib/admin/audit";
import { questionsFromCsv } from "@/lib/admin/csv";
import { db } from "@/lib/admin/data";
import { AdminError, adminRoute, body } from "@/lib/admin/route";

const importSchema = z.object({
  csv: z.string().min(1, "choose a CSV file").max(2_000_000, "file is too large (2 MB max)"),
  dryRun: z.boolean().default(true),
});

const textKey = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Bulk-adds bank questions from CSV. A dry run (the default) reports what
 * would be added, what's invalid and what's already in the bank; then the
 * same file is sent with dryRun: false to add them.
 */
export const POST = adminRoute(async ({ admin, request }) => {
  const { csv, dryRun } = await body(request, importSchema);
  const { rows, problems } = questionsFromCsv(csv);

  // Questions already in the bank (same domain + normalised text).
  const supabase = db();
  const existing = new Set<string>();
  for (const domain of [...new Set(rows.map((r) => r.domain))]) {
    const { data, error } = await supabase.from("lms_questions").select("text_key").eq("domain", domain).limit(20000);
    if (error) throw new Error(error.message);
    for (const q of data ?? []) existing.add(`${domain}|${q.text_key}`);
  }
  const fresh = rows.filter((r) => !existing.has(`${r.domain}|${textKey(r.text)}`));
  const duplicates = rows.length - fresh.length;

  if (dryRun) {
    return { ok: true, dryRun: true, valid: fresh.length, duplicates, problems, preview: fresh.slice(0, 20) };
  }
  if (!fresh.length) throw new AdminError("nothing new to add");

  let added = 0;
  for (let i = 0; i < fresh.length; i += 200) {
    const chunk = fresh.slice(i, i + 200).map((r) => ({ ...r, source: "seed", status: "active", created_by: admin.id }));
    const { data, error } = await supabase
      .from("lms_questions")
      .upsert(chunk, { onConflict: "domain,text_key", ignoreDuplicates: true })
      .select("id");
    if (error) throw new Error(error.message);
    added += data?.length ?? 0;
  }
  await logAdminAction(admin.id, "question.import", { type: "question" }, { added, duplicates, invalid: problems.length });
  return { ok: true, dryRun: false, added, duplicates, problems };
});
