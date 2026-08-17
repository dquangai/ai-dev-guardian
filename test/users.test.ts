import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { checkPassword, findUserByEmail, findUserByRole, findUserById, listAllUsers, setUserTeam, SEED_USER_IDS } from "../src/server/users";

/** userStore.ts persists to .guardian/users.json under process.cwd() (see store/userStore.ts) —
 * runs against a throwaway tmp dir so this never touches the real repo's runtime state, same
 * isolation as authRouter.test.ts / rbacIntegration.test.ts. */
let tmpDir: string;
let originalCwd: string;

beforeAll(() => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "guardian-users-"));
  fs.mkdirSync(path.join(tmpDir, ".guardian"), { recursive: true });
  process.chdir(tmpDir);
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("findUserByEmail", () => {
  it("finds a seeded demo user case-insensitively", () => {
    expect(findUserByEmail("Admin@Guardian.dev")?.role).toBe("admin");
  });

  it("returns null for an unknown email", () => {
    expect(findUserByEmail("nobody@guardian.dev")).toBeNull();
  });
});

describe("listAllUsers", () => {
  it("seeds đúng 5 tài khoản gốc khi store rỗng", () => {
    expect(listAllUsers()).toHaveLength(5);
  });
});

describe("findUserByRole", () => {
  it("chỉ trả về user cho super-admin — role team-scoped không còn 1-1 nên trả null", () => {
    expect(findUserByRole("super-admin")?.email).toBe("super.admin@guardian.dev");
    expect(findUserByRole("auditor")).toBeNull();
    expect(findUserByRole("developer")).toBeNull();
  });

  it("returns null for an invalid/unknown role", () => {
    expect(findUserByRole("superadmin")).toBeNull();
    expect(findUserByRole(undefined)).toBeNull();
  });
});

describe("setUserTeam (T-23, giờ theo user id thay vì role)", () => {
  const developerId = SEED_USER_IDS.developer;
  const original = findUserById(developerId)?.teamId;

  afterEach(() => {
    setUserTeam(developerId, original);
  });

  it("đổi teamId của user theo id, phản ánh ngay qua findUserById", () => {
    setUserTeam(developerId, "team-eng");
    expect(findUserById(developerId)?.teamId).toBe("team-eng");
  });

  it("có thể xoá khỏi team (teamId thành undefined)", () => {
    setUserTeam(developerId, undefined);
    expect(findUserById(developerId)?.teamId).toBeUndefined();
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
