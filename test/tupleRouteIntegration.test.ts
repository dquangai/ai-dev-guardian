import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { OpenFgaClient } from "@openfga/sdk";
import { writeTuples } from "../src/server/authz/fgaClient";
import { signToken } from "../src/server/token";
import type { Role } from "../src/server/rbac";
import type { Express } from "express";

/**
 * T-25: route-level tests driven by REAL OpenFGA relationship tuples against a REAL OpenFGA
 * instance (Docker) — not JWT role strings. This is the piece rbacIntegration.test.ts (T-11)
 * structurally cannot cover: multi-hop inheritance (Super Admin -> org -> team `admin`) and
 * team-scoped cross-team isolation, both of which only exist once GUARDIAN_AUTHZ_MODE=fga is on.
 *
 * rbac.ts / rbacIntegration.test.ts are kept exactly as-is (not deleted) — GUARDIAN_AUTHZ_MODE
 * unset is still the shipped npm package's default (no bundled/required OpenFGA), so the old flat
 * RBAC path remains real production behavior, not legacy code to retire. This file is additive.
 *
 * Requires Docker. Skips (not fails) the whole suite when Docker isn't reachable, so `npm test`/CI
 * stays green on machines without it — see authz/README.md's T-25 section for how to run this file.
 */

const CONTAINER_NAME = "ai-dev-guardian-openfga-test";
const API_PORT = 8082;
const API_URL = `http://localhost:${API_PORT}`;
const ORG_ID = "vsf-test";
const TEAM_A = "team-alpha";
const TEAM_B = "team-beta";

