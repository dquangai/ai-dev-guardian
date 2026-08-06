import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/server/app";
import { signToken } from "../src/server/token";
import { DEMO_USERS } from "../src/server/users";
import type { Role } from "../src/server/rbac";

/** T-23: route-level integration tests for team management — hits the real Express app with real
 * signed tokens, same style as rbacIntegration.test.ts (T-11). Runs against a throwaway .guardian/
 * so it never touches the real repo's teams.json. Tests are intentionally order-dependent within
 * each describe block (create team -> add member -> list -> remove), mirroring how the existing
 * bypass-approval flow in rbacIntegration.test.ts is written. */

let tmpDir: string;
let originalCwd: string;

beforeAll(() => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "guardian-teams-router-"));
  fs.mkdirSync(path.join(tmpDir, ".guardian"), { recursive: true });
  process.chdir(tmpDir);
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

const app = createApp();

function authHeader(role: Role): string {
  const user = DEMO_USERS[role];
  return `Bearer ${signToken(
    { sub: user.id, role: user.role, name: user.name, email: user.email, teamId: user.teamId },
    false
  )}`;
}

describe("Teams router (T-23) — gate: chỉ Super Admin", () => {
  it("401 khi không có token", async () => {
    const res = await request(app).get("/api/teams");
    expect(res.status).toBe(401);
  });

  it("403 với role không phải super-admin (vd admin)", async () => {
    const res = await request(app).get("/api/teams").set("Authorization", authHeader("admin"));
    expect(res.status).toBe(403);
  });

  it("200 với super-admin, trả về teams[] và users[]", async () => {
    const res = await request(app).get("/api/teams").set("Authorization", authHeader("super-admin"));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("teams");
    expect(res.body).toHaveProperty("users");
    expect(res.body.users).toHaveLength(4); // admin, senior-dev, developer, auditor — không gồm super-admin
  });
});

describe("Teams router (T-23) — tạo Team", () => {
  it("super-admin tạo team mới -> 201, members rỗng", async () => {
    const res = await request(app)
      .post("/api/teams")
      .set("Authorization", authHeader("super-admin"))
      .send({ id: "team-eng", name: "Engineering" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: "team-eng", name: "Engineering", members: [] });
  });

  it("tạo trùng id -> 409", async () => {
    const res = await request(app)
      .post("/api/teams")
      .set("Authorization", authHeader("super-admin"))
      .send({ id: "team-eng", name: "Engineering Dup" });
    expect(res.status).toBe(409);
  });

  it("id không hợp lệ (path traversal) -> 400", async () => {
    const res = await request(app)
      .post("/api/teams")
      .set("Authorization", authHeader("super-admin"))
      .send({ id: "../evil", name: "x" });
    expect(res.status).toBe(400);
  });

  it("thiếu name -> 400", async () => {
    const res = await request(app)
      .post("/api/teams")
      .set("Authorization", authHeader("super-admin"))
      .send({ id: "team-no-name" });
    expect(res.status).toBe(400);
  });

  it("non-super-admin không tạo được team -> 403", async () => {
    const res = await request(app)
      .post("/api/teams")
      .set("Authorization", authHeader("senior-dev"))
      .send({ id: "team-blocked", name: "Blocked" });
    expect(res.status).toBe(403);
  });
});

describe("Teams router (T-23) — gán/xoá thành viên", () => {
  it("gán developer-1 vào team-eng -> xuất hiện trong members", async () => {
    const res = await request(app)
      .post("/api/teams/team-eng/members")
      .set("Authorization", authHeader("super-admin"))
      .send({ userId: DEMO_USERS.developer.id });
    expect(res.status).toBe(200);
    expect(res.body.members.map((m: { id: string }) => m.id)).toContain(DEMO_USERS.developer.id);
  });

  it("GET /api/teams phản ánh đúng: developer-1 rời team-default, thuộc team-eng", async () => {
    const res = await request(app).get("/api/teams").set("Authorization", authHeader("super-admin"));
    const engTeam = res.body.teams.find((t: { id: string }) => t.id === "team-eng");
    expect(engTeam.members.map((m: { id: string }) => m.id)).toContain(DEMO_USERS.developer.id);
    const developerEntry = res.body.users.find((u: { id: string }) => u.id === DEMO_USERS.developer.id);
    expect(developerEntry.teamId).toBe("team-eng");
  });

  it("gán user không tồn tại -> 404", async () => {
    const res = await request(app)
      .post("/api/teams/team-eng/members")
      .set("Authorization", authHeader("super-admin"))
      .send({ userId: "no-such-user" });
    expect(res.status).toBe(404);
  });

  it("gán vào team không tồn tại -> 404", async () => {
    const res = await request(app)
      .post("/api/teams/no-such-team/members")
      .set("Authorization", authHeader("super-admin"))
      .send({ userId: DEMO_USERS.developer.id });
    expect(res.status).toBe(404);
  });

  it("gán super-admin vào team -> 400 (org-wide, không thuộc team nào)", async () => {
    const res = await request(app)
      .post("/api/teams/team-eng/members")
      .set("Authorization", authHeader("super-admin"))
      .send({ userId: DEMO_USERS["super-admin"].id });
    expect(res.status).toBe(400);
  });

  it("non-super-admin không gán được thành viên -> 403", async () => {
    const res = await request(app)
      .post("/api/teams/team-eng/members")
      .set("Authorization", authHeader("developer"))
      .send({ userId: DEMO_USERS.developer.id });
    expect(res.status).toBe(403);
  });

  it("xoá developer-1 khỏi team-eng -> không còn trong members", async () => {
    const res = await request(app)
      .delete(`/api/teams/team-eng/members/${DEMO_USERS.developer.id}`)
      .set("Authorization", authHeader("super-admin"));
    expect(res.status).toBe(200);
    expect(res.body.members.map((m: { id: string }) => m.id)).not.toContain(DEMO_USERS.developer.id);
  });

  it("xoá thành viên đã không còn thuộc team -> 404 (không xoá 2 lần)", async () => {
    const res = await request(app)
      .delete(`/api/teams/team-eng/members/${DEMO_USERS.developer.id}`)
      .set("Authorization", authHeader("super-admin"));
    expect(res.status).toBe(404);
  });

  it("non-super-admin không xoá được thành viên -> 403", async () => {
    const res = await request(app)
      .delete(`/api/teams/team-eng/members/${DEMO_USERS.auditor.id}`)
      .set("Authorization", authHeader("auditor"));
    expect(res.status).toBe(403);
  });
});
