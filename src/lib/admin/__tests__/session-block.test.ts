import { describe, expect, it } from "vitest";
import { MAINTENANCE_SESSION_MESSAGE, PAUSED_SESSION_MESSAGE, newSessionBlock } from "@/lib/admin/session-block";

const row = (key: string, enabled: boolean, message = "") => ({ key, value: { enabled, message } });

describe("newSessionBlock", () => {
  it("allows sessions when nothing is switched on", () => {
    expect(newSessionBlock(null)).toBeNull();
    expect(newSessionBlock([])).toBeNull();
    expect(newSessionBlock([row("maintenance", false), row("sessions_paused", false)])).toBeNull();
  });

  it("blocks during maintenance, with or without a custom message", () => {
    expect(newSessionBlock([row("maintenance", true)])).toBe(MAINTENANCE_SESSION_MESSAGE);
    expect(newSessionBlock([row("maintenance", true, "Upgrading the database.")])).toBe(
      "Upgrading the database. new sessions are paused until we're done.",
    );
  });

  it("blocks when sessions are paused", () => {
    expect(newSessionBlock([row("sessions_paused", true)])).toBe(PAUSED_SESSION_MESSAGE);
    expect(newSessionBlock([row("sessions_paused", true, "AI is down, back soon.")])).toBe("AI is down, back soon.");
  });

  it("prefers the maintenance message when both are on", () => {
    expect(newSessionBlock([row("sessions_paused", true, "paused"), row("maintenance", true)])).toBe(MAINTENANCE_SESSION_MESSAGE);
  });

  it("ignores unrelated or malformed settings", () => {
    expect(newSessionBlock([{ key: "maintenance", value: null }, { key: "other", value: { enabled: true } }])).toBeNull();
  });
});
