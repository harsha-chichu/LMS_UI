import { z } from "zod";
import { DOMAIN_VALUES } from "@/types";
import { MAX_SAVED_TEST, MAX_TOPIC_LENGTH, MAX_TOPICS } from "@/lib/constants";

const domain = z.enum(DOMAIN_VALUES);
const difficulty = z.enum(["easy", "medium", "hard"]);
const mode = z.enum(["voice", "text"]);

export const sessionConfigSchema = z.object({
  domain,
  difficulty,
  count: z.number().int().min(1).max(10),
  mode,
  // Free text that ends up in a prompt, so keep it short and few.
  topics: z
    .array(z.string().trim().min(1).max(MAX_TOPIC_LENGTH))
    .max(MAX_TOPICS)
    .transform((ts) => ts.filter((t, i) => ts.findIndex((u) => u.toLowerCase() === t.toLowerCase()) === i))
    .optional(),
});

/** POST /api/sessions body for a "practise unsolved" session. */
export const practiceRequestSchema = z.object({
  practice: z.object({ domain, difficulty }),
  mode,
});

/** POST /api/sessions body for a test on saved questions (lms_saved_questions ids, in order). */
export const savedTestRequestSchema = z.object({
  saved: z
    .array(z.string().uuid())
    .min(1)
    .max(MAX_SAVED_TEST)
    .transform((ids) => [...new Set(ids)]),
  mode,
});

// ---- model output formats ----

export const questionsOutput = z.object({
  questions: z.array(z.object({ text: z.string(), topic: z.string() })),
});

export const evaluationOutput = z.object({
  score: z.number(),
  feedback: z.string(),
  next_time: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  suggested_answer: z.string(),
  suggested_points: z.array(z.string()),
  /** One short model answer per follow-up listed in the prompt, in order; empty when there were none. */
  follow_up_answers: z.array(z.string()),
  needs_follow_up: z.boolean(),
  follow_up: z.string().nullable(),
});

export const followUpOutput = z.object({
  needs_follow_up: z.boolean(),
  follow_up: z.string().nullable(),
});

export const narrativeOutput = z.object({
  summary: z.string(),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  clarity_level: z.number(),
  clarity_label: z.string(),
  confidence_level: z.number(),
  confidence_label: z.string(),
});
