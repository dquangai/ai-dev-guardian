import { Router } from "express";
import { getStagedDiff } from "../../git/diff";
import { runGuardianCheck } from "../../orchestrator";
import { readCache, DEFAULT_CACHE_PATH } from "../../cache";
import fs from "node:fs";
import path from "node:path";
import { requirePermission } from "../authMiddleware";
import { listAuditHistory, recordAudit } from "../store/auditStore";
import { parseBoundedInt } from "../validation";

const MAX_HISTORY_PAGE = 200;

export const auditRouter = Router();

auditRouter.post("/run", requirePermission("audit:run"), async (req, res) => {
  try {
    const diff = await getStagedDiff();
    const report = await runGuardianCheck(diff);
    const record = recordAudit({
      verdict: report.verdict,
      violations: report.violations,
      changedFiles: diff.changedFiles,
      target: "staged",
      triggeredBy: req.userId,
    });
    res.json(record);
  } catch (error) {
    res.status(500).json({ error: "audit_failed", message: (error as Error).message });
  }
});

auditRouter.get("/history", requirePermission("audit:view"), (req, res) => {
  const limit =
    req.query.limit === undefined ? undefined : parseBoundedInt(req.query.limit, MAX_HISTORY_PAGE, MAX_HISTORY_PAGE);
  const triggeredBy = req.role === "developer" ? req.userId : undefined;
  res.json(listAuditHistory(limit, triggeredBy));
});

auditRouter.get("/cache", requirePermission("audit:view"), (_req, res) => {
  const cache = readCache();
  res.json({ passedDiffHashes: cache?.passedDiffHashes ?? [] });
});

auditRouter.delete("/cache", requirePermission("cache:manage"), (_req, res) => {
  const cachePath = path.join(process.cwd(), DEFAULT_CACHE_PATH);
  try {
    if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath);
    res.json({ status: "cleared" });
  } catch (error) {
    res.status(500).json({ error: "clear_failed", message: (error as Error).message });
  }
});
