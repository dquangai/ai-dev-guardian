import { Router } from "express";
import { authzGate } from "../authz/authzGate";
import { ENGINE_CONFIG_ID } from "../authz/migrateTeamDefault";
import { readEngineConfig, readEngineDiagnostics, writeEngineConfig } from "../store/engineConfigStore";

export const engineConfigRouter = Router();

// T-22: engine_config is an org-wide singleton (not per-team) — object id is the fixed constant
// ENGINE_CONFIG_ID ("default"), tuples for it are seeded by authz/migrateTeamDefault.ts.
engineConfigRouter.get(
  "/",
  authzGate("engine-config:view", {
    objectType: "engine_config",
    relation: "can_view",
    objectIdFrom: () => ENGINE_CONFIG_ID,
  }),
  (_req, res) => {
    res.json({ config: readEngineConfig(), diagnostics: readEngineDiagnostics() });
  }
);

engineConfigRouter.put(
  "/",
  authzGate("engine-config:edit", {
    objectType: "engine_config",
    relation: "can_edit",
    objectIdFrom: () => ENGINE_CONFIG_ID,
  }),
  (req, res) => {
    const { llmProvider, llmModel, judgeModel, semgrepConfig } = req.body ?? {};
    if (llmProvider !== undefined && llmProvider !== "anthropic" && llmProvider !== "openai") {
      res.status(400).json({ error: "invalid", message: 'llmProvider must be "anthropic" or "openai".' });
      return;
    }
    const config = writeEngineConfig({ llmProvider, llmModel, judgeModel, semgrepConfig });
    res.json({ config, diagnostics: readEngineDiagnostics() });
  }
);
