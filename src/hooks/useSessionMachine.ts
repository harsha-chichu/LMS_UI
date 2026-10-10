"use client";

import { useReducer } from "react";
import { emptyResult, pendingFollowUp, resumeIndex } from "@/lib/sessions/progress";
import type { AnswerMode, QuestionResult, SessionRow } from "@/types";

/**
 * Session screen state. The server owns the results: every answer or skip
 * round-trips through the API and comes back as the updated QuestionResult,
 * which decides whether a follow-up is waiting or we move on. Scoring may
 * still be running in the background when we advance.
 */

export type Phase = "answering" | "listening" | "submitting" | "finishing";
export type Target = "main" | "followup";

export interface SessionState {
  index: number;
  results: QuestionResult[];
  phase: Phase;
  target: Target;
  input: AnswerMode;
  listenStartedAt: number | null;
  draft: string;
  /** Optimistic text shown while an answer is being submitted. */
  pending: string | null;
  error: string | null;
}

type Action =
  | { type: "listen"; at: number }
  | { type: "cancelListening" }
  | { type: "setInput"; input: AnswerMode; draft?: string }
  | { type: "setDraft"; draft: string }
  | { type: "setError"; error: string | null }
  | { type: "submitting"; text: string | null }
  | { type: "synced"; result: QuestionResult }
  | { type: "failed"; error: string; draft?: string };

function position(results: QuestionResult[], index: number): Pick<SessionState, "index" | "target" | "phase"> {
  if (index >= results.length) return { index, target: "main", phase: "finishing" };
  const r = results[index];
  return { index, target: r.answer && pendingFollowUp(r) ? "followup" : "main", phase: "answering" };
}

function reducer(state: SessionState, action: Action): SessionState {
  switch (action.type) {
    case "listen":
      return { ...state, phase: "listening", input: "voice", listenStartedAt: action.at, error: null };
    case "cancelListening":
      return { ...state, phase: "answering", listenStartedAt: null };
    case "setInput":
      return { ...state, input: action.input, phase: "answering", listenStartedAt: null, draft: action.draft ?? state.draft };
    case "setDraft":
      return { ...state, draft: action.draft };
    case "setError":
      return { ...state, error: action.error };
    case "submitting":
      return { ...state, phase: "submitting", pending: action.text, listenStartedAt: null, error: null };
    case "synced": {
      const results = state.results.map((r, i) => (i === state.index ? action.result : r));
      return {
        ...state,
        results,
        ...position(results, resumeIndex(results)),
        draft: "",
        pending: null,
        error: null,
      };
    }
    case "failed":
      return {
        ...state,
        phase: "answering",
        pending: null,
        error: action.error,
        ...(action.draft ? { input: "text" as AnswerMode, draft: action.draft } : {}),
      };
  }
}

export function useSessionMachine(row: SessionRow, defaultInput: AnswerMode) {
  return useReducer(reducer, row, (r): SessionState => {
    const results = r.questions.map((q, i) => r.results[i] ?? emptyResult(q));
    return {
      results,
      ...position(results, resumeIndex(results)),
      input: defaultInput,
      listenStartedAt: null,
      draft: "",
      pending: null,
      error: null,
    };
  });
}
