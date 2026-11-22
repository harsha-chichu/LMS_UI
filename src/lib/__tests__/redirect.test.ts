import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/redirect";

describe("safeNext", () => {
  it.each([
    ["/profile", "/profile"],
    ["/profile?tab=saved#top", "/profile?tab=saved#top"],
    ["/report/abc", "/report/abc"],
  ])("keeps the same-site path %s", (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });

  it.each([
    "//evil.com",
    "/\\evil.com",
    "/\\/evil.com",
    "/\t/evil.com",
    "/\n/evil.com",
    "https://evil.com",
    "javascript:alert(1)",
    "evil.com",
    "",
    null,
    undefined,
  ])("falls back to /setup for %j", (input) => {
    expect(safeNext(input)).toBe("/setup");
  });
});
