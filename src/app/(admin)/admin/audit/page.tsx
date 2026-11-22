import type { Metadata } from "next";
import { Suspense } from "react";
import { FilterBar, FilterSearch, PageHeader, Pager, Panel, Skeleton, Table, Td, TextLink, Tr } from "@/components/admin/ui";
import { db, emailsFor } from "@/lib/admin/data";
import { fmtDateTime } from "@/lib/admin/format";
import { requireAdminPage } from "@/lib/admin/guard";
import { pageParam, param } from "@/lib/admin/range";

export const metadata: Metadata = { title: "audit log" };

const PAGE_SIZE = 50;

const targetHref = (type: string | null, id: string | null) => {
  if (!id) return null;
  if (type === "user") return `/admin/users/${id}`;
  if (type === "session") return `/admin/sessions/${id}`;
  if (type === "question") return `/admin/questions?edit=${id}`;
  if (type === "feedback") return "/admin/feedback";
  if (type === "announcement") return "/admin/announcements";
  if (type === "setting") return "/admin/system";
  return null;
};

export default function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  return (
    <Suspense fallback={<Skeleton rows={3} />}>
      <Audit searchParams={searchParams} />
    </Suspense>
  );
}

async function Audit({ searchParams }: { searchParams: PageProps<"/admin/audit">["searchParams"] }) {
  await requireAdminPage();
  const sp = await searchParams;
  const action = param(sp.action).trim();
  const page = pageParam(sp.page);

  let query = db()
    .from("lms_admin_audit")
    .select("id, admin_id, action, target_type, target_id, details, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (action) query = query.ilike("action", `${action.replace(/[%_]/g, "")}%`);
  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const people = await emailsFor(rows.map((r) => r.admin_id));

  return (
    <>
      <PageHeader title="audit log" description="every change made from this dashboard." />
      <Panel>
        <FilterBar action="/admin/audit">
          <FilterSearch name="action" defaultValue={action} placeholder="action, e.g. user. or question.retire" />
        </FilterBar>
        <Table head={["when", "admin", "action", "target", "details"]} empty={!rows.length}>
          {rows.map((r) => {
            const href = targetHref(r.target_type, r.target_id);
            return (
              <Tr key={r.id}>
                <Td className="whitespace-nowrap">{fmtDateTime(r.created_at)}</Td>
                <Td>{r.admin_id ? (people.get(r.admin_id)?.email ?? r.admin_id.slice(0, 8)) : "(deleted)"}</Td>
                <Td>
                  <code className="text-[12px]">{r.action}</code>
                </Td>
                <Td className="whitespace-nowrap">
                  {r.target_type}
                  {r.target_id && (href ? <TextLink href={href} className="ml-1.5 text-[12px]">{r.target_id.slice(0, 12)}</TextLink> : ` ${r.target_id.slice(0, 12)}`)}
                </Td>
                <Td className="max-w-[24rem] text-[12px] break-words text-subtle">
                  {Object.keys(r.details ?? {}).length ? JSON.stringify(r.details) : "—"}
                </Td>
              </Tr>
            );
          })}
        </Table>
        <Pager path="/admin/audit" params={{ action }} page={page} pageSize={PAGE_SIZE} total={count ?? 0} />
      </Panel>
    </>
  );
}
