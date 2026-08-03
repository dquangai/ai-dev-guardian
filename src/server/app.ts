import fs from "node:fs";
import path from "node:path";
import cors from "cors";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { attachIdentity } from "./authMiddleware";
import { auditRouter } from "./routes/audit";
import { bypassRouter } from "./routes/bypass";
import { dashboardRouter } from "./routes/dashboard";
import { engineConfigRouter } from "./routes/engineConfig";
import { meRouter } from "./routes/me";
import { policiesRouter } from "./routes/policies";
import { systemRouter } from "./routes/system";

export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(attachIdentity);

  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.use("/api/me", meRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/policies", policiesRouter);
  app.use("/api/audit", auditRouter);
  app.use("/api/bypass-requests", bypassRouter);
  app.use("/api/system", systemRouter);
  app.use("/api/engine-config", engineConfigRouter);

  // In dev, the frontend runs on its own Vite dev server (proxying /api here) and
  // web/dist doesn't exist. In a packaged/installed guardian, web/dist ships alongside
  // dist/server — serve it directly so `guardian dashboard` is a single port, single command.
  const webDistPath = path.join(__dirname, "..", "..", "web", "dist");
  if (fs.existsSync(webDistPath)) {
    app.use(express.static(webDistPath));
    app.get(/^\/(?!api\/).*/, (_req, res) => {
      res.sendFile(path.join(webDistPath, "index.html"));
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[guardian-server]", error);
    res.status(500).json({ error: "internal_error", message: error.message });
  });

  return app;
}