function dockerAvailable(): boolean {
  try {
    execFileSync("docker", ["info"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const HAS_DOCKER = dockerAvailable();

describe.skipIf(!HAS_DOCKER)("T-25: route-level authorization qua tuple OpenFGA thật", () => {
  let tmpDir: string;
  let originalCwd: string;
  let originalEnv: Record<string, string | undefined>;
  let app: Express;
  let auditRecordAlphaId: string;
  let bypassRequestAlphaId: string;

  function authHeader(sub: string, role: Role, teamId?: string): string {
    return `Bearer ${signToken({ sub, role, name: sub, email: `${sub}@test.dev`, teamId }, false)}`;
  }

  beforeAll(async () => {
    try {
      execFileSync("docker", ["rm", "-f", CONTAINER_NAME], { stdio: "ignore" });
    } catch {
      // no stale container — fine
    }
    execFileSync("docker", [
      "run",
      "-d",
      "--name",
      CONTAINER_NAME,
      "-p",
      `${API_PORT}:8080`,
      "openfga/openfga",
      "run",
    ]);

    const deadline = Date.now() + 30_000;
    for (;;) {
      try {
        const res = await fetch(`${API_URL}/healthz`);
        if (res.ok) break;
      } catch {
        // not up yet
      }
      if (Date.now() > deadline) throw new Error("OpenFGA container did not become healthy in time.");
      await new Promise((r) => setTimeout(r, 500));
    }

    const bootstrap = new OpenFgaClient({ apiUrl: API_URL });
    const store = await bootstrap.createStore({ name: "t25-tuple-route-integration" });
    const storeId = store.id;

    const modelJson = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "authz", "model.json"), "utf-8"));
    const withStore = new OpenFgaClient({ apiUrl: API_URL, storeId });
    const model = await withStore.writeAuthorizationModel(modelJson);

    originalEnv = {
      FGA_API_URL: process.env.FGA_API_URL,
      FGA_STORE_ID: process.env.FGA_STORE_ID,
      FGA_MODEL_ID: process.env.FGA_MODEL_ID,
      GUARDIAN_AUTHZ_MODE: process.env.GUARDIAN_AUTHZ_MODE,
    };
    process.env.FGA_API_URL = API_URL;
    process.env.FGA_STORE_ID = storeId;
    process.env.FGA_MODEL_ID = model.authorization_model_id;
    process.env.GUARDIAN_AUTHZ_MODE = "fga";

    originalCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "guardian-tuple-route-"));
    fs.mkdirSync(path.join(tmpDir, ".guardian", "policies"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, ".guardian", "policies", "alpha.policy.md"),
      "---\ncategory: Test\nseverity: low\n---\n\nAlpha policy body\n"
    );
    fs.writeFileSync(
      path.join(tmpDir, ".guardian", "policies", "beta.policy.md"),
      "---\ncategory: Test\nseverity: low\n---\n\nBeta policy body\n"
    );
    process.chdir(tmpDir);

    // audit:run calls getStagedDiff() -> real `git diff --cached`, which needs an actual repo
    // with at least one commit (otherwise HEAD doesn't exist yet and the diff call throws).
    execFileSync("git", ["init", "-q"]);
    execFileSync("git", ["-c", "user.email=test@test.dev", "-c", "user.name=Test", "commit", "--allow-empty", "-q", "-m", "init"]);

    // CRITICAL ORDERING: authzGate()/listRouteGate() read GUARDIAN_AUTHZ_MODE once, at router
    // REGISTRATION time (see authzGate.ts's own doc comment) — not per-request. A static top-level
    // `import { createApp } from "../src/server/app"` would load every route module (and lock in
    // the flag) before this beforeAll ever runs, silently testing old RBAC instead of OpenFGA.
    // A dynamic import here, after the env var is set, defers loading the whole route module graph
    // until the flag is already correct.
    const { createApp } = await import("../src/server/app");
    app = createApp();

    // Seed real relationship data — no role strings, only tuples. Two isolated teams under the
    // same org, and a Super Admin who is NEVER directly granted anything on either team.
    await writeTuples([
      { user: `organization:${ORG_ID}`, relation: "org", object: `team:${TEAM_A}` },
      { user: `organization:${ORG_ID}`, relation: "org", object: `team:${TEAM_B}` },
      { user: "user:super-admin-x", relation: "super_admin", object: `organization:${ORG_ID}` },
      { user: "user:admin-alpha", relation: "admin", object: `team:${TEAM_A}` },
      { user: "user:seniordev-alpha", relation: "senior_dev", object: `team:${TEAM_A}` },
      { user: "user:dev-alpha", relation: "developer", object: `team:${TEAM_A}` },
      { user: "user:dev-alpha-2", relation: "developer", object: `team:${TEAM_A}` },
      { user: "user:auditor-alpha", relation: "auditor", object: `team:${TEAM_A}` },
      { user: "user:admin-beta", relation: "admin", object: `team:${TEAM_B}` },
      { user: `team:${TEAM_A}`, relation: "team", object: "policy:alpha.policy.md" },
      { user: `team:${TEAM_B}`, relation: "team", object: "policy:beta.policy.md" },
    ]);
  }, 45_000);

  afterAll(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    try {
      execFileSync("docker", ["rm", "-f", CONTAINER_NAME], { stdio: "ignore" });
    } catch {
      // best-effort cleanup
    }
  }, 15_000);

  describe("Super Admin kế thừa quyền admin qua org — chưa từng gán tuple trực tiếp trên team", () => {
    it("GET /api/policies/alpha.policy.md -> 200 (member from team, qua admin kế thừa từ org)", async () => {
      const res = await request(app)
        .get("/api/policies/alpha.policy.md")
        .set("Authorization", authHeader("super-admin-x", "super-admin"));
      expect(res.status).toBe(200);
    });

    it("PUT /api/policies/alpha.policy.md (edit-direct) -> áp dụng thẳng, không cần đề xuất", async () => {
      const res = await request(app)
        .put("/api/policies/alpha.policy.md")
        .set("Authorization", authHeader("super-admin-x", "super-admin"))
        .send({ content: "Updated by super-admin via inherited relation\n" });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("applied");
    });
  });

  describe("Cách ly cross-team", () => {
    it("admin-alpha xem/sửa được policy của chính team-alpha", async () => {
      const res = await request(app)
        .get("/api/policies/alpha.policy.md")
        .set("Authorization", authHeader("admin-alpha", "admin", TEAM_A));
      expect(res.status).toBe(200);
    });

    it("admin-alpha KHÔNG xem được policy của team-beta -> 403", async () => {
      const res = await request(app)
        .get("/api/policies/beta.policy.md")
        .set("Authorization", authHeader("admin-alpha", "admin", TEAM_A));
      expect(res.status).toBe(403);
    });

    it("admin-beta xem được policy của chính team-beta", async () => {
      const res = await request(app)
        .get("/api/policies/beta.policy.md")
        .set("Authorization", authHeader("admin-beta", "admin", TEAM_B));
      expect(res.status).toBe(200);
    });

    it("admin-beta KHÔNG sửa được policy của team-alpha -> 403 (fallback: đề xuất cũng fail, senior_dev mới propose được)", async () => {
      const res = await request(app)
        .put("/api/policies/alpha.policy.md")
        .set("Authorization", authHeader("admin-beta", "admin", TEAM_B))
        .send({ content: "should not apply\n" });
      expect(res.status).toBe(403);
    });
  });

  describe("audit:run — quan hệ developer trên team, không phải role string", () => {
    it("dev-alpha (developer, team-alpha) chạy audit -> 200", async () => {
      const res = await request(app)
        .post("/api/audit/run")
        .set("Authorization", authHeader("dev-alpha", "developer", TEAM_A));
      expect(res.status).toBe(200);
      auditRecordAlphaId = res.body.id;
      expect(auditRecordAlphaId).toBeTruthy();
    });

    it("admin-alpha (admin, không phải developer) chạy audit -> 403", async () => {
      const res = await request(app)
        .post("/api/audit/run")
        .set("Authorization", authHeader("admin-alpha", "admin", TEAM_A));
      expect(res.status).toBe(403);
    });
  });

  describe("T-09 qua tuple owner — dev chỉ xem audit của chính mình, kể cả đồng đội cùng team", () => {
    it("dev-alpha (owner) thấy record của chính mình trong lịch sử", async () => {
      const res = await request(app)
        .get("/api/audit/history")
        .set("Authorization", authHeader("dev-alpha", "developer", TEAM_A));
      expect(res.status).toBe(200);
      expect(res.body.some((r: { id: string }) => r.id === auditRecordAlphaId)).toBe(true);
    });

    it("dev-alpha-2 (developer khác, CÙNG team, KHÔNG phải owner) không thấy record đó", async () => {
      const res = await request(app)
        .get("/api/audit/history")
        .set("Authorization", authHeader("dev-alpha-2", "developer", TEAM_A));
      expect(res.status).toBe(200);
      expect(res.body.some((r: { id: string }) => r.id === auditRecordAlphaId)).toBe(false);
    });

    it("seniordev-alpha (senior_dev, cùng team) thấy được — quyền team-wide, không cần là owner", async () => {
      const res = await request(app)
        .get("/api/audit/history")
        .set("Authorization", authHeader("seniordev-alpha", "senior-dev", TEAM_A));
      expect(res.status).toBe(200);
      expect(res.body.some((r: { id: string }) => r.id === auditRecordAlphaId)).toBe(true);
    });

    it("admin-beta (team khác) không thấy record của team-alpha", async () => {
      const res = await request(app)
        .get("/api/audit/history")
        .set("Authorization", authHeader("admin-beta", "admin", TEAM_B));
      expect(res.status).toBe(200);
      expect(res.body.some((r: { id: string }) => r.id === auditRecordAlphaId)).toBe(false);
    });
  });

  describe("bypass_request — can_approve qua team, cách ly cross-team", () => {
    it("dev-alpha tạo bypass request", async () => {
      const res = await request(app)
        .post("/api/bypass-requests")
        .set("Authorization", authHeader("dev-alpha", "developer", TEAM_A))
        .send({ reason: "T-25 tuple-driven test" });
      expect(res.status).toBe(201);
      bypassRequestAlphaId = res.body.id;
    });

    it("dev-alpha tự approve -> 403 (không có can_approve)", async () => {
      const res = await request(app)
        .post(`/api/bypass-requests/${bypassRequestAlphaId}/approve`)
        .set("Authorization", authHeader("dev-alpha", "developer", TEAM_A))
        .send({});
      expect(res.status).toBe(403);
    });

    it("admin-beta (team khác) approve -> 403 (cách ly cross-team, không liên quan gì object)", async () => {
      const res = await request(app)
        .post(`/api/bypass-requests/${bypassRequestAlphaId}/approve`)
        .set("Authorization", authHeader("admin-beta", "admin", TEAM_B))
        .send({});
      expect(res.status).toBe(403);
    });

    it("seniordev-alpha (cùng team, có can_approve) approve -> 200", async () => {
      const res = await request(app)
        .post(`/api/bypass-requests/${bypassRequestAlphaId}/approve`)
        .set("Authorization", authHeader("seniordev-alpha", "senior-dev", TEAM_A))
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("approved");
    });
  });
});
