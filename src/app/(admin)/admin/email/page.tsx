import type { Metadata } from "next";
import { Suspense } from "react";
import { EmailComposer } from "@/components/admin/EmailComposer";
import { EmptyState, PageHeader, Panel, Skeleton, Status, Table, Td, Tr } from "@/components/admin/ui";
import { db, emailsFor, isUuid } from "@/lib/admin/data";
import { fmtDateTime } from "@/lib/admin/format";
import { requireAdminPage } from "@/lib/admin/guard";
import { emailConfigured } from "@/lib/admin/notify";
import { param } from "@/lib/admin/range";

export const metadata: Metadata = { title: "email" };

export default function EmailPage({ searchParams }: PageProps<"/admin/email">) {
  return (
    <Suspense fallback={<Skeleton rows={3} />}>
      <Email searchParams={searchParams} />
    </Suspense>
  );
}

async function Email({ searchParams }: { searchParams: PageProps<"/admin/email">["searchParams"] }) {
  const { access } = await requireAdminPage();
  const sp = await searchParams;
  const to = param(sp.to);
  const { data, error } = await db()
    .from("lms_email_log")
    .select("id, admin_id, audience, subject, recipients, sent, failed, created_at")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  const log = data ?? [];
  const admins = await emailsFor(log.map((l) => l.admin_id));
  const configured = emailConfigured();

  return (
    <>
      <PageHeader title="email users" description="send a plain-text email through Resend. preview first; nothing is sent until you confirm." />
      <div className="flex flex-col gap-4">
        {!configured && (
          <Panel>
            <Status tone="warning">Email isn&apos;t set up. Add RESEND_API_KEY and EMAIL_FROM (an address on a domain verified in Resend), then redeploy.</Status>
          </Panel>
        )}
        {access === "admin" ? (
          <Panel title="new email">
            <EmailComposer configured={configured} defaultUserId={isUuid(to) ? to : undefined} />
          </Panel>
        ) : (
          <Panel>
            <p className="text-[13px] text-subtle">Your access is read-only, so you can&apos;t send email.</p>
          </Panel>
        )}
        <Panel title="sent" note="latest 30">
          {log.length ? (
            <Table head={["when", "by", "audience", "subject", "sent"]}>
              {log.map((l) => (
                <Tr key={l.id}>
                  <Td className="whitespace-nowrap">{fmtDateTime(l.created_at)}</Td>
                  <Td>{l.admin_id ? (admins.get(l.admin_id)?.email ?? "—") : "—"}</Td>
                  <Td>{l.audience}</Td>
                  <Td className="min-w-[14rem]">{l.subject}</Td>
                  <Td className="tabular-nums whitespace-nowrap">
                    {l.sent}/{l.recipients}
                    {l.failed > 0 && <span className="ml-1 text-[#ff8a8a]">({l.failed} failed)</span>}
                  </Td>
                </Tr>
              ))}
            </Table>
          ) : (
            <EmptyState>no emails sent yet.</EmptyState>
          )}
        </Panel>
      </div>
    </>
  );
}
