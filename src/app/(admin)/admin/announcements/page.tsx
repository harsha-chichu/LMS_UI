import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionButton } from "@/components/admin/actions";
import { AnnouncementForm } from "@/components/admin/AnnouncementForm";
import { Badge, PageHeader, Panel, Skeleton, Table, Td, Tr } from "@/components/admin/ui";
import { db } from "@/lib/admin/data";
import { fmtDateTime } from "@/lib/admin/format";
import { requireAdminPage } from "@/lib/admin/guard";
import { nowMs } from "@/lib/admin/range";

export const metadata: Metadata = { title: "announcements" };

export default function AnnouncementsPage() {
  return (
    <Suspense fallback={<Skeleton rows={3} />}>
      <Announcements />
    </Suspense>
  );
}

async function Announcements() {
  await requireAdminPage();
  const { data, error } = await db()
    .from("lms_announcements")
    .select("id, message, level, active, starts_at, ends_at, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  const now = nowMs();
  const rows = (data ?? []).map((a) => ({
    ...a,
    live: a.active && new Date(a.starts_at).getTime() <= now && (!a.ends_at || new Date(a.ends_at).getTime() > now),
  }));

  return (
    <>
      <PageHeader title="announcements" description="a banner at the top of the app for every signed-in user." />
      <div className="flex flex-col gap-4">
        <Panel title="new announcement">
          <AnnouncementForm />
        </Panel>

        <Panel title="history">
          <Table head={["message", "style", "published", "ends", ""]} empty={!rows.length}>
            {rows.map((a) => (
              <Tr key={a.id}>
                <Td className="min-w-[18rem] max-w-[32rem]">
                  {a.message}
                  <div className="mt-1">{a.live ? <Badge tone="brand">live</Badge> : <Badge tone="muted">ended</Badge>}</div>
                </Td>
                <Td>{a.level}</Td>
                <Td className="whitespace-nowrap">{fmtDateTime(a.starts_at)}</Td>
                <Td className="whitespace-nowrap">{a.ends_at ? fmtDateTime(a.ends_at) : "—"}</Td>
                <Td>
                  {a.live && (
                    <ActionButton url={`/api/admin/announcements/${a.id}`} method="DELETE" confirm="End this announcement now?">
                      end now
                    </ActionButton>
                  )}
                </Td>
              </Tr>
            ))}
          </Table>
        </Panel>
      </div>
    </>
  );
}
