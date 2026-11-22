"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { adminFetch, buttonCls } from "@/components/admin/actions";
import { cn } from "@/lib/utils";

type Preview = {
  dryRun: boolean;
  valid?: number;
  added?: number;
  duplicates: number;
  problems: { line: number; error: string; text?: string }[];
  preview?: { domain: string; difficulty: string; text: string; topics: string[] }[];
};

const TEMPLATE = 'domain,difficulty,text,topics\nbackend,medium,"How would you add rate limiting to a public API?",apis;rate limiting\n';

/** Upload a CSV, check it (dry run), then add the new questions. */
export function QuestionImport() {
  const router = useRouter();
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (dryRun: boolean) =>
    start(async () => {
      setError(null);
      try {
        const out = (await adminFetch("/api/admin/questions/import", "POST", { csv, dryRun })) as unknown as Preview;
        setResult(out);
        if (!dryRun) router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "failed");
      }
    });

  return (
    <div className="flex flex-col gap-3 text-[13px]">
      <p className="text-subtle">
        Columns: <code>domain</code>, <code>difficulty</code>, <code>text</code>, and optional <code>topics</code> separated by{" "}
        <code>;</code>. Up to 1,000 rows.{" "}
        <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`} download="questions-template.csv" className="underline underline-offset-4">
          download a template
        </a>
      </p>
      <label className={cn(buttonCls.base, buttonCls.default, "cursor-pointer self-start")}>
        {fileName || "choose CSV file"}
        <input
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            setResult(null);
            setError(null);
            if (!file) return;
            if (file.size > 2_000_000) {
              setError("file is too large (2 MB max)");
              return;
            }
            setFileName(file.name);
            setCsv(await file.text());
          }}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!csv || pending} onClick={() => run(true)} className={cn(buttonCls.base, buttonCls.default)}>
          {pending ? "checking…" : "check file"}
        </button>
        {result?.dryRun && (result.valid ?? 0) > 0 && (
          <button type="button" disabled={pending} onClick={() => run(false)} className={cn(buttonCls.base, buttonCls.primary)}>
            add {result.valid} question{result.valid === 1 ? "" : "s"}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-[#ff8a8a]">
          {error}
        </p>
      )}
      {result && (
        <div className="flex flex-col gap-2" role="status">
          <p>
            {result.dryRun ? (
              <>
                <strong>{result.valid}</strong> new, {result.duplicates} already in the bank, {result.problems.length} with problems.
              </>
            ) : (
              <>
                Added <strong>{result.added}</strong>. Skipped {result.duplicates} already in the bank and {result.problems.length} with problems.
              </>
            )}
          </p>
          {result.problems.length > 0 && (
            <ul className="max-h-40 overflow-y-auto rounded-[12px] bg-surface-2 p-3 text-[12px]">
              {result.problems.slice(0, 50).map((p, i) => (
                <li key={i}>
                  line {p.line}: {p.error}
                  {p.text && <span className="text-subtle"> — {p.text}</span>}
                </li>
              ))}
            </ul>
          )}
          {result.dryRun && result.preview && result.preview.length > 0 && (
            <ul className="max-h-48 overflow-y-auto rounded-[12px] bg-surface-2 p-3 text-[12px]">
              {result.preview.map((q, i) => (
                <li key={i} className="py-0.5">
                  <span className="text-subtle">
                    {q.domain} · {q.difficulty}
                  </span>{" "}
                  {q.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
