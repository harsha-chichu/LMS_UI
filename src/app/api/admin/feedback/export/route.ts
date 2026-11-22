import { db, emailsFor } from "@/lib/admin/data";
import { csvResponse, toCsv } from "@/lib/admin/format";
import { adminRoute, check } from "@/lib/admin/route";

/** Feedback (with the page's filters) as CSV, newest first, up to 5,000 rows. */
export const GET = adminRoute(async ({ request }) => {
  const u = new URL(request.url).searchParams;
  let query = db()
    .from("lms_feedback")
    .select("id, user_id, session_id, category, rating, message, follow_up_consent, status, admin_note, created_at")
    .order("created_at", { ascending: false })
    .limit(5000);
  const status = u.get("status");
  const category = u.get("category");
  const rating = u.get("rating");
  if (status && ["new", "triaged", "resolved"].includes(status)) query = query.eq("status", status);
  if (category && ["idea", "problem", "praise", "other"].includes(category)) query = query.eq("category", category);
  if (rating && /^[1-5]$/.test(rating)) query = query.eq("rating", Number(rating));
  const rows = check(await query) ?? [];
  const people = await emailsFor(rows.map((r) => r.user_id));
  const csv = toCsv(
    ["id", "created_at", "email", "name", "category", "rating", "message", "ok_to_contact", "status", "admin_note", "session_id"],
    rows.map((r) => {
      const who = people.get(r.user_id);
      return [r.id, r.created_at, who?.email, who?.name, r.category, r.rating, r.message, r.follow_up_consent, r.status, r.admin_note, r.session_id];
    }),
  );
  return csvResponse(`feedback-${new Date().toISOString().slice(0, 10)}.csv`, csv);
});
