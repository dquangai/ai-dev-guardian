import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/server/app";
import { signToken } from "../src/server/token";
import { DEMO_USERS } from "../src/server/users";
import { ROLES, hasPermission, type Permission, type Role } from "../src/server/rbac";

/** T-11: route-level RBAC integration tests — hit the *real* Express app (real requireAuth +
 * requirePermission middleware) with real signed tokens per role, instead of unit-testing route
 * handlers in isolation with permission already assumed to have passed (as the rest of this repo's
 * route tests do). Runs against a throwaway .guardian/ so it never touches the real repo's policy
 * files or request logs. */

let tmpDir: string;
let originalCwd: string;

beforeAll(() => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "guardian-rbac-integration-"));
  fs.mkdirSync(path.join(tmpDir, ".guardian", "policies"), { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, ".guardian", "policies", "test.policy.md"),
    "---\ncategory: Test\nseverity: low\n---\n\nOriginal body\n"
  );
  process.chdir(tmpDir);
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const app = createApp();

function authHeader(role: Role): string {
  const user = DEMO_USERS[role];
  return `Bearer ${signToken({ sub: user.id, role: user.role, name: user.name, email: user.email }, false)}`;
}

interface RouteCase {
  method: "get" | "post" | "put" | "delete";
  path: string;
  permission: Permission;
}

const ROUTES: RouteCase[] = [
  { method: "get", path: "/api/policies", permission: "policy:view" },
  { method: "get", path: "/api/policies/requests", permission: "policy:view" },
  { method: "get", path: "/api/notifications/policies", permission: "policy:view" },
  { method: "get", path: "/api/audit/history", permission: "audit:view" },
  { method: "get", path: "/api/audit/cache", permission: "audit:view" },
  { method: "get", path: "/api/bypass-requests", permission: "audit:view" },
  { method: "get", path: "/api/system/diagnostics", permission: "audit:view" },
  { method: "post", path: "/api/audit/run", permission: "audit:run" },
  { method: "delete", path: "/api/audit/cache", permission: "cache:manage" },
  { method: "get", path: "/api/engine-config", permission: "engine-config:view" },
  { method: "put", path: "/api/engine-config", permission: "engine-config:edit" },
];

describe("RBAC route-level integration (T-11)", () => {
  it("401s a protected route with no Authorization header", async () => {
    const res = await request(app).get("/api/policies");
    expect(res.status).toBe(401);
  });

  it("401s a protected route with a garbage token", async () => {
    const res = await request(app).get("/api/policies").set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });

  describe.each(ROUTES)("$method $path (permission: $permission)", ({ method, path: routePath, permission }) => {
    for (const role of ROLES) {
      const allowed = hasPermission(role, permission);
      it(`role=${role} → ${allowed ? "KHÔNG bị 403 (có quyền)" : "403 (không có quyền)"}`, async () => {
        const res = await request(app)[method](routePath).set("Authorization", authHeader(role));
        if (allowed) {
          expect(res.status).not.toBe(403);
        } else {
          expect(res.status).toBe(403);
        }
      });
    }
  });
});

describe("RBAC integration: bypass approve/reject (T-11)", () => {
  let bypassId: string;

  it("developer (bypass:request) tạo được bypass request", async () => {
    const res = await request(app)
      .post("/api/bypass-requests")
      .set("Authorization", authHeader("developer"))
      .send({ reason: "need to bypass for a hotfix" });
    expect(res.status).toBe(201);
    bypassId = res.body.id;
    expect(bypassId).toBeTruthy();
  });

  it("developer tự gọi approve bị 403 (không có bypass:approve)", async () => {
    const res = await request(app)
      .post(`/api/bypass-requests/${bypassId}/approve`)
      .set("Authorization", authHeader("developer"))
      .send({});
    expect(res.status).toBe(403);
  });

  it("auditor gọi approve cũng bị 403 (auditor read-only, không có bypass:approve)", async () => {
    const res = await request(app)
      .post(`/api/bypass-requests/${bypassId}/approve`)
      .set("Authorization", authHeader("auditor"))
      .send({});
    expect(res.status).toBe(403);
  });

  it("senior-dev (bypass:approve) approve thành công request thật", async () => {
    const res = await request(app)
      .post(`/api/bypass-requests/${bypassId}/approve`)
      .set("Authorization", authHeader("senior-dev"))
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("approved");
  });
});

describe("RBAC integration: policy approve/reject via change request (T-11)", () => {
  let requestId: string;

  it("senior-dev (policy:propose, không có edit-direct) sửa policy → tạo change request chờ duyệt", async () => {
    const res = await request(app)
      .put("/api/policies/test.policy.md")
      .set("Authorization", authHeader("senior-dev"))
      .send({ content: "---\ncategory: Test\nseverity: low\n---\n\nProposed by senior-dev\n" });
    expect(res.status).toBe(202);
    expect(res.body.status).toBe("pending-approval");
    requestId = res.body.request.id;
    expect(requestId).toBeTruthy();
  });

  it("developer tự gọi approve change request bị 403", async () => {
    const res = await request(app)
      .post(`/api/policies/requests/${requestId}/approve`)
      .set("Authorization", authHeader("developer"))
      .send({});
    expect(res.status).toBe(403);
  });

  it("auditor gọi approve change request cũng bị 403", async () => {
    const res = await request(app)
      .post(`/api/policies/requests/${requestId}/approve`)
      .set("Authorization", authHeader("auditor"))
      .send({});
    expect(res.status).toBe(403);
  });

  it("admin (policy:approve) approve thành công request thật", async () => {
    const res = await request(app)
      .post(`/api/policies/requests/${requestId}/approve`)
      .set("Authorization", authHeader("admin"))
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("approved");
  });
});

describe("RBAC integration: policy direct-edit theo role (T-11)", () => {
  const content = "---\ncategory: Test\nseverity: low\n---\n\nDirect edit body\n";

  it("admin (policy:edit-direct) sửa trực tiếp — áp dụng ngay, không cần duyệt", async () => {
    const res = await request(app)
      .put("/api/policies/test.policy.md")
      .set("Authorization", authHeader("admin"))
      .send({ content });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("applied");
  });

  it("developer (không có edit-direct lẫn propose) bị 403 khi sửa policy", async () => {
    const res = await request(app)
      .put("/api/policies/test.policy.md")
      .set("Authorization", authHeader("developer"))
      .send({ content });
    expect(res.status).toBe(403);
  });

  it("auditor (read-only) bị 403 khi sửa policy", async () => {
    const res = await request(app)
      .put("/api/policies/test.policy.md")
      .set("Authorization", authHeader("auditor"))
      .send({ content });
    expect(res.status).toBe(403);
  });
});
