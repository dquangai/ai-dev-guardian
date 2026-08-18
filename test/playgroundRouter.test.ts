import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import type { Role } from "../src/server/rbac";
import type { CheckReport } from "../src/report/types";

const CANNED_REPORT: CheckReport = {
  verdict: "BLOCK",
  violations: [
    {
      errorWhat: "canned violation for test",
      policyViolated: "security.policy.md",
      riskLevel: "critical",
      why: "why",
      howToFix: "fix",
      location: "sso/session.go",
      promptToFix: "prompt",
      source: "llm-policy-check",
    },
  ],
};

const runGuardianCheck = vi.fn().mockResolvedValue(CANNED_REPORT);
vi.mock("../src/orchestrator", () => ({ runGuardianCheck: (...args: unknown[]) => runGuardianCheck(...args) }));

const recordAudit = vi.fn();
vi.mock("../src/server/store/auditStore", () => ({
  recordAudit: (...args: unknown[]) => recordAudit(...args),
  listAuditHistory: vi.fn().mockReturnValue([]),
}));

import { createApp } from "../src/server/app";
import { signToken } from "../src/server/token";
import { findUserById, SEED_USER_IDS } from "../src/server/users";

/** Mirrors test/teamsRouter.test.ts's style: real Express app, real signed tokens, throwaway
 * .guardian/ so nothing touches the real repo — runGuardianCheck is mocked (see above) so this
 * only exercises the route's own wiring/gating/sandbox guarantee, not the orchestrator itself
 * (already covered by its own test suite), and never needs a real LLM API key. */
let tmpDir: string;
let originalCwd: string;

beforeAll(() => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "guardian-playground-router-"));
  fs.mkdirSync(path.join(tmpDir, ".guardian"), { recursive: true });
  process.chdir(tmpDir);
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const app = createApp();

function authHeader(role: Role): string {
  const user = findUserById(SEED_USER_IDS[role])!;
  return `Bearer ${signToken(
    { sub: user.id, role: user.role, name: user.name, email: user.email, teamId: user.teamId },
    false
  )}`;
}

describe("POST /api/playground/run", () => {
  it("401 khi không có token", async () => {
    const res = await request(app).post("/api/playground/run").send({ scenario: "jwt" });
    expect(res.status).toBe(401);
  });

  it("403 với role developer (không có playground:run)", async () => {
    const res = await request(app)
      .post("/api/playground/run")
      .set("Authorization", authHeader("developer"))
      .send({ scenario: "jwt" });
    expect(res.status).toBe(403);
  });

  it("403 với role auditor (không có playground:run)", async () => {
    const res = await request(app)
      .post("/api/playground/run")
      .set("Authorization", authHeader("auditor"))
      .send({ scenario: "jwt" });
    expect(res.status).toBe(403);
  });

  it("400 khi scenario không hợp lệ", async () => {
    const res = await request(app)
      .post("/api/playground/run")
      .set("Authorization", authHeader("admin"))
      .send({ scenario: "not-a-real-scenario" });
    expect(res.status).toBe(400);
    expect(runGuardianCheck).not.toHaveBeenCalled();
  });

  it("200 với admin, scenario=jwt -> diffText chứa đúng file sso/session.go", async () => {
    runGuardianCheck.mockClear();
    const res = await request(app)
      .post("/api/playground/run")
      .set("Authorization", authHeader("admin"))
      .send({ scenario: "jwt" });

    expect(res.status).toBe(200);
    expect(res.body.verdict).toBe("BLOCK");
    expect(res.body.violations).toHaveLength(1);
    expect(res.body.changedFiles).toEqual(["sso/session.go"]);

    expect(runGuardianCheck).toHaveBeenCalledTimes(1);
    const diffArg = runGuardianCheck.mock.calls[0][0];
    expect(diffArg.changedFiles).toEqual(["sso/session.go"]);
    expect(diffArg.diffText).toContain("sso/session.go");
    expect(diffArg.diffText).toContain("ParseUnverified");
  });

  it("200 với senior-dev, scenario=redirect -> diffText chứa đúng file pages/SsoCallbackPage.tsx", async () => {
    runGuardianCheck.mockClear();
    const res = await request(app)
      .post("/api/playground/run")
      .set("Authorization", authHeader("senior-dev"))
      .send({ scenario: "redirect" });

    expect(res.status).toBe(200);
    const diffArg = runGuardianCheck.mock.calls[0][0];
    expect(diffArg.changedFiles).toEqual(["pages/SsoCallbackPage.tsx"]);
    expect(diffArg.diffText).toContain("returnUrl.includes");
  });

  it("200 với admin, scenario=importRules -> diffText chứa đúng file webhooks/partnerWebhook.ts", async () => {
    runGuardianCheck.mockClear();
    const res = await request(app)
      .post("/api/playground/run")
      .set("Authorization", authHeader("admin"))
      .send({ scenario: "importRules" });

    expect(res.status).toBe(200);
    const diffArg = runGuardianCheck.mock.calls[0][0];
    expect(diffArg.changedFiles).toEqual(["webhooks/partnerWebhook.ts"]);
    expect(diffArg.diffText).toContain("jsonwebtoken");
  });

  it("200 với admin, scenario=decodeDisplay -> diffText chứa đúng file ui/sessionExpiryBadge.ts", async () => {
    runGuardianCheck.mockClear();
    const res = await request(app)
      .post("/api/playground/run")
      .set("Authorization", authHeader("admin"))
      .send({ scenario: "decodeDisplay" });

    expect(res.status).toBe(200);
    const diffArg = runGuardianCheck.mock.calls[0][0];
    expect(diffArg.changedFiles).toEqual(["ui/sessionExpiryBadge.ts"]);
    expect(diffArg.diffText).toContain("decodeTokenUnsafe");
  });

  it("200 với admin, scenario=noAuditLogOnRevoke -> diffText chứa đúng file sso/revokeHandler.go", async () => {
    runGuardianCheck.mockClear();
    const res = await request(app)
      .post("/api/playground/run")
      .set("Authorization", authHeader("admin"))
      .send({ scenario: "noAuditLogOnRevoke" });

    expect(res.status).toBe(200);
    const diffArg = runGuardianCheck.mock.calls[0][0];
    expect(diffArg.changedFiles).toEqual(["sso/revokeHandler.go"]);
    expect(diffArg.diffText).toContain("RevokeToken");
  });

  it("KHÔNG bao giờ gọi recordAudit — sandbox, không ghi Audit History thật", async () => {
    recordAudit.mockClear();
    await request(app)
      .post("/api/playground/run")
      .set("Authorization", authHeader("admin"))
      .send({ scenario: "jwt" });

    expect(recordAudit).not.toHaveBeenCalled();
  });
});
