import { rpc } from "@/lib/admin/data";
import { csvResponse, toCsv } from "@/lib/admin/format";
import { adminRoute } from "@/lib/admin/route";

type Row = {
  id: string;
  domain: string;
  difficulty: string;
  text: string;
  topics: string[];
  source: string;
  status: string;
  times_asked: number;
  times_skipped: number;
  avg_score: number | null;
  created_at: string;
};

/** The bank (with the page's filters) as CSV, up to 10,000 rows. */
export const GET = adminRoute(async ({ request }) => {
  const u = new URL(request.url).searchParams;
  const all: Row[] = [];
  for (let offset = 0; offset < 10_000; offset += 200) {
    const page = await rpc<Row[]>("lms_admin_questions", {
      p_domain: u.get("domain") || null,
      p_difficulty: u.get("difficulty") || null,
      p_status: u.get("status") || null,
      p_source: u.get("source") || null,
      p_q: u.get("q") || null,
      p_sort: u.get("sort") || "recent",
      p_limit: 200,
      p_offset: offset,
    });
    all.push(...page);
    if (page.length < 200) break;
  }
  const csv = toCsv(
    ["id", "domain", "difficulty", "text", "topics", "source", "status", "times_asked", "times_skipped", "avg_score", "created_at"],
    all.map((q) => [q.id, q.domain, q.difficulty, q.text, q.topics, q.source, q.status, q.times_asked, q.times_skipped, q.avg_score, q.created_at]),
  );
  return csvResponse(`questions-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}, { write: false });
