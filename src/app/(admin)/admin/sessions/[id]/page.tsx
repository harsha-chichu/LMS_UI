import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionButton } from "@/components/admin/actions";
import { Badge, Facts, PageHeader, Panel, Skeleton, TextLink } from "@/components/admin/ui";
import { domainLabel } from "@/lib/constants";
import { db, emailsFor, isUuid } from "@/lib/admin/data";
import { fmtDateTime } from "@/lib/admin/format";
import { requireAdminPage } from "@/lib/admin/guard";
import { hasSuggestion, missingSuggestionIndexes, unscoredIndexes } from "@/lib/admin/rescore";
import type { QuestionResult, Report, SessionConfig, Question } from "@/types";

export const metadata: Metadata = { title: "session" };

export default function SessionPage({ params }: PageProps<"/admin/sessions/[id]">) {
  return (
    <Suspense fallback={<Skeleton rows={3} />}>
      <SessionDetail params={params} />
    </Suspense>
  );
}

async function SessionDetail({ params }: { params: PageProps<"/admin/sessions/[id]">["params"] }) {
  const { access } = await requireAdminPage();
  const canWrite = access === "admin";
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const { data, error } = await db().from("lms_sessions").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) notFound();
  const s = data as {
    id: string;
    user_id: string;
    config: SessionConfig;
    questions: Question[];
    results: QuestionResult[];
    status: string;
    report: Report | null;
    total: number | null;
    created_at: string;
    completed_at: string | null;
  };
  const who = (await emailsFor([s.user_id])).get(s.user_id);
  const unscored = unscoredIndexes(s.results ?? []);
  const missing = missingSuggestionIndexes(s.results ?? []);

  return (
    <>
      <PageHeader
        title={`${domainLabel(s.config.domain)} · ${s.config.difficulty}`}
        description={`session ${s.id}`}
        actions={
          canWrite ? (
            <>
              {unscored.length > 0 && s.status !== "abandoned" && (
                <ActionButton
                  url={`/api/admin/sessions/${s.id}/rescore`}
                  variant="primary"
                  confirm={`Score ${unscored.length} unscored answer${unscored.length === 1 ? "" : "s"} with the eval agent (Claude as backup)${s.status === "completed" ? " and rebuild the report" : ""}? This can take a minute or two.`}
                >
                  re-score {unscored.length} unscored
                </ActionButton>
              )}
              {missing.length > 0 && s.status === "completed" && (
                <ActionButton
                  url={`/api/admin/sessions/${s.id}/suggest`}
                  confirm={`Write suggested answers for ${missing.length} question${missing.length === 1 ? "" : "s"} with the eval agent (Claude as backup)? Scores and feedback stay as they are. This can take a minute or two.`}
                >
                  add {missing.length} suggested answer{missing.length === 1 ? "" : "s"}
                </ActionButton>
              )}
              {s.status === "in_progress" && (
                <ActionButton
                  url={`/api/admin/sessions/${s.id}/abandon`}
                  confirm="Mark this session as abandoned? The user won't be able to continue it."
                  variant="danger"
                >
                  force abandon
                </ActionButton>
              )}
            </>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-4">
        <Panel title="summary">
          <Facts
            items={[
              {
                label: "user",
                value: <TextLink href={`/admin/users/${s.user_id}`}>{who ? `${who.name || "(no name)"} · ${who.email}` : s.user_id}</TextLink>,
              },
              { label: "status", value: s.status.replace("_", " ") },
              { label: "started", value: fmtDateTime(s.created_at) },
              { label: "completed", value: fmtDateTime(s.completed_at) },
              { label: "mode", value: s.config.mode },
              { label: "questions", value: s.questions.length },
              { label: "topics", value: s.config.topics?.length ? s.config.topics.join(", ") : "any" },
              {
                label: "kind",
                value: s.config.retryOf ? "try again" : s.config.practice ? "practice" : s.config.saved ? "saved test" : "regular",
              },
              { label: "total", value: s.total ?? "—" },
              {
                label: "answers / communication",
                value: s.report ? `${s.report.answersScore} / ${s.report.communicationScore ?? "—"}` : "—",
              },
            ]}
          />
          {s.report?.summary && <p className="mt-4 border-t border-line pt-4 text-[14px] leading-relaxed text-foreground/90">{s.report.summary}</p>}
        </Panel>

        {s.questions.map((q, i) => {
          const r = s.results[i];
          return (
            <Panel
              key={q.id ?? i}
              title={`question ${i + 1}`}
              note={
                <span className="flex flex-wrap justify-end gap-1">
                  {r?.skipped && <Badge>skipped</Badge>}
                  {r?.scoring && (
                    <Badge tone={r.scoring.status === "failed" ? "default" : "muted"}>
                      {r.scoring.engine} · {r.scoring.status}
                    </Badge>
                  )}
                  {q.bankId && <Badge tone="muted">bank</Badge>}
                </span>
              }
            >
              <p className="text-[15px] leading-relaxed">{q.text}</p>
              {q.topics?.length ? <p className="mt-1 text-[12px] text-subtle">{q.topics.join(", ")}</p> : null}

              {r?.answer && (
                <Block label={`answer (${r.answer.mode}${r.answer.durationSec ? `, ${Math.round(r.answer.durationSec)}s` : ""})`}>
                  {r.answer.text || "(empty)"}
                </Block>
              )}
              {r?.followUps?.map((f, j) => (
                <div key={j}>
                  <Block label={`follow-up ${j + 1}`}>{f.question}</Block>
                  <Block label="follow-up answer">{f.skipped ? "(skipped)" : f.answer?.text || "(no answer)"}</Block>
                </div>
              ))}
              {r?.evaluation && (
                <Block label={`evaluation · ${r.evaluation.score}/10`}>
                  {r.evaluation.feedback}
                  {r.evaluation.nextTime && <span className="mt-2 block text-subtle">next time: {r.evaluation.nextTime}</span>}
                </Block>
              )}
              {r?.evaluation &&
                (hasSuggestion(r) ? (
                  <Block label="suggested answer">
                    {r.evaluation.suggestedPoints?.length ? (
                      <ol className="mb-2 list-decimal space-y-1 pl-5">
                        {r.evaluation.suggestedPoints.map((p, j) => (
                          <li key={j}>{p}</li>
                        ))}
                      </ol>
                    ) : null}
                    {r.evaluation.suggestedAnswer}
                  </Block>
                ) : (
                  <div className="mt-4 border-t border-line pt-3">
                    <Badge>no suggested answer stored</Badge>
                  </div>
                ))}
              {r?.answer?.communication && (
                <Block label="delivery (eval agent)">
                  grammar {r.answer.communication.grammar_score} · pronunciation {r.answer.communication.pronunciation_score} · fluency{" "}
                  {r.answer.communication.fluency_score} · clarity {r.answer.communication.clarity_score}
                </Block>
              )}
              {r?.scoring?.error && <Block label="scoring error">{r.scoring.error}</Block>}
            </Panel>
          );
        })}
      </div>
    </>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 border-t border-line pt-3">
      <div className="text-[12px] text-subtle">{label}</div>
      <div className="mt-1 text-[14px] leading-relaxed whitespace-pre-wrap text-foreground/90">{children}</div>
    </div>
  );
}
