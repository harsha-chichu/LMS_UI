import { logAdminAction } from "@/lib/admin/audit";
import { rpc } from "@/lib/admin/data";
import { csvResponse, toCsv } from "@/lib/admin/format";
import { adminRoute } from "@/lib/admin/route";

type Row = {
  id: string;
  email: string;
  name: string;
  role: string;
  suspended_at: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  last_active: string | null;
  sessions: number;
  completed: number;
  avg_total: number | null;
};

/** Users (with the page's search and sort) as CSV, up to 20,000 rows. */
export const GET = adminRoute(
  async ({ admin, request }) => {
    const u = new URL(request.url).searchParams;
    const all: Row[] = [];
    for (let offset = 0; offset < 20_000; offset += 200) {
      const page = await rpc<Row[]>("lms_admin_users", {
        p_q: u.get("q") || null,
        p_sort: u.get("sort") || "joined",
        p_limit: 200,
        p_offset: offset,
      });
      all.push(...page);
      if (page.length < 200) break;
    }
    await logAdminAction(admin.id, "user.export_csv", null, { rows: all.length, q: u.get("q") || null });
    const csv = toCsv(
      ["id", "email", "name", "role", "suspended_at", "joined", "last_sign_in", "last_active", "sessions", "completed", "avg_score"],
      all.map((r) => [r.id, r.email, r.name, r.role, r.suspended_at, r.created_at, r.last_sign_in_at, r.last_active, r.sessions, r.completed, r.avg_total]),
    );
    return csvResponse(`users-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  },
  { write: false },
);
