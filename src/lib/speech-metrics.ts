import type { SpeechMetrics, Turn } from "@/types";

const FILLERS = ["um", "uh", "erm", "basically", "actually", "you know", "i mean", "sort of", "kind of"];
const HEDGES = ["i think", "maybe", "probably", "i guess", "not sure", "i believe", "perhaps"];

function countPhrase(text: string, phrase: string) {
  const pattern = new RegExp(`\\b${phrase.replace(/ /g, "\\s+")}\\b`, "g");
  return text.match(pattern)?.length ?? 0;
}

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Delivery metrics computed locally from the transcripts; no LLM needed. */
export function computeSpeechMetrics(turns: Turn[]): SpeechMetrics {
  const voice = turns.filter((t) => t.mode === "voice" && t.durationSec > 0);
  const voiceSeconds = voice.reduce((s, t) => s + t.durationSec, 0);
  const voiceWords = voice.reduce((s, t) => s + wordCount(t.text), 0);
  const minutes = voiceSeconds / 60;

  const all = turns.map((t) => t.text.toLowerCase()).join(" ");
  const voiceText = voice.map((t) => t.text.toLowerCase()).join(" ");

  const fillerCounts: Record<string, number> = {};
  for (const f of FILLERS) {
    const n = countPhrase(voiceText, f);
    if (n > 0) fillerCounts[f] = n;
  }
  const fillerTotal = Object.values(fillerCounts).reduce((a, b) => a + b, 0);

  return {
    voiceSeconds,
    voiceWords,
    wpm: minutes > 0.1 ? Math.round(voiceWords / minutes) : null,
    fillerCounts,
    fillerTotal,
    fillersPerMin: minutes > 0.1 ? Math.round((fillerTotal / minutes) * 10) / 10 : null,
    hedges: HEDGES.reduce((s, h) => s + countPhrase(all, h), 0),
  };
}
