import { createHash } from "node:crypto";

/**
 * Message with the parts that change between occurrences (UUIDs, hex ids,
 * numbers, quoted values) replaced, so repeats of one error group together.
 */
export function normalizeMessage(message: string) {
  return message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<id>")
    .replace(/\b[0-9a-f]{16,}\b/gi, "<id>")
    .replace(/"[^"]{0,200}"|'[^']{0,200}'/g, "<str>")
    .replace(/\d+(\.\d+)?/g, "<n>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

/** Stable id for an error group: where it happened plus its normalised message. */
export function errorFingerprint(source: string, route: string | null | undefined, message: string) {
  return createHash("sha1")
    .update(`${source}|${route ?? ""}|${normalizeMessage(message)}`)
    .digest("hex")
    .slice(0, 16);
}
