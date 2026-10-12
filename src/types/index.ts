export type Domain =
  | "ai-ml"
  | "data-science"
  | "backend"
  | "frontend"
  | "system-design"
  | "behavioral";

export type Difficulty = "easy" | "medium" | "hard";

export type AnswerMode = "voice" | "text";

export interface SessionConfig {
  domain: Domain;
  difficulty: Difficulty;
  count: number;
  mode: AnswerMode;
}

export interface Question {
  id: string;
  text: string;
}

/** Delivery assessment from the eval agent, when the answer was recorded audio. */
export interface AgentCommunication {
  grammar_score: number;
  pronunciation_score: number;
  fluency_score: number;
  clarity_score: number;
  filler_words_used: string[];
  pause_count: number;
  communication_feedback: string;
}

/** One spoken or typed answer. */
export interface Turn {
  text: string;
  mode: AnswerMode;
  /** Seconds spent speaking. 0 for typed answers. */
  durationSec: number;
  communication?: AgentCommunication | null;
}

export interface Evaluation {
  /** 0–10, one decimal. */
  score: number;
  feedback: string;
  nextTime: string;
  needsFollowUp: boolean;
  followUp: string | null;
  strengths?: string[];
  weaknesses?: string[];
}

export interface FollowUp {
  question: string;
  answer?: Turn;
  skipped: boolean;
}

/** Who is scoring a question, and whether that's finished. */
export interface Scoring {
  engine: "agent" | "claude";
  status: "pending" | "done" | "failed";
  threadId?: string;
}

export interface QuestionResult {
  question: Question;
  skipped: boolean;
  answer?: Turn;
  followUps: FollowUp[];
  evaluation?: Evaluation;
  scoring?: Scoring;
}

export type SessionStatus = "in_progress" | "completed" | "abandoned";

/** A row of the `sessions` table. */
export interface SessionRow {
  id: string;
  config: SessionConfig;
  questions: Question[];
  results: QuestionResult[];
  status: SessionStatus;
  report: Report | null;
  total: number | null;
  created_at: string;
  completed_at: string | null;
}

export interface MetricReading {
  /** 0–5 filled bars. */
  level: number;
  label: string;
}

export interface Report {
  id: string;
  createdAt: string;
  config: SessionConfig;
  total: number;
  answersScore: number;
  communicationScore: number;
  followUps: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  communication: {
    clarity: MetricReading;
    pace: MetricReading;
    confidence: MetricReading;
    fillers: MetricReading;
    tip: string | null;
  };
  questions: {
    text: string;
    score: number | null;
    mode: AnswerMode | null;
    feedback: string;
    nextTime: string;
  }[];
}

export interface Preferences {
  mode: AnswerMode;
  difficulty: Difficulty;
  domain: Domain;
  count: number;
  /** Accent colour as `#rrggbb`; unset means the default orange. */
  accent?: string;
}

/** A question the user bookmarked, copied out of its session. */
export interface SavedQuestion {
  id: string;
  session_id: string;
  question_index: number;
  text: string;
  domain: Domain;
  difficulty: Difficulty;
  created_at: string;
}

export interface Profile {
  id: string;
  name: string;
  email: string;
  preferences: Preferences;
}

export interface SpeechMetrics {
  voiceSeconds: number;
  voiceWords: number;
  wpm: number | null;
  fillerCounts: Record<string, number>;
  fillerTotal: number;
  fillersPerMin: number | null;
  hedges: number;
}
