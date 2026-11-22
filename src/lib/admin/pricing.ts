/**
 * Rough per-million-token prices (USD) for the cost estimate on /admin/ai.
 * Dashboard estimates only: the Anthropic console has the real bill.
 * Unknown models use DEFAULT.
 */
const PRICES: Record<string, { input: number; output: number }> = {
  "claude-opus-5-5": { input: 5, output: 25 },
  "claude-sonnet-5-5": { input: 3, output: 15 },
  "claude-haiku-5-5": { input: 1, output: 5 },
};
const DEFAULT = { input: 5, output: 25 };

export function estimateCostUsd(model: string | null | undefined, inputTokens: number, outputTokens: number) {
  const p = (model && PRICES[model]) || DEFAULT;
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}
