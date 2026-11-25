import { describe, expect, it } from "vitest";
import { aalFromJwt, sessionIdFromJwt } from "@/lib/admin/access";
import { adminSigninAlert, clientIp, factorAddedAlert } from "@/lib/admin/mfa-alert-text";

const jwt = (claims: object) => `x.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.y`;
const req = { ip: "1.2.3.4", userAgent: "Firefox" };

describe("jwt claims", () => {
  it("reads session_id and aal", () => {
    const t = jwt({ aal: "aal2", session_id: "abc" });
    expect(sessionIdFromJwt(t)).toBe("abc");
    expect(aalFromJwt(t)).toBe("aal2");
  });
  it("returns null for missing or broken tokens", () => {
    expect(sessionIdFromJwt(null)).toBeNull();
    expect(sessionIdFromJwt("nope")).toBeNull();
    expect(sessionIdFromJwt(jwt({ session_id: 5 }))).toBeNull();
  });
});

describe("clientIp", () => {
  it("takes the first forwarded address", () => expect(clientIp("9.9.9.9, 10.0.0.1", null)).toBe("9.9.9.9"));
  it("falls back to x-real-ip, then null", () => {
    expect(clientIp(null, "8.8.8.8")).toBe("8.8.8.8");
    expect(clientIp("", null)).toBeNull();
  });
});

describe("alert text", () => {
  it("describes an admin sign-in", () => {
    const a = adminSigninAlert({ email: "a@b.co", access: "admin", at: new Date("2026-11-25T10:42:00Z"), request: req, auditUrl: "/admin/audit" });
    expect(a.subject).toBe("Admin sign-in: a@b.co");
    expect(a.text).toContain("2026-11-25 10:42 UTC");
    expect(a.text).toContain("IP: 1.2.3.4");
  });
  it("describes a new authenticator", () => {
    const a = factorAddedAlert({ email: "a@b.co", factorName: "LMS admin", createdAt: "2026-11-25T10:40:00Z", request: { ip: null, userAgent: null } });
    expect(a.subject).toBe("New authenticator for admin a@b.co");
    expect(a.text).toContain("Name: LMS admin");
    expect(a.text).toContain("IP: unknown");
  });
});
