import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionButton } from "@/components/admin/actions";
import { AlertSettingsForm } from "@/components/admin/ConfigForms";
import { EmptyState, PageHeader, Panel, Skeleton, Status, Table, Td, Tr } from "@/components/admin/ui";
import { alertRecipients, emailConfigured } from "@/lib/admin/notify";
import { alertSettings } from "@/lib/admin/alert-rules";
import { db } from "@/lib/admin/data";
import { fmtDateTime } from "@/lib/admin/format";
import { requireAdminPage } from "@/lib/admin/guard";

export const metadata: Metadata = { title: "alerts" };

export default function AlertsPage() {
  return (
    <Suspense fallback={<Skeleton rows={3} />}>
      <Alerts />
    </Suspense>
  );
}

async function Alerts() {
  const { access } = await requireAdminPage();
  const canWrite = access === "admin";
  const supabase = db();
  const [alertsRes, settingsRes] = await Promise.all([
    supabase.from("lms_alerts").select("id, kind, severity, message, created_at, resolved_at").order("created_at", { ascending: false }).limit(50),
    supabase.from("lms_app_settings").select("value").eq("key", "alerts").maybeSingle(),
  ]);
  if (alertsRes.error) throw new Error(alertsRes.error.message);
  const alerts = alertsRes.data ?? [];
  const open = alerts.filter((a) => !a.resolved_at);
  const settings = alertSettings(settingsRes.data?.value);
  const recipients = alertRecipients();
  const cron = Boolean(process.env.CRON_SECRET);

  return (
    <>
      <PageHeader
        title="alerts"
        description="a health check runs every 10 minutes and messages you when something goes wrong, and again when it recovers."
        actions={canWrite ? <ActionButton url="/api/admin/alerts/test">send test alert</ActionButton> : undefined}
      />
      <div className="flex flex-col gap-4">
        <Panel title="delivery">
          <ul className="flex flex-col gap-2 text-[13px]">
            <li>
              <Status tone={cron ? "good" : "critical"}>
                scheduled check: {cron ? "CRON_SECRET set — make sure the Supabase schedule from migration 0015 is running" : "CRON_SECRET not set, so no checks run"}
              </Status>
            </li>
            <li>
              <Status tone={emailConfigured() && recipients.length ? "good" : "neutral"}>
                email: {emailConfigured() ? (recipients.length ? `to ${recipients.join(", ")}` : "no recipients") : "off (set RESEND_API_KEY and EMAIL_FROM)"}
              </Status>
            </li>
            <li>
              <Status tone={process.env.ALERT_WEBHOOK_URL ? "good" : "neutral"}>
                Slack / Discord: {process.env.ALERT_WEBHOOK_URL ? "webhook set" : "off (set ALERT_WEBHOOK_URL)"}
              </Status>
            </li>
          </ul>
        </Panel>

        <Panel title="open now">
          {open.length ? (
            <ul className="flex flex-col gap-2">
              {open.map((a) => (
                <li key={a.id}>
                  <Status tone={a.severity === "critical" ? "critical" : "warning"}>
                    {a.message} <span className="text-[12px] text-subtle">since {fmtDateTime(a.created_at)}</span>
                  </Status>
                </li>
              ))}
            </ul>
          ) : (
            <Status tone="good">no open alerts.</Status>
          )}
        </Panel>

        {canWrite && (
          <Panel title="thresholds">
            <AlertSettingsForm settings={settings} />
          </Panel>
        )}

        <Panel title="history" note="latest 50">
          {alerts.length ? (
            <Table head={["raised", "alert", "severity", "resolved"]}>
              {alerts.map((a) => (
                <Tr key={a.id}>
                  <Td className="whitespace-nowrap">{fmtDateTime(a.created_at)}</Td>
                  <Td className="min-w-[18rem]">{a.message}</Td>
                  <Td>{a.severity}</Td>
                  <Td className="whitespace-nowrap">{a.resolved_at ? fmtDateTime(a.resolved_at) : "open"}</Td>
                </Tr>
              ))}
            </Table>
          ) : (
            <EmptyState>no alerts yet.</EmptyState>
          )}
        </Panel>
      </div>
    </>
  );
}
