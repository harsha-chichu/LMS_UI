import { logAdminAction } from "@/lib/admin/audit";
import { db } from "@/lib/admin/data";
import { AdminError, adminRoute, body } from "@/lib/admin/route";
import { questionCreateSchema } from "@/lib/admin/schemas";

/** Adds a question to the bank. Admin-written questions count as "seed" (curated), not generated. */
export const POST = adminRoute(async ({ admin, request }) => {
  const q = await body(request, questionCreateSchema);
  const { data, error } = await db()
    .from("lms_questions")
    .insert({ ...q, source: "seed", status: "active", created_by: admin.id })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") throw new AdminError("that question is already in the bank", 409);
    throw new Error(error.message);
  }
  await logAdminAction(admin.id, "question.create", { type: "question", id: data.id }, { domain: q.domain, difficulty: q.difficulty });
  return { ok: true, id: data.id };
});
