import { z } from "zod";
import { DOMAIN_VALUES } from "@/types";

export const domainSchema = z.enum(DOMAIN_VALUES);
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

const nonNegInt = z.number().int().min(0).max(100000);

/** Values for lms_app_settings keys edited from /admin/system and /admin/alerts. */
export const configSchema = z.discriminatedUnion("key", [
  z.object({
    key: z.literal("alerts"),
    value: z.object({
      enabled: z.boolean(),
      aiErrorRate: z.number().min(0.01).max(1),
      aiMinCalls: nonNegInt,
      stuckSessions: nonNegInt,
      newErrorGroups: nonNegInt,
    }),
  }),
  z.object({
    key: z.literal("budget"),
    value: z.object({ enabled: z.boolean(), daily_usd: z.number().min(0).max(100000) }),
  }),
  z.object({
    key: z.literal("rate_limits"),
    value: z.object({
      session: nonNegInt.optional(),
      speechToken: nonNegInt.optional(),
      answer: nonNegInt.optional(),
      feedback: nonNegInt.optional(),
    }),
  }),
  z.object({
    key: z.literal("welcome"),
    value: z
      .object({
        enabled: z.boolean(),
        title: z.string().trim().max(120),
        body: z.string().trim().max(5000),
        sendEmail: z.boolean(),
      })
      .refine((v) => !v.enabled || v.body.length > 0, { message: "write a message before turning it on", path: ["body"] }),
  }),
]);

export const limitOverrideSchema = z.object({
  bucket: z.enum(["session", "speechToken", "answer", "feedback"]),
  maxCount: nonNegInt,
  hours: z.number().int().min(1).max(24 * 90),
});

export const reviewSchema = z.object({
  sessionId: z.uuid(),
  questionIndex: z.number().int().min(0).max(50),
  verdict: z.enum(["fair", "too_high", "too_low"]),
  note: z.string().trim().max(1000).optional(),
});

export const emailSchema = z.object({
  audience: z.enum(["contact_ok", "inactive", "all", "one"]),
  days: z.number().int().min(1).max(365).default(14),
  userId: z.uuid().optional(),
  subject: z.string().trim().min(1, "add a subject").max(150),
  body: z.string().trim().min(1, "write a message").max(10000),
  dryRun: z.boolean().default(true),
});

export const roleSchema = z.object({ role: z.enum(["user", "support", "admin"]) });
