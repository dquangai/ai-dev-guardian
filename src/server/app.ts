import fs from "node:fs";
import path from "node:path";
import cors from "cors";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { requireAuth } from "./authMiddleware";
import { auditRouter } from "./routes/audit";
import { authRouter } from "./routes/auth";
import { bypassRouter } from "./routes/bypass";
import { dashboardRouter } from "./routes/dashboard";
import { engineConfigRouter } from "./routes/engineConfig";
import { meRouter } from "./routes/me";
import { notificationsRouter } from "./routes/notifications";
import { policiesRouter } from "./routes/policies";
import { systemRouter } from "./routes/system";
import { teamsRouter } from "./routes/teams";

export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Public: health check and login itself obviously can't require a session token yet.
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.use("/api/auth", authRouter);

  // Everything past this point requires a verified Bearer token (see authMiddleware.ts).
  app.use("/api", requireAuth);

  app.use("/api/me", meRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/policies", policiesRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/audit", auditRouter);
  app.use("/api/bypass-requests", bypassRouter);
  app.use("/api/system", systemRouter);
  app.use("/api/engine-config", engineConfigRouter);
  app.use("/api/teams", teamsRouter);

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
