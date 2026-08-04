import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { checkPassword, findUserByEmail, findUserByRole } from "../src/server/users";

describe("findUserByEmail", () => {
  it("finds a demo user case-insensitively", () => {
    expect(findUserByEmail("Admin@Guardian.dev")?.role).toBe("admin");
  });

  it("returns null for an unknown email", () => {
    expect(findUserByEmail("nobody@guardian.dev")).toBeNull();
  });
});

describe("findUserByRole", () => {
  it("returns the demo user for a valid role", () => {
    expect(findUserByRole("auditor")?.email).toBe("auditor@guardian.dev");
  });

  it("returns null for an invalid/unknown role", () => {
    expect(findUserByRole("superadmin")).toBeNull();
    expect(findUserByRole(undefined)).toBeNull();
  });
});

describe("checkPassword", () => {
  const ORIGINAL = process.env.GUARDIAN_DEMO_PASSWORD;

  beforeEach(() => {
    process.env.GUARDIAN_DEMO_PASSWORD = "demo-secret-123";
  });

  afterEach(() => {
    process.env.GUARDIAN_DEMO_PASSWORD = ORIGINAL;
  });

  it("accepts the configured password", () => {
    expect(checkPassword("demo-secret-123")).toBe(true);
  });

  it("rejects a wrong password", () => {
    expect(checkPassword("wrong")).toBe(false);
  });

  it("rejects everything when no password is configured", () => {
    delete process.env.GUARDIAN_DEMO_PASSWORD;
    expect(checkPassword("")).toBe(false);
    expect(checkPassword("demo-secret-123")).toBe(false);
  });
});
