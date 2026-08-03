import { Router } from "express";
import simpleGit from "simple-git";
import fs from "node:fs";
import path from "node:path";
import { requirePermission } from "../authMiddleware";
import { readCache, DEFAULT_CACHE_PATH } from "../../cache";
import { listPolicies } from "../store/policyStore";
import { readEngineDiagnostics } from "../store/engineConfigStore";

export const systemRouter = Router();

systemRouter.get("/diagnostics", requirePermission("audit:view"), async (_req, res) => {
  const git = simpleGit(process.cwd());
  const branch = await git
    .revparse(["--abbrev-ref", "HEAD"])
    .catch(() => "unknown");
  const isRepo = await git.checkIsRepo().catch(() => false);
  const cache = readCache();
  const cachePath = path.join(process.cwd(), DEFAULT_CACHE_PATH);

  res.json({
    nodeVersion: process.version,
    platform: process.platform,
    gitBranch: isRepo ? branch.trim() || "unknown" : "unknown",
    isGitRepo: isRepo,
    gateGuardActive: true,
    policiesLoaded: listPolicies().length,
    cachedPassHashes: cache?.passedDiffHashes.length ?? 0,
    cacheFileExists: fs.existsSync(cachePath),
    llm: readEngineDiagnostics(),
  });
});
