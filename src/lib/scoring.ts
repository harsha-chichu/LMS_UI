import { ANSWER_WEIGHT, COMMUNICATION_WEIGHT } from "@/lib/constants";
import type { AgentCommunication, MetricReading, QuestionResult, Report, SessionConfig, SpeechMetrics } from "@/types";

/** The qualitative half of a report, written by the LLM (or the mock). */
export interface ReportNarrative {
  summary: string;
  strengths: string[];
  improvements: string[];
  clarity: MetricReading;
  confidence: MetricReading;
}

function paceReading(wpm: number | null): MetricReading | null {
  if (wpm === null) return null;
  const d = Math.abs(wpm - 140);
  const level = d <= 10 ? 5 : d <= 20 ? 4 : d <= 35 ? 3 : d <= 55 ? 2 : 1;
  return { level, label: `${wpm} wpm` };
}

function fillerReading(m: SpeechMetrics): MetricReading | null {
  if (m.fillersPerMin === null) return null;
  const r = m.fillersPerMin;
  const level = r === 0 ? 5 : r < 1 ? 4 : r < 2 ? 3 : r < 3.5 ? 2 : 1;
  return { level, label: `${m.fillerTotal} · ${r}/min` };
}

function fillerTip(m: SpeechMetrics): string | null {
  const top = Object.entries(m.fillerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2);
  if (top.length > 0) {
    const parts = top.map(([word, n]) => `“${word}” ${n} time${n === 1 ? "" : "s"}`);
    return `said ${parts.join(" and ")} — try a short pause instead`;
  }
  if (m.wpm !== null && m.wpm > 175) return "you spoke quickly — slow down on the key point so it lands";
  if (m.wpm !== null && m.wpm < 100) return "long pauses between ideas — outline your answer in one sentence first";
  return null;
}

function agentTip(comms: AgentCommunication[]): string | null {
  const fillers = [...new Set(comms.flatMap((c) => c.filler_words_used))].slice(0, 3);
  if (fillers.length) return `fillers heard: ${fillers.map((f) => `“${f}”`).join(", ")} — try a short pause instead`;
  const pauses = comms.reduce((n, c) => n + c.pause_count, 0);
  if (pauses >= 4) return `${pauses} long pauses — outline your answer in one sentence before you start`;
  return null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Audio-based delivery scores from the eval agent, across every recorded turn. */
function agentCommunication(results: QuestionResult[]): AgentCommunication[] {
  return results
    .flatMap((r) => [r.answer, ...r.followUps.map((f) => f.answer)])
    .map((t) => t?.communication)
    .filter((c): c is AgentCommunication => !!c);
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

function clarityFromAgent(comms: AgentCommunication[]): MetricReading {
  const avg = mean(comms.map((c) => c.clarity_score));
  return {
    level: Math.max(1, Math.min(5, Math.round(avg / 2))),
    label: avg >= 8 ? "clear" : avg >= 6 ? "mostly clear" : "hard to follow",
  };
}

export function buildReport(input: {
  id: string;
  config: SessionConfig;
  results: QuestionResult[];
  metrics: SpeechMetrics;
  narrative: ReportNarrative;
}): Report {
  const { id, config, results, metrics, narrative } = input;

  // Skipped questions count as 0 so skipping isn't a way to raise the score.
  const perQuestion = results.map((r) => (r.skipped || !r.evaluation ? 0 : r.evaluation.score));
  const answersScore = Math.round(
    (perQuestion.reduce((a, b) => a + b, 0) / Math.max(results.length, 1)) * 10,
  );

  const comms = agentCommunication(results);
  const clarity = comms.length ? clarityFromAgent(comms) : narrative.clarity;
  const pace = paceReading(metrics.wpm);
  const fillers = fillerReading(metrics);
  const levels = [clarity.level, narrative.confidence.level, pace?.level, fillers?.level].filter(
    (l): l is number => typeof l === "number",
  );
  let communicationScore = Math.round((levels.reduce((a, b) => a + b, 0) / (levels.length * 5)) * 100);
  if (comms.length) {
    // Blend in what the agent heard in the audio (grammar, pronunciation, fluency, clarity; each 0–10).
    const heard = mean(
      comms.map((c) => (c.grammar_score + c.pronunciation_score + c.fluency_score + c.clarity_score) / 4),
    );
    communicationScore = Math.round((communicationScore + heard * 10) / 2);
  }

  const total = Math.round(answersScore * ANSWER_WEIGHT + communicationScore * COMMUNICATION_WEIGHT);

  return {
    id,
    createdAt: new Date().toISOString(),
    config,
    total,
    answersScore,
    communicationScore,
    followUps: results.reduce((n, r) => n + r.followUps.length, 0),
    summary: narrative.summary,
    strengths: narrative.strengths,
    improvements: narrative.improvements,
    communication: {
      clarity,
      confidence: narrative.confidence,
      pace: pace ?? { level: 0, label: "typed answers" },
      fillers: fillers ?? { level: 0, label: "typed answers" },
      tip: fillerTip(metrics) ?? agentTip(comms),
    },
    questions: results.map((r) => ({
      text: r.question.text,
      score: r.skipped || !r.evaluation ? null : round1(r.evaluation.score),
      mode: r.answer?.mode ?? null,
      feedback: r.skipped ? "skipped — no answer recorded." : (r.evaluation?.feedback ?? ""),
      nextTime: r.skipped
        ? "even a rough first answer earns points — try one sentence on the core idea."
        : (r.evaluation?.nextTime ?? ""),
    })),
  };
}
