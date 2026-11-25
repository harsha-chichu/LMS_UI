import { z } from "zod";
import { MAX_SAVED_TEST, MAX_TOPIC_LENGTH, MAX_TOPICS } from "@/lib/constants";

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
