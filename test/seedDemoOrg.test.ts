import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { OpenFgaClient } from "@openfga/sdk";
import { checkRelation } from "../src/server/authz/fgaClient";
import { listAllUsers } from "../src/server/users";
import { seedDemoOrg, DEMO_TEAMS } from "../src/server/authz/seedDemoOrg";

/**
 * T-25 (demo roster): verifies seedDemoOrg() end to end against a REAL OpenFGA instance (Docker),
 * same pattern as tupleRouteIntegration.test.ts — spins up its own container/store/model so it
 * doesn't collide with that file's. Skips (not fails) when Docker isn't reachable.
 */

const CONTAINER_NAME = "ai-dev-guardian-openfga-test-seed";
const API_PORT = 8083;
const API_URL = `http://localhost:${API_PORT}`;

function dockerAvailable(): boolean {
  try {
    execFileSync("docker", ["info"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const HAS_DOCKER = dockerAvailable();

describe.skipIf(!HAS_DOCKER)("seedDemoOrg() — 4 team kỹ thuật + 16 người, verify qua OpenFGA thật", () => {
  let tmpDir: string;
  let originalCwd: string;
  let originalEnv: Record<string, string | undefined>;

  beforeAll(async () => {
    try {
      execFileSync("docker", ["rm", "-f", CONTAINER_NAME], { stdio: "ignore" });
    } catch {
      // no stale container — fine
    }
    execFileSync("docker", ["run", "-d", "--name", CONTAINER_NAME, "-p", `${API_PORT}:8080`, "openfga/openfga", "run"]);

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
    const store = await bootstrap.createStore({ name: "seed-demo-org-test" });
    const storeId = store.id;
    const modelJson = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "authz", "model.json"), "utf-8"));
    const withStore = new OpenFgaClient({ apiUrl: API_URL, storeId });
    const model = await withStore.writeAuthorizationModel(modelJson);

    originalEnv = {
      FGA_API_URL: process.env.FGA_API_URL,
      FGA_STORE_ID: process.env.FGA_STORE_ID,
      FGA_MODEL_ID: process.env.FGA_MODEL_ID,
    };
    process.env.FGA_API_URL = API_URL;
    process.env.FGA_STORE_ID = storeId;
    process.env.FGA_MODEL_ID = model.authorization_model_id;

    originalCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "guardian-seed-demo-org-"));
    fs.mkdirSync(path.join(tmpDir, ".guardian"), { recursive: true });
    process.chdir(tmpDir);
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

  it("tạo đúng 4 team + 16 user + 20 tuple (4 org-link + 16 role→team)", async () => {
    const result = await seedDemoOrg();
    expect(result).toEqual({ teamCount: 4, userCount: 16, tupleCount: 20 });
    expect(listAllUsers()).toHaveLength(5 + 16); // 5 seed gốc + 16 mới
  });

  it("chạy lại lần 2 — idempotent, không tạo trùng user/tuple", async () => {
    const result = await seedDemoOrg();
    expect(result).toEqual({ teamCount: 4, userCount: 16, tupleCount: 20 });
    expect(listAllUsers()).toHaveLength(5 + 16);
  });

  it("admin Team Backend có quan hệ admin thật trên team:team-backend", async () => {
    const backendAdmin = listAllUsers().find((u) => u.email === "admin@backend.guardian.dev");
    expect(backendAdmin).toBeTruthy();
    const allowed = await checkRelation(backendAdmin!.id, "admin", "team:team-backend");
    expect(allowed).toBe(true);
  });

  it("ranh giới cross-team thật: admin Team Backend KHÔNG có quan hệ admin trên team:team-mobile", async () => {
    const backendAdmin = listAllUsers().find((u) => u.email === "admin@backend.guardian.dev");
    const allowed = await checkRelation(backendAdmin!.id, "admin", "team:team-mobile");
    expect(allowed).toBe(false);
  });

  it("mọi team trong DEMO_TEAMS đều có mặt trong danh sách user vừa tạo", () => {
    const users = listAllUsers();
    for (const team of DEMO_TEAMS) {
      const members = users.filter((u) => u.teamId === team.id);
      expect(members).toHaveLength(4);
    }
  });
});
