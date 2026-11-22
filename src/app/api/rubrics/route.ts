import { z } from "zod";
import { fetchRubric } from "@/lib/agent/client";
import { agentDomain } from "@/lib/agent/map";
import { requireUser } from "@/lib/auth";
import type { ScoringRubric } from "@/types";

const querySchema = z.object({
  domain: z.enum(["ai-ml", "data-science", "backend", "frontend", "system-design", "behavioral"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
});

/** The eval agent's rubric for a domain and difficulty, so the setup screen can show how answers are scored. */
export async function GET(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) return Response.json({ error: "invalid request" }, { status: 400 });
  const { domain, difficulty } = parsed.data;

  try {
    const r = await fetchRubric(agentDomain(domain), difficulty);
    const rubric: ScoringRubric = {
      difficulty,
      expectations: r.expectations,
      criteria: r.criteria.map((c) => ({ name: c.name, weight: c.weight, looksFor: c.looks_for })),
      forgiven: r.forgiven,
      notForgiven: r.not_forgiven,
    };
    return Response.json(rubric, { headers: { "Cache-Control": "private, max-age=3600" } });
  } catch (err) {
    console.warn("[rubrics] agent unavailable:", err instanceof Error ? err.message : err);
    return Response.json({ error: "rubric unavailable" }, { status: 503 });
  }
}
