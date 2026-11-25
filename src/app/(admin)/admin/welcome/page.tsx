import type { Metadata } from "next";
import { Suspense } from "react";
import { WelcomeForm } from "@/components/admin/WelcomeForm";
import { Badge, PageHeader, Panel, Skeleton, Status, Table, Td, TextLink, Tr } from "@/components/admin/ui";
import { db, emailsFor } from "@/lib/admin/data";
import { fmtDateTime } from "@/lib/admin/format";
import { requireAdminPage } from "@/lib/admin/guard";
import { alertRecipients, emailConfigured } from "@/lib/admin/notify";
import { welcomeReady } from "@/lib/welcome";
import { getWelcomeSetting } from "@/lib/welcome-server";

export const metadata: Metadata = { title: "welcome" };

type SignupRow = { user_id: string; created_at: string; notified_at: string | null; welcome_emailed_at: string | null; welcome_seen_at: string | null };

export default function WelcomePage() {
  return (
    <Suspense fallback={<Skeleton rows={4} />}>
      <Welcome />
    </Suspense>
  );
}

async function Welcome() {
  const { access } = await requireAdminPage();
  const canWrite = access === "admin";
  const [welcome, signups] = await Promise.all([
    getWelcomeSetting(),
    db().from("lms_signups").select("user_id, created_at, notified_at, welcome_emailed_at, welcome_seen_at").order("created_at", { ascending: false }).limit(50),
  ]);
  if (signups.error) throw new Error(signups.error.message);
  const rows = (signups.data ?? []) as SignupRow[];
  const people = await emailsFor(rows.map((r) => r.user_id));
  const alertsOn = (emailConfigured() && alertRecipients().length > 0) || Boolean(process.env.ALERT_WEBHOOK_URL);

  return (
    <>
      <PageHeader title="welcome" description="the note new users get after signing up, and the sign-up alerts you receive." />
      <div className="flex flex-col gap-4">
        <Panel
          title="welcome note"
          note={<Status tone={welcomeReady(welcome) ? "good" : "neutral"}>{welcomeReady(welcome) ? "on" : "off"}</Status>}
        >
          {canWrite ? (
            <WelcomeForm initial={welcome} emailReady={emailConfigured()} />
          ) : (
            <div className="text-[13px]">
              <p className="font-medium">{welcome.title || "—"}</p>
              <p className="mt-2 whitespace-pre-line text-subtle">{welcome.body || "no message yet."}</p>
            </div>
          )}
          <p className="mt-4 text-[12px] text-faint">
            Shown once as a popup the first time a new user opens the app, and emailed to them if email is on (users who opted out of emails
            don&apos;t get it). People who signed up before the note was turned on don&apos;t get it.
          </p>
        </Panel>

        <Panel
          title="recent sign-ups"
          note={
            <Status tone={alertsOn ? "good" : "warning"}>
              {alertsOn ? "you're alerted on each new sign-up" : "alerts off: set RESEND_API_KEY + EMAIL_FROM or ALERT_WEBHOOK_URL"}
            </Status>
          }
        >
          <Table head={["user", "signed up", "alert sent", "welcome email", "popup"]} empty={!rows.length}>
            {rows.map((r) => {
              const p = people.get(r.user_id);
              return (
                <Tr key={r.user_id}>
                  <Td>
                    <TextLink href={`/admin/users/${r.user_id}`}>{p?.name || p?.email || r.user_id.slice(0, 8)}</TextLink>
                    {p?.name && p.email && <div className="text-[12px] text-subtle">{p.email}</div>}
                  </Td>
                  <Td className="whitespace-nowrap">{fmtDateTime(r.created_at)}</Td>
                  <Td>{r.notified_at ? <Badge>yes</Badge> : <Badge tone="muted">no</Badge>}</Td>
                  <Td>{r.welcome_emailed_at ? <Badge>sent</Badge> : <Badge tone="muted">—</Badge>}</Td>
                  <Td>{r.welcome_seen_at ? <Badge>seen</Badge> : <Badge tone="muted">not yet</Badge>}</Td>
                </Tr>
              );
            })}
          </Table>
          <p className="mt-3 text-[12px] text-faint">
            A user counts as signed up the first time they open the app (after confirming their email, or after Google sign-in). Accounts that existed before
            this feature show as already done.
          </p>
        </Panel>
      </div>
    </>
  );
}
