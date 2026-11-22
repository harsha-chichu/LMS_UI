"use client";

import { JsonForm } from "@/components/admin/actions";
import { inputCls } from "@/components/admin/inputs";

const DOMAINS = [
  ["ai-ml", "AI / ML"],
  ["data-science", "data science"],
  ["backend", "backend"],
  ["frontend", "frontend"],
  ["system-design", "system design"],
  ["behavioral", "behavioral"],
] as const;

export interface QuestionDraft {
  id?: string;
  domain: string;
  difficulty: string;
  text: string;
  topics: string[];
  status?: string;
}

/** Add a bank question, or edit one (`question.id` set). */
export function QuestionForm({ question }: { question?: QuestionDraft }) {
  const editing = Boolean(question?.id);
  return (
    <JsonForm
      url={editing ? `/api/admin/questions/${question!.id}` : "/api/admin/questions"}
      method={editing ? "PATCH" : "POST"}
      submitLabel={editing ? "save changes" : "add question"}
      resetOnSuccess={!editing}
      transform={(f) => ({
        domain: f.domain,
        difficulty: f.difficulty,
        text: f.text,
        topics: f.topics
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
        ...(editing ? { status: f.status } : {}),
      })}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-[12px] text-subtle">
          domain
          <select name="domain" defaultValue={question?.domain ?? "backend"} className={inputCls}>
            {DOMAINS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-subtle">
          level
          <select name="difficulty" defaultValue={question?.difficulty ?? "medium"} className={inputCls}>
            {["easy", "medium", "hard"].map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
        {editing ? (
          <label className="flex flex-col gap-1 text-[12px] text-subtle">
            status
            <select name="status" defaultValue={question?.status ?? "active"} className={inputCls}>
              <option value="active">active</option>
              <option value="retired">retired</option>
            </select>
          </label>
        ) : (
          <span />
        )}
      </div>
      <label className="flex flex-col gap-1 text-[12px] text-subtle">
        question
        <textarea name="text" required minLength={10} maxLength={1000} rows={3} defaultValue={question?.text} className={inputCls} />
      </label>
      <label className="flex flex-col gap-1 text-[12px] text-subtle">
        topics (comma separated, lowercase)
        <input name="topics" defaultValue={question?.topics.join(", ")} className={inputCls} placeholder="e.g. caching, http" />
      </label>
    </JsonForm>
  );
}
