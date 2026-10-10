import { z } from "zod";

const domain = z.enum(["ai-ml", "data-science", "backend", "frontend", "system-design", "behavioral"]);
const difficulty = z.enum(["easy", "medium", "hard"]);
const mode = z.enum(["voice", "text"]);

export const sessionConfigSchema = z.object({
  domain,
  difficulty,
  count: z.number().int().min(1).max(10),
  mode,
});

// ---- model output formats ----

export const questionsOutput = z.object({
  questions: z.array(z.string()),
});

export const evaluationOutput = z.object({
  score: z.number(),
  feedback: z.string(),
  next_time: z.string(),
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
