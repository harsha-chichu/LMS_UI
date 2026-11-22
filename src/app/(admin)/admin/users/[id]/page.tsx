import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionButton } from "@/components/admin/actions";
import { Badge, Facts, KpiGrid, KpiTile, PageHeader, Panel, Skeleton, Table, Td, TextLink, Tr } from "@/components/admin/ui";
import { domainShort } from "@/lib/constants";
import { db, isUuid, rpc } from "@/lib/admin/data";
import { isEnvAdmin } from "@/lib/admin/emails";
import { fmtDate, fmtDateTime, fmtNum } from "@/lib/admin/format";
import { requireAdminPage } from "@/lib/admin/guard";
import { nowMs } from "@/lib/admin/range";
import { domainAverages, summaryStats } from "@/lib/stats";
import type { Domain, SessionConfig } from "@/types";

export const metadata: Metadata = { title: "user" };

export default function UserPage({ params }: PageProps<"/admin/users/[id]">) {
  return (
    <Suspense fallback={<Skeleton rows={3} />}>
      <UserDetail params={params} />
    </Suspense>
  );
}

async function UserDetail({ params }: { params: PageProps<"/admin/users/[id]">["params"] }) {
  const me = await requireAdminPage();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = db();
  const [profileRes, authRows, sessionsRes, feedbackRes, attemptsRes, savedRes, friendsRes, usageRes] = await Promise.all([
    supabase.from("lms_profiles").select("id, name, role, suspended_at, suspended_reason, created_at, preferences").eq("id", id).maybeSingle(),
    rpc<{ email: string; last_sign_in_at: string | null; created_at: string }[]>("lms_admin_user_email", { p_id: id }),
    supabase
      .from("lms_sessions")
      .select("id, config, status, total, created_at, completed_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("lms_feedback").select("id, category, rating, message, status, created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(20),
    supabase.from("lms_question_attempts").select("id", { count: "exact", head: true }).eq("user_id", id),
    supabase.from("lms_saved_questions").select("id", { count: "exact", head: true }).eq("user_id", id),
    supabase.from("lms_friendships").select("id", { count: "exact", head: true }).eq("status", "accepted").or(`requester.eq.${id},addressee.eq.${id}`),
    supabase
      .from("lms_usage_events")
      .select("kind, ok, input_tokens, output_tokens")
      .eq("user_id", id)
      .gte("created_at", new Date(nowMs() - 30 * 86_400_000).toISOString())
      .limit(5000),
  ]);
  for (const r of [profileRes, sessionsRes, feedbackRes, attemptsRes, savedRes, friendsRes, usageRes]) {
    if (r.error) throw new Error(r.error.message);
  }
  const profile = profileRes.data;
  if (!profile) notFound();
  const auth = authRows[0];

  const sessions = (sessionsRes.data ?? []) as {
    id: string;
    config: SessionConfig;
    status: string;
    total: number | null;
    created_at: string;
    completed_at: string | null;
  }[];
  const completed = sessions.filter((s) => s.status === "completed" && s.total != null) as (typeof sessions[number] & { total: number })[];
  const stats = summaryStats(completed);
  const perDomain = domainAverages(completed);
  const usage = usageRes.data ?? [];

  const envAdmin = isEnvAdmin(auth?.email);
  const isSelf = me.id === id;
  const base = `/api/admin/users/${id}`;

  return (
    <>
      <PageHeader
        title={profile.name || "(no name)"}
        description={auth?.email}
        actions={
          <div className="flex flex-wrap gap-2">
            {profile.role === "admin" && <Badge tone="brand">admin</Badge>}
            {envAdmin && <Badge tone="brand">admin via ADMIN_EMAILS</Badge>}
            {profile.suspended_at && <Badge>suspended</Badge>}
          </div>
        }
      />

      <div className="flex flex-col gap-4">
        <KpiGrid>
          <KpiTile label="sessions" value={fmtNum(sessions.length)} sub={`${completed.length} completed`} />
          <KpiTile label="avg score" value={completed.length ? fmtNum(stats.average, 1) : "—"} />
          <KpiTile label="best score" value={completed.length ? fmtNum(stats.best) : "—"} />
          <KpiTile label="questions answered" value={fmtNum(attemptsRes.count ?? 0)} />
          <KpiTile label="saved questions" value={fmtNum(savedRes.count ?? 0)} />
          <KpiTile label="friends" value={fmtNum(friendsRes.count ?? 0)} />
        </KpiGrid>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Panel title="account">
            <Facts
              items={[
                { label: "user id", value: <code className="text-[12px]">{id}</code> },
                { label: "email", value: auth?.email ?? "—" },
                { label: "joined", value: fmtDateTime(auth?.created_at ?? profile.created_at) },
                { label: "last sign-in", value: fmtDateTime(auth?.last_sign_in_at) },
                { label: "role", value: profile.role },
                {
                  label: "suspended",
                  value: profile.suspended_at ? `${fmtDateTime(profile.suspended_at)}${profile.suspended_reason ? ` — ${profile.suspended_reason}` : ""}` : "no",
                },
                {
                  label: "AI calls (30 days)",
                  value: `${usage.length} (${usage.filter((u) => !u.ok).length} failed)`,
                },
                {
                  label: "domains",
                  value: perDomain.length
                    ? perDomain.map((d) => `${domainShort(d.domain as Domain)} ${Math.round(d.average)}`).join(" · ")
                    : "—",
                },
              ]}
            />
          </Panel>

          <Panel title="actions" note={isSelf ? "you can't change your own account here" : undefined}>
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                {profile.suspended_at ? (
                  <ActionButton url={`${base}/suspend`} method="DELETE" disabled={isSelf}>
                    unsuspend
                  </ActionButton>
                ) : (
                  <ActionButton
                    url={`${base}/suspend`}
                    body={{ reason: "suspended from admin dashboard" }}
                    confirm="Suspend this user? They are signed out and can't sign in until unsuspended."
                    variant="danger"
                    disabled={isSelf}
                  >
                    suspend
                  </ActionButton>
                )}
                {profile.role === "admin" ? (
                  <ActionButton url={`${base}/role`} body={{ role: "user" }} confirm="Remove admin access?" disabled={isSelf}>
                    remove admin
                  </ActionButton>
                ) : (
                  <ActionButton
                    url={`${base}/role`}
                    body={{ role: "admin" }}
                    confirm="Give this user full admin access?"
                    disabled={isSelf}
                  >
                    make admin
                  </ActionButton>
                )}
              </div>
              <div className="flex flex-wrap gap-2 border-t border-line pt-4">
                <ActionButton
                  url={`${base}/progress`}
                  method="DELETE"
                  confirm="Delete all of this user's sessions, attempts and saved questions? Their account stays."
                  confirmText="reset"
                  variant="danger"
                >
                  reset progress
                </ActionButton>
                <ActionButton
                  url={base}
                  method="DELETE"
                  confirm="Permanently delete this account and all its data? This can't be undone."
                  confirmText="delete"
                  variant="danger"
                  redirectTo="/admin/users"
                  disabled={isSelf}
                >
                  delete account
                </ActionButton>
                <a href={`${base}/export`} className="inline-flex h-9 items-center rounded-full bg-surface-3 px-4 text-[13px] hover:bg-surface-2">
                  export data (JSON)
                </a>
              </div>
              {envAdmin && (
                <p className="text-[12px] text-faint">
                  This account is an admin through the ADMIN_EMAILS setting; changing the role here doesn&apos;t remove that.
                </p>
              )}
            </div>
          </Panel>
        </div>

        <Panel title="sessions" note="latest 100">
          <Table head={["started", "domain", "level", "mode", "status", "score"]} empty={!sessions.length}>
            {sessions.map((s) => (
              <Tr key={s.id}>
                <Td className="whitespace-nowrap">
                  <TextLink href={`/admin/sessions/${s.id}`}>{fmtDateTime(s.created_at)}</TextLink>
                </Td>
                <Td>{domainShort(s.config.domain)}</Td>
                <Td>{s.config.difficulty}</Td>
                <Td>{s.config.mode}</Td>
                <Td>{s.status.replace("_", " ")}</Td>
                <Td className="tabular-nums">{s.total ?? "—"}</Td>
              </Tr>
            ))}
          </Table>
        </Panel>

        <Panel title="feedback">
          <Table head={["date", "category", "rating", "message", "status"]} empty={!feedbackRes.data?.length}>
            {(feedbackRes.data ?? []).map((f) => (
              <Tr key={f.id}>
                <Td className="whitespace-nowrap">{fmtDate(f.created_at)}</Td>
                <Td>{f.category}</Td>
                <Td>{f.rating}/5</Td>
                <Td className="max-w-[28rem]">{f.message}</Td>
                <Td>{f.status}</Td>
              </Tr>
            ))}
          </Table>
        </Panel>
      </div>
    </>
  );
}
