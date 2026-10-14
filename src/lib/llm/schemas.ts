import { z } from "zod";
import { MAX_TOPIC_LENGTH, MAX_TOPICS } from "@/lib/constants";

const domain = z.enum(["ai-ml", "data-science", "backend", "frontend", "system-design", "behavioral"]);
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
