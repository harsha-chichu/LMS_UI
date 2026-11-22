import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Badge, EmptyState, PageHeader, Panel, Skeleton, TextLink } from "@/components/admin/ui";
import { db, isUuid, rpc } from "@/lib/admin/data";
import { requireAdminPage } from "@/lib/admin/guard";
import { param } from "@/lib/admin/range";

export const metadata: Metadata = { title: "search" };

type Hit = { kind: "user" | "session" | "question"; id: string; label: string; sub: string };

const href = (h: Hit) =>
  h.kind === "user" ? `/admin/users/${h.id}` : h.kind === "session" ? `/admin/sessions/${h.id}` : `/admin/questions?edit=${h.id}`;

export default function SearchPage({ searchParams }: PageProps<"/admin/search">) {
  return (
    <Suspense fallback={<Skeleton rows={2} />}>
      <Search searchParams={searchParams} />
    </Suspense>
  );
}

async function Search({ searchParams }: { searchParams: PageProps<"/admin/search">["searchParams"] }) {
  await requireAdminPage();
  const q = param((await searchParams).q).trim().slice(0, 200);

  // A pasted id goes straight to what it is.
  if (isUuid(q)) {
    const supabase = db();
    const [user, session, question] = await Promise.all([
      supabase.from("lms_profiles").select("id").eq("id", q).maybeSingle(),
      supabase.from("lms_sessions").select("id").eq("id", q).maybeSingle(),
      supabase.from("lms_questions").select("id").eq("id", q).maybeSingle(),
    ]);
    if (user.data) redirect(`/admin/users/${q}`);
    if (session.data) redirect(`/admin/sessions/${q}`);
    if (question.data) redirect(`/admin/questions?edit=${q}`);
  }

  const hits = q.length >= 2 ? await rpc<Hit[]>("lms_admin_global_search", { p_q: q }) : [];
  const groups = (["user", "session", "question"] as const).map((k) => ({ kind: k, hits: hits.filter((h) => h.kind === k) }));

  return (
    <>
      <PageHeader title="search" description={q ? `results for “${q}”` : "search by email, name, user or session id, or question text."} />
      {q.length < 2 ? (
        <Panel>
          <EmptyState>type at least 2 characters in the search box above.</EmptyState>
        </Panel>
      ) : hits.length === 0 ? (
        <Panel>
          <EmptyState>nothing matches “{q}”.</EmptyState>
        </Panel>
      ) : (
        <div className="flex flex-col gap-4">
          {groups
            .filter((g) => g.hits.length)
            .map((g) => (
              <Panel key={g.kind} title={`${g.kind}s`} note={g.hits.length === 10 ? "first 10" : undefined}>
                <ul className="flex flex-col gap-2.5">
                  {g.hits.map((h) => (
                    <li key={`${h.kind}-${h.id}`} className="text-[14px]">
                      <TextLink href={href(h)}>{h.label}</TextLink>
                      <span className="ml-2 inline-flex">
                        <Badge tone="muted">{h.sub}</Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              </Panel>
            ))}
        </div>
      )}
    </>
  );
}
