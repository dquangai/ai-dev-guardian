import { Router } from "express";
import { getStagedDiff } from "../../git/diff";
import { runGuardianCheck } from "../../orchestrator";
import { readCache, DEFAULT_CACHE_PATH } from "../../cache";
import fs from "node:fs";
import path from "node:path";
import { authzGate, listGate, listRouteGate } from "../authz/authzGate";
import { tryWriteTuples } from "../authz/fgaClient";
import { listAuditHistory, recordAudit } from "../store/auditStore";
import { parseBoundedInt } from "../validation";

const MAX_HISTORY_PAGE = 200;

export const auditRouter = Router();

/** T-22: old RBAC's audit:run was really "is this a developer" — no single resource exists yet to
 * check a relation on, so this checks the caller's `developer` relation on their *own team*
 * (mirrors requirePermission("audit:run") exactly: only the developer role could ever run audits). */
auditRouter.post(
  "/run",
  authzGate("audit:run", { objectType: "team", relation: "developer", objectIdFrom: (req) => req.teamId ?? "" }),
  async (req, res) => {
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
      // T-22: without this, can_view (owner or admin/senior-dev/auditor from team) never resolves
      // for anyone on this record — same gap T-21 found for pre-existing policies.
      if (req.teamId) {
        await tryWriteTuples([
          { user: `team:${req.teamId}`, relation: "team", object: `audit_record:${record.id}` },
          { user: `user:${req.userId}`, relation: "owner", object: `audit_record:${record.id}` },
        ]);
      }
      res.json(record);
    } catch (error) {
      res.status(500).json({ error: "audit_failed", message: (error as Error).message });
    }
  }
);

// T-22: T-09's "dev only sees own" now expressed via audit_record's `owner` relation (see
// authz/model.fga: can_view = owner or admin/senior-dev/auditor from team), not a manual
// triggeredBy filter — listGate() below replaces the old `req.role === "developer"` branch.
auditRouter.get("/history", listRouteGate("audit:view"), async (req, res) => {
  const limit =
    req.query.limit === undefined ? undefined : parseBoundedInt(req.query.limit, MAX_HISTORY_PAGE, MAX_HISTORY_PAGE);
  const triggeredBy = process.env.GUARDIAN_AUTHZ_MODE === "fga" ? undefined : req.role === "developer" ? req.userId : undefined;
  const history = listAuditHistory(limit, triggeredBy);
  const visible = await listGate(req.userId, history, {
    objectType: "audit_record",
    relation: "can_view",
    objectIdFor: (r) => r.id,
  });
  res.json(visible);
});

auditRouter.get("/cache", listRouteGate("audit:view"), (_req, res) => {
  const cache = readCache();
  res.json({ passedDiffHashes: cache?.passedDiffHashes ?? [] });
});

// T-22: migrated to authzGate — cache:manage (admin-only) maps to the `admin` relation on the
// caller's own team (mirrors the old permission exactly: only admin had cache:manage).
auditRouter.delete(
  "/cache",
  authzGate("cache:manage", { objectType: "team", relation: "admin", objectIdFrom: (req) => req.teamId ?? "" }),
  (_req, res) => {
    const cachePath = path.join(process.cwd(), DEFAULT_CACHE_PATH);
    try {
      if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath);
      res.json({ status: "cleared" });
    } catch (error) {
      res.status(500).json({ error: "clear_failed", message: (error as Error).message });
    }
  }
);
