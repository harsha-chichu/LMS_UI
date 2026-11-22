import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { recordUsage } from "@/lib/admin/usage";

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
  /** Label for the admin usage dashboard, e.g. "evaluate". */
  operation?: string;
}): Promise<z.infer<T>> {
  const started = Date.now();
  const operation = opts.operation ?? "structured";
  try {
    const result = await parse(opts);
    recordUsage({
      kind: "claude",
      operation,
      ok: true,
      latencyMs: Date.now() - started,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    });
    return result.output;
  } catch (err) {
    recordUsage({
      kind: "claude",
      operation,
      ok: false,
      latencyMs: Date.now() - started,
      model: MODEL,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

async function parse<T extends z.ZodType>(opts: {
  schema: T;
  system: string;
  prompt: string;
  effort: "low" | "medium" | "high";
  maxTokens?: number;
}) {
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
  return {
    output: response.parsed_output as z.infer<T>,
    model: response.model,
    // Cache reads/writes are billed as input too.
    inputTokens:
      response.usage.input_tokens +
      (response.usage.cache_creation_input_tokens ?? 0) +
      (response.usage.cache_read_input_tokens ?? 0),
    outputTokens: response.usage.output_tokens,
  };
}
