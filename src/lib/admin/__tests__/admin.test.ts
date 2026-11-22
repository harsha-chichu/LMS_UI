import { describe, expect, it } from "vitest";
import { isEnvAdmin, parseAdminEmails } from "@/lib/admin/emails";
import { csvCell, toCsv } from "@/lib/admin/format";
import { estimateCostUsd } from "@/lib/admin/pricing";
import { parseRange } from "@/lib/admin/range";

describe("ADMIN_EMAILS", () => {
  it("parses commas, spaces, semicolons and case", () => {
    expect([...parseAdminEmails(" A@x.com, b@Y.io;c@z.dev  ")]).toEqual(["a@x.com", "b@y.io", "c@z.dev"]);
  });
  it("ignores junk and empty values", () => {
    expect(parseAdminEmails(undefined).size).toBe(0);
    expect(parseAdminEmails(",, nope ,").size).toBe(0);
  });
  it("matches case-insensitively and only listed emails", () => {
    expect(isEnvAdmin("Boss@Example.com", "boss@example.com")).toBe(true);
    expect(isEnvAdmin("other@example.com", "boss@example.com")).toBe(false);
    expect(isEnvAdmin(null, "boss@example.com")).toBe(false);
    expect(isEnvAdmin("boss@example.com", "")).toBe(false);
  });
});

describe("estimateCostUsd", () => {
  it("prices input and output per million tokens", () => {
    expect(estimateCostUsd("claude-opus-5-5", 1_000_000, 0)).toBe(5);
    expect(estimateCostUsd("claude-opus-5-5", 0, 1_000_000)).toBe(25);
  });
  it("falls back for unknown models", () => {
    expect(estimateCostUsd("mystery", 1_000_000, 0)).toBe(5);
  });
});

describe("csv", () => {
  it("quotes cells that need it", () => {
    expect(csvCell('a "b", c')).toBe('"a ""b"", c"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(3)).toBe("3");
  });
  it("neutralises spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
  });
  it("builds rows", () => {
    expect(toCsv(["a", "b"], [[1, "x,y"]])).toBe('a,b\r\n1,"x,y"\r\n');
  });
});

describe("parseRange", () => {
  const now = new Date("2026-11-22T12:00:00Z");
  it("defaults to 30 days", () => {
    const r = parseRange(undefined, now);
    expect(r.days).toBe(30);
    expect(r.to.toISOString()).toBe("2026-11-23T00:00:00.000Z");
    expect(r.from.toISOString()).toBe("2026-10-24T00:00:00.000Z");
  });
  it("accepts only known ranges", () => {
    expect(parseRange("7", now).days).toBe(7);
    expect(parseRange("9999", now).days).toBe(30);
  });
});
