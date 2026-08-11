/**
 * One-command demo environment bootstrap — starts (or reuses) a local OpenFGA via Docker, writes
 * the authorization model, runs the real team-default migration, then prints the exact env vars
 * to start the app server with GUARDIAN_AUTHZ_MODE=fga.
 *
 * Deliberately does NOT depend on the `fga` CLI (not always installed) — the model is loaded from
 * authz/model.json (generated once via `fga model transform`, see authz/README.md's T-25 section)
 * and written through @openfga/sdk directly, same technique as test/tupleRouteIntegration.test.ts.
 *
 * Usage: npx tsx authz/demo-up.ts
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { OpenFgaClient } from "@openfga/sdk";

const CONTAINER_NAME = "ai-dev-guardian-openfga";
const API_PORT = 8080;
const API_URL = `http://localhost:${API_PORT}`;

function containerRunning(): boolean {
  try {
    const out = execFileSync("docker", ["ps", "--filter", `name=^${CONTAINER_NAME}$`, "--format", "{{.Names}}"])
      .toString()
      .trim();
    return out === CONTAINER_NAME;
  } catch {
    return false;
  }
}

async function waitHealthy(deadlineMs: number): Promise<void> {
  const deadline = Date.now() + deadlineMs;
  for (; ;) {
    try {
      const res = await fetch(`${API_URL}/healthz`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    if (Date.now() > deadline) throw new Error("OpenFGA không sẵn sàng sau thời gian chờ.");
    await new Promise((r) => setTimeout(r, 500));
  }
}

async function main() {
  if (containerRunning()) {
    console.log(`==> Container "${CONTAINER_NAME}" đã chạy sẵn, dùng lại.`);
  } else {
    console.log("==> Khởi động OpenFGA (Docker)...");
    try {
      execFileSync("docker", ["rm", "-f", CONTAINER_NAME], { stdio: "ignore" });
    } catch {
      // no stale container — fine
    }
    execFileSync("docker", ["run", "-d", "--name", CONTAINER_NAME, "-p", `${API_PORT}:8080`, "openfga/openfga", "run"]);
  }

  console.log("==> Chờ OpenFGA sẵn sàng...");
  await waitHealthy(30_000);

  console.log("==> Tạo store + ghi Authorization Model...");
  const bootstrap = new OpenFgaClient({ apiUrl: API_URL });
  const store = await bootstrap.createStore({ name: `demo-${Date.now()}` });
  const storeId = store.id;

  const modelJson = JSON.parse(fs.readFileSync(path.join(__dirname, "model.json"), "utf-8"));
  const withStore = new OpenFgaClient({ apiUrl: API_URL, storeId });
  const model = await withStore.writeAuthorizationModel(modelJson);
  const modelId = model.authorization_model_id;

  process.env.FGA_API_URL = API_URL;
  process.env.FGA_STORE_ID = storeId;
  process.env.FGA_MODEL_ID = modelId;

  console.log("==> Chạy migration thật (team-default + 4 demo user + policy hiện có)...");
  const { migrateTeamDefault } = await import("../src/server/authz/migrateTeamDefault");
  const { team, tupleCount } = await migrateTeamDefault();
  console.log(`    Team "${team?.id}" sẵn sàng, ${tupleCount} tuple đã ghi.`);

  console.log("\n Môi trường demo đã sẵn sàng. Dừng server hiện tại (nếu có), rồi chạy đúng lệnh sau:\n");
  console.log(
    `FGA_API_URL=${API_URL} FGA_STORE_ID=${storeId} FGA_MODEL_ID=${modelId} GUARDIAN_AUTHZ_MODE=fga GUARDIAN_DEMO_PASSWORD=demo1234 npx tsx src/server/index.ts\n`
  );
  console.log("Lưu ý: đừng restart server giữa lúc demo — mọi thao tác gán/xoá team trong lúc đó chỉ lưu trong bộ nhớ, restart sẽ mất.");
}

main().catch((error) => {
  console.error("Lỗi:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
