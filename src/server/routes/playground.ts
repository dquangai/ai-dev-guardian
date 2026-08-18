import { Router } from "express";
import { newFileDiff } from "../../git/syntheticDiff";
import { runGuardianCheck } from "../../orchestrator";
import { authzGate } from "../authz/authzGate";
import { isScenarioId, PLAYGROUND_SCENARIOS } from "./playgroundScenarios";

export const playgroundRouter = Router();

/**
 * Sandbox check: runs a fixed demo scenario (PLAYGROUND_SCENARIOS — see playgroundScenarios.ts)
 * through the real check engine and returns the verdict — deliberately does NOT call
 * recordAudit()/tryWriteTuples() (unlike audit.ts's /run), so a Playground run never pollutes
 * real Audit History or OpenFGA tuples. The client only ever sends a `scenario` id, never code —
 * this route can never be used to run the LLM against arbitrary client-supplied content
 * (cost/abuse surface).
 *
 * FGA-mode gap (GUARDIAN_AUTHZ_MODE=fga, not the default): maps to the team's `admin` relation
 * only — senior-dev, which DOES have playground:run in the flat RBAC table below, has no shared
 * relation with admin on the `team` object type in authz/model.fga (only on child objects like
 * policy/bypass_request). Adding one is OpenFGA/Tier 3 work currently on hold pending the
 * Dashboard-direction decision; until then senior-dev is only denied here when FGA mode is
 * explicitly enabled, which no V-ID environment currently runs.
 */
playgroundRouter.post(
  "/run",
  authzGate("playground:run", { objectType: "team", relation: "admin", objectIdFrom: (req) => req.teamId ?? "" }),
  async (req, res) => {
    const scenario = req.body?.scenario;
    if (!isScenarioId(scenario)) {
      res.status(400).json({ error: "unknown_scenario", message: 'scenario must be "jwt" or "redirect".' });
      return;
    }

    const { file, lines } = PLAYGROUND_SCENARIOS[scenario];
    const diff = { diffText: newFileDiff(file, lines), changedFiles: [file] };

    try {
      const report = await runGuardianCheck(diff);
      res.json({ verdict: report.verdict, violations: report.violations, changedFiles: diff.changedFiles });
    } catch (error) {
      res.status(500).json({ error: "playground_run_failed", message: (error as Error).message });
    }
  }
);
