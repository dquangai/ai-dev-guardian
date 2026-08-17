import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/server/app";
import { signToken } from "../src/server/token";
import { findUserById, SEED_USER_IDS } from "../src/server/users";
import type { Role } from "../src/server/rbac";

/** T-24: /api/auth/act-as-team — lets Super Admin reissue their own token with a chosen team
 * context (or none). Integration style (real app + supertest), same pattern as teamsRouter.test.ts. */

let tmpDir: string;
let originalCwd: string;

beforeAll(() => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "guardian-auth-router-"));
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

describe("POST /api/auth/demo-login and /login (T-24 regression)", () => {
  it("demo-login trả về teamId đúng của role team-scoped", async () => {
    const res = await request(app).post("/api/auth/demo-login").send({ role: "developer" });
    expect(res.status).toBe(200);
    expect(res.body.user.teamId).toBe(findUserById(SEED_USER_IDS.developer)?.teamId);
  });

  it("demo-login super-admin trả về teamId undefined (org-wide)", async () => {
    const res = await request(app).post("/api/auth/demo-login").send({ role: "super-admin" });
    expect(res.status).toBe(200);
    expect(res.body.user.teamId).toBeUndefined();
  });
});

describe("POST /api/auth/act-as-team (T-24)", () => {
  it("401 không có token", async () => {
    const res = await request(app).post("/api/auth/act-as-team").send({ teamId: "team-default" });
    expect(res.status).toBe(401);
  });

  it("403 với role không phải super-admin", async () => {
    const res = await request(app)
      .post("/api/auth/act-as-team")
      .set("Authorization", authHeader("admin"))
      .send({ teamId: "team-default" });
    expect(res.status).toBe(403);
  });

  it("teamId không tồn tại -> 404", async () => {
    const res = await request(app)
      .post("/api/auth/act-as-team")
      .set("Authorization", authHeader("super-admin"))
      .send({ teamId: "no-such-team" });
    expect(res.status).toBe(404);
  });

  it("teamId sai định dạng -> 400", async () => {
    const res = await request(app)
      .post("/api/auth/act-as-team")
      .set("Authorization", authHeader("super-admin"))
      .send({ teamId: "../evil" });
    expect(res.status).toBe(400);
  });

  it("super-admin chọn team hợp lệ -> token mới mang đúng teamId, /me phản ánh đúng", async () => {
    await request(app)
      .post("/api/teams")
      .set("Authorization", authHeader("super-admin"))
      .send({ id: "team-act-as", name: "Act As Team" });

    const actAs = await request(app)
      .post("/api/auth/act-as-team")
      .set("Authorization", authHeader("super-admin"))
      .send({ teamId: "team-act-as" });
    expect(actAs.status).toBe(200);
    expect(actAs.body.user.teamId).toBe("team-act-as");

    const me = await request(app).get("/api/me").set("Authorization", `Bearer ${actAs.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.teamId).toBe("team-act-as");
    expect(me.body.role).toBe("super-admin");
  });

  it("bỏ trống teamId -> quay về org-wide (teamId undefined)", async () => {
    const res = await request(app)
      .post("/api/auth/act-as-team")
      .set("Authorization", authHeader("super-admin"))
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.user.teamId).toBeUndefined();

    const me = await request(app).get("/api/me").set("Authorization", `Bearer ${res.body.token}`);
    expect(me.body.teamId).toBeUndefined();
  });
});
