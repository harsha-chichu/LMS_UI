import type { Metadata } from "next";
import { Suspense } from "react";
import { FeedbackTriage } from "@/components/admin/FeedbackTriage";
import { Badge, FilterBar, FilterSelect, PageHeader, Pager, Panel, ParamTabs, Skeleton, Table, Td, TextLink, Tr, withParams } from "@/components/admin/ui";
import { db, emailsFor } from "@/lib/admin/data";
import { fmtDateTime } from "@/lib/admin/format";
import { requireAdminPage } from "@/lib/admin/guard";
import { pageParam, param } from "@/lib/admin/range";

export const metadata: Metadata = { title: "feedback" };

const PAGE_SIZE = 30;
const CATEGORIES = ["idea", "problem", "praise", "other"];

export default function FeedbackPage({ searchParams }: PageProps<"/admin/feedback">) {
  return (
    <Suspense fallback={<Skeleton rows={3} />}>
      <Feedback searchParams={searchParams} />
    </Suspense>
  );
}

async function Feedback({ searchParams }: { searchParams: PageProps<"/admin/feedback">["searchParams"] }) {
  const { access } = await requireAdminPage();
  const canWrite = access === "admin";
  const sp = await searchParams;
  const status = param(sp.status);
  const category = param(sp.category);
  const rating = param(sp.rating);
  const page = pageParam(sp.page);

  let query = db()
    .from("lms_feedback")
    .select("id, user_id, session_id, category, rating, message, follow_up_consent, status, admin_note, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (["new", "triaged", "resolved"].includes(status)) query = query.eq("status", status);
  if (CATEGORIES.includes(category)) query = query.eq("category", category);
  if (/^[1-5]$/.test(rating)) query = query.eq("rating", Number(rating));
  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const people = await emailsFor(rows.map((r) => r.user_id));
  const filters = { status, category, rating };

  return (
    <>
      <PageHeader
        title="feedback"
        description="what users sent from settings. notes are private to admins."
        actions={
          <a href={withParams("/api/admin/feedback/export", filters)} className="inline-flex h-9 items-center rounded-full bg-surface-3 px-4 text-[13px] hover:bg-surface-2">
            export CSV
          </a>
        }
      />
      <Panel>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <ParamTabs
            path="/admin/feedback"
            params={filters}
            name="status"
            value={status}
            options={[
              { value: "", label: "all" },
              { value: "new", label: "new" },
              { value: "triaged", label: "triaged" },
              { value: "resolved", label: "resolved" },
            ]}
          />
        </div>
        <FilterBar action="/admin/feedback">
          {status && <input type="hidden" name="status" value={status} />}
          <FilterSelect name="category" label="category" value={category} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
          <FilterSelect name="rating" label="rating" value={rating} options={[1, 2, 3, 4, 5].map((r) => ({ value: String(r), label: `${r}/5` }))} />
        </FilterBar>
        <Table head={["received", "from", "feedback", "triage"]} empty={!rows.length}>
          {rows.map((f) => {
            const who = people.get(f.user_id);
            return (
              <Tr key={f.id}>
                <Td className="whitespace-nowrap">{fmtDateTime(f.created_at)}</Td>
                <Td className="min-w-[11rem]">
                  <TextLink href={`/admin/users/${f.user_id}`}>{who?.name || "(no name)"}</TextLink>
                  <div className="text-[12px] text-subtle">{who?.email}</div>
                  {f.follow_up_consent && <div className="mt-1 text-[12px] text-brand">ok to contact</div>}
                </Td>
                <Td className="min-w-[18rem] max-w-[32rem]">
                  <div className="mb-1.5 flex flex-wrap gap-1">
                    <Badge>{f.category}</Badge>
                    <Badge tone="muted">{f.rating}/5</Badge>
                    {f.session_id && (
                      <TextLink href={`/admin/sessions/${f.session_id}`} className="text-[12px]">
                        session
                      </TextLink>
                    )}
                  </div>
                  <p className="leading-relaxed whitespace-pre-wrap">{f.message}</p>
                </Td>
                <Td>
                  {canWrite ? (
                    <FeedbackTriage id={f.id} status={f.status} note={f.admin_note} />
                  ) : (
                    <span className="text-subtle">{f.status}{f.admin_note ? ` — ${f.admin_note}` : ""}</span>
                  )}
                </Td>
              </Tr>
            );
          })}
        </Table>
        <Pager path="/admin/feedback" params={filters} page={page} pageSize={PAGE_SIZE} total={count ?? 0} />
      </Panel>
    </>
  );
}
