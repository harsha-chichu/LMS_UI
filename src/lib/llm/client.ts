import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

const MODEL = "claude-opus-5-5";

let client: Anthropic | null = null;

function getClient() {
  // Resolves ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN / `ant auth login` profile.
  client ??= new Anthropic({ timeout: 60_000, maxRetries: 1 });
  return client;
}

/**
 * One structured-output call. Throws on refusal, truncation or unparseable
 * output; callers decide how to degrade.
 */
export async function generateStructured<T extends z.ZodType>(opts: {
  schema: T;
  system: string;
  prompt: string;
  effort: "low" | "medium" | "high";
  maxTokens?: number;
}): Promise<z.infer<T>> {
  const response = await getClient().beta.messages.parse({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 8000,
    // Server-side fallback: if a safety classifier declines, the API retries
    // on a suitable model within the same call.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: opts.system,
    messages: [{ role: "user", content: opts.prompt }],
    output_config: { effort: opts.effort, format: betaZodOutputFormat(opts.schema) },
  });

  if (response.stop_reason === "refusal") {
    throw new Error(`model declined (${response.stop_details?.category ?? "unknown"})`);
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("model output was truncated");
  }
  if (!response.parsed_output) {
    throw new Error("model output did not match the schema");
  }
  return response.parsed_output;
}
