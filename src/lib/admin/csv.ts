import { questionCreateSchema } from "@/lib/admin/schemas";

/** Parses CSV text (RFC 4180: quoted fields, "" escapes, CRLF or LF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"' && field === "") quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

export const IMPORT_MAX_ROWS = 1000;

export type ImportRow = { domain: string; difficulty: string; text: string; topics: string[] };
export type ImportProblem = { line: number; error: string; text?: string };

/**
 * Turns an uploaded CSV into bank questions. Needs a header row with domain,
 * difficulty and text (topics optional, separated by ";" or "|"). Rows that
 * don't validate come back as problems with their line number.
 */
export function questionsFromCsv(text: string): { rows: ImportRow[]; problems: ImportProblem[] } {
  const all = parseCsv(text);
  if (!all.length) return { rows: [], problems: [{ line: 1, error: "the file is empty" }] };
  const header = all[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const missing = ["domain", "difficulty", "text"].filter((n) => col(n) < 0);
  if (missing.length) return { rows: [], problems: [{ line: 1, error: `missing column(s): ${missing.join(", ")}` }] };
  const body = all.slice(1);
  if (body.length > IMPORT_MAX_ROWS) {
    return { rows: [], problems: [{ line: 1, error: `too many rows (${body.length}); the limit is ${IMPORT_MAX_ROWS}` }] };
  }

  const rows: ImportRow[] = [];
  const problems: ImportProblem[] = [];
  const seen = new Set<string>();
  body.forEach((cells, i) => {
    const line = i + 2;
    const get = (name: string) => (col(name) >= 0 ? (cells[col(name)] ?? "").trim() : "");
    const parsed = questionCreateSchema.safeParse({
      domain: get("domain").toLowerCase(),
      difficulty: get("difficulty").toLowerCase(),
      text: get("text"),
      topics: get("topics")
        .split(/[;|]/)
        .map((t) => t.trim())
        .filter(Boolean),
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      problems.push({ line, error: `${issue?.path.join(".") || "row"}: ${issue?.message ?? "invalid"}`, text: get("text").slice(0, 80) });
      return;
    }
    // Same key the database uses for duplicates (unique domain + normalised text).
    const key = `${parsed.data.domain}|${parsed.data.text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}`;
    if (seen.has(key)) {
      problems.push({ line, error: "duplicate of an earlier row in this file", text: parsed.data.text.slice(0, 80) });
      return;
    }
    seen.add(key);
    rows.push(parsed.data);
  });
  return { rows, problems };
}
