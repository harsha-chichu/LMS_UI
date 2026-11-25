import { describe, expect, it } from "vitest";
import { configSchema } from "@/lib/admin/schemas";
import { DEFAULT_WELCOME, parseWelcome, personalize, shouldEmailWelcome, shouldShowWelcome, signupAlert, welcomeTitle } from "@/lib/welcome";

const on = { enabled: true, title: "Hi {name}", body: "Welcome aboard, {name}!", sendEmail: true };

describe("parseWelcome", () => {
  it("falls back to defaults for missing or malformed values", () => {
    expect(parseWelcome(undefined)).toEqual(DEFAULT_WELCOME);
    expect(parseWelcome({ enabled: "yes", body: 3 })).toEqual(DEFAULT_WELCOME);
    expect(parseWelcome(on)).toEqual(on);
  });
});

describe("shouldShowWelcome", () => {
  it("shows only when on, written and unseen", () => {
    expect(shouldShowWelcome(on, null)).toBe(true);
    expect(shouldShowWelcome(on, "2026-01-01T00:00:00Z")).toBe(false);
    expect(shouldShowWelcome({ ...on, enabled: false }, null)).toBe(false);
    expect(shouldShowWelcome({ ...on, body: "   " }, null)).toBe(false);
  });
});

describe("shouldEmailWelcome", () => {
  const ok = { emailConfigured: true, optedOut: false, email: "a@b.co" };
  it("emails when everything lines up", () => expect(shouldEmailWelcome(on, ok)).toBe(true));
  it("respects the email switch, setup and opt-out", () => {
    expect(shouldEmailWelcome({ ...on, sendEmail: false }, ok)).toBe(false);
    expect(shouldEmailWelcome(on, { ...ok, emailConfigured: false })).toBe(false);
    expect(shouldEmailWelcome(on, { ...ok, optedOut: true })).toBe(false);
    expect(shouldEmailWelcome(on, { ...ok, email: undefined })).toBe(false);
    expect(shouldEmailWelcome({ ...on, enabled: false }, ok)).toBe(false);
  });
});

describe("personalize / welcomeTitle", () => {
  it("uses the first name, or 'there'", () => {
    expect(personalize("Hi {name}!", "Alex Smith")).toBe("Hi Alex!");
    expect(personalize("Hi {NAME}!", "")).toBe("Hi there!");
    expect(personalize("Hi {name}!", null)).toBe("Hi there!");
  });
  it("defaults an empty title", () => {
    expect(welcomeTitle({ ...on, title: "  " })).toBe("Welcome!");
  });
});

describe("signupAlert", () => {
  it("names the user and how they signed up", () => {
    const a = signupAlert({ id: "1234567890", name: "Alex", email: "a@b.co", provider: "google", adminUrl: "https://x/admin/users/1" });
    expect(a.subject).toBe("New sign-up: Alex");
    expect(a.text).toContain("Signed up with: Google");
    expect(a.text).toContain("https://x/admin/users/1");
  });
  it("falls back to the email when there's no name", () => {
    expect(signupAlert({ id: "1234567890", name: " ", email: "a@b.co", provider: "email", adminUrl: "/" }).subject).toBe("New sign-up: a@b.co");
  });
});

describe("configSchema welcome", () => {
  it("accepts a draft that is off and empty", () => {
    expect(configSchema.safeParse({ key: "welcome", value: { enabled: false, title: "", body: "", sendEmail: true } }).success).toBe(true);
  });
  it("refuses turning it on without a message", () => {
    expect(configSchema.safeParse({ key: "welcome", value: { enabled: true, title: "", body: "  ", sendEmail: true } }).success).toBe(false);
  });
});
