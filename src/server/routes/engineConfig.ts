import { Router } from "express";
import { requirePermission } from "../authMiddleware";
import { readEngineConfig, readEngineDiagnostics, writeEngineConfig } from "../store/engineConfigStore";

export const engineConfigRouter = Router();

engineConfigRouter.get("/", requirePermission("engine-config:view"), (_req, res) => {
  res.json({ config: readEngineConfig(), diagnostics: readEngineDiagnostics() });
});

engineConfigRouter.put("/", requirePermission("engine-config:edit"), (req, res) => {
  const { llmProvider, llmModel, judgeModel, semgrepConfig } = req.body ?? {};
  if (llmProvider !== undefined && llmProvider !== "anthropic" && llmProvider !== "openai") {
    res.status(400).json({ error: "invalid", message: 'llmProvider must be "anthropic" or "openai".' });
    return;
  }
  const config = writeEngineConfig({ llmProvider, llmModel, judgeModel, semgrepConfig });
  res.json({ config, diagnostics: readEngineDiagnostics() });
});
