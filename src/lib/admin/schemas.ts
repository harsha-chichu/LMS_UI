import { z } from "zod";

export const domainSchema = z.enum(["ai-ml", "data-science", "backend", "frontend", "system-design", "behavioral"]);
export const difficultySchema = z.enum(["easy", "medium", "hard"]);

const topics = z
  .array(z.string().trim().toLowerCase().min(1).max(40))
  .max(8)
  .transform((t) => [...new Set(t)]);

export const questionCreateSchema = z.object({
  domain: domainSchema,
  difficulty: difficultySchema,
  text: z.string().trim().min(10, "question is too short").max(1000),
  topics: topics.default([]),
});

export const questionUpdateSchema = z
  .object({
    domain: domainSchema,
    difficulty: difficultySchema,
    text: z.string().trim().min(10, "question is too short").max(1000),
    topics,
    status: z.enum(["active", "retired"]),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "nothing to change");

export const feedbackUpdateSchema = z
  .object({
    status: z.enum(["new", "triaged", "resolved"]),
    adminNote: z.string().trim().max(2000),
  })
  .partial();

export const announcementSchema = z.object({
  message: z.string().trim().min(1, "write a message").max(500),
  level: z.enum(["info", "warning"]).default("info"),
  endsAt: z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) {
        ctx.addIssue({ code: "custom", message: "invalid end date" });
        return z.NEVER;
      }
      return d.toISOString();
    }),
});

export const settingSchema = z.object({
  key: z.enum(["maintenance", "sessions_paused"]),
  enabled: z.boolean(),
  message: z.string().trim().max(300).default(""),
});
