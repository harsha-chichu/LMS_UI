import type { Metadata } from "next";
import { Suspense } from "react";
import { Badge, FilterBar, FilterSearch, FilterSelect, PageHeader, Pager, Panel, Skeleton, Table, Td, TextLink, Tr, withParams } from "@/components/admin/ui";
import { rpc } from "@/lib/admin/data";
import { fmtDate, fmtNum } from "@/lib/admin/format";
import { requireAdminPage } from "@/lib/admin/guard";
import { pageParam, param } from "@/lib/admin/range";

export const metadata: Metadata = { title: "users" };

const PAGE_SIZE = 50;

type UserRow = {
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
  total_count: number;
};

export default function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  return (
    <Suspense fallback={<Skeleton rows={3} />}>
      <Users searchParams={searchParams} />
    </Suspense>
  );
}

async function Users({ searchParams }: { searchParams: PageProps<"/admin/users">["searchParams"] }) {
  await requireAdminPage();
  const sp = await searchParams;
  const q = param(sp.q);
  const sort = param(sp.sort) || "joined";
  const page = pageParam(sp.page);

  const rows = await rpc<UserRow[]>("lms_admin_users", {
    p_q: q || null,
    p_sort: sort,
    p_limit: PAGE_SIZE,
    p_offset: (page - 1) * PAGE_SIZE,
  });
  const total = Number(rows[0]?.total_count ?? 0);

  return (
    <>
      <PageHeader
        title="users"
        description="search by email, name or user id."
        actions={
          <a
            href={withParams("/api/admin/users/export", { q, sort: sort === "joined" ? undefined : sort })}
            className="inline-flex h-9 items-center rounded-full bg-surface-3 px-4 text-[13px] hover:bg-surface-2"
          >
            export CSV
          </a>
        }
      />
      <Panel>
        <FilterBar action="/admin/users">
          <FilterSearch name="q" defaultValue={q} placeholder="email, name or id" />
          <FilterSelect
            name="sort"
            label="sort"
            value={sort === "joined" ? "" : sort}
            options={[
              { value: "active", label: "last active" },
              { value: "sessions", label: "most sessions" },
              { value: "score", label: "best avg score" },
              { value: "name", label: "name" },
            ]}
          />
        </FilterBar>
        <Table head={["user", "joined", "last active", "sessions", "avg score", ""]} empty={!rows.length}>
          {rows.map((u) => (
            <Tr key={u.id}>
              <Td className="min-w-[14rem]">
                <TextLink href={`/admin/users/${u.id}`}>{u.name || "(no name)"}</TextLink>
                <div className="text-[12px] text-subtle">{u.email}</div>
              </Td>
              <Td className="whitespace-nowrap">{fmtDate(u.created_at)}</Td>
              <Td className="whitespace-nowrap">{fmtDate(u.last_active ?? u.last_sign_in_at)}</Td>
              <Td className="tabular-nums">
                {fmtNum(u.sessions)} <span className="text-subtle">({fmtNum(u.completed)} done)</span>
              </Td>
              <Td className="tabular-nums">{fmtNum(u.avg_total, 1)}</Td>
              <Td>
                <div className="flex gap-1">
                  {u.role === "admin" && <Badge tone="brand">admin</Badge>}
                  {u.role === "support" && <Badge tone="brand">support</Badge>}
                  {u.suspended_at && <Badge>suspended</Badge>}
                </div>
              </Td>
            </Tr>
          ))}
        </Table>
        <Pager path="/admin/users" params={{ q, sort: sort === "joined" ? undefined : sort }} page={page} pageSize={PAGE_SIZE} total={total} />
      </Panel>
    </>
  );
}
