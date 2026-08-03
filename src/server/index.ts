import "dotenv/config";
import type { Server } from "node:http";
import { createApp } from "./app";
import { applyEngineConfigToEnv } from "./store/engineConfigStore";

/** Starts the API server (and, if web/dist was built, the dashboard UI on the same port). */
export function startServer(port?: number): Server {
  applyEngineConfigToEnv();
  const resolvedPort = port ?? (Number(process.env.GUARDIAN_SERVER_PORT) || 4000);
  const app = createApp();
  return app.listen(resolvedPort, () => {
    console.log(`[guardian-server] listening on http://localhost:${resolvedPort}`);
  });
}

if (require.main === module) {
  startServer();
}
