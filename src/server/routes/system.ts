import { Router } from "express";
import simpleGit from "simple-git";
import fs from "node:fs";
import path from "node:path";
import { authzGate } from "../authz/authzGate";
import { readCache, DEFAULT_CACHE_PATH } from "../../cache";
import { listPolicies } from "../store/policyStore";
import { readEngineDiagnostics } from "../store/engineConfigStore";

export const systemRouter = Router();

// T-22: audit:view was held by every old role — maps to `member` on the caller's own team (any
// of admin/senior-dev/developer/auditor grants `member`, see authz/model.fga).
systemRouter.get(
  "/diagnostics",
  authzGate("audit:view", { objectType: "team", relation: "member", objectIdFrom: (req) => req.teamId ?? "" }),
  async (_req, res) => {
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
  }
);
