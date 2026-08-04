import { Router } from "express";
import { computeDashboardSummary, listAuditHistory } from "../store/auditStore";
import { listPolicies } from "../store/policyStore";
import { readEngineDiagnostics } from "../store/engineConfigStore";
import { parseBoundedInt } from "../validation";

const PROVIDER_FULL_NAME: Record<"anthropic" | "openai", string> = {
  anthropic: "Anthropic Claude",
  openai: "OpenAI GPT",
};

const MAX_RECENT_ACTIVITY = 50;

export const dashboardRouter = Router();

dashboardRouter.get("/summary", (_req, res) => {
  res.json(computeDashboardSummary());
});

/** Powers the "Engine Subsystems Breakdown" panel — static metadata about each check plus a
 * live count for the policy router card, since that's the one subsystem whose state (how many
 * policies are loaded) actually changes as users edit .guardian/policies. */
dashboardRouter.get("/subsystems", (_req, res) => {
  const policyCount = listPolicies().length;
  const { provider, effectiveLlmModel } = readEngineDiagnostics();
  const providerName = provider ? PROVIDER_FULL_NAME[provider] : null;

  res.json([
    {
      id: "secret-scan",
      name: "Secret Leak Scanner",
      description: "Regex pattern matching AWS, JWT, API Keys",
      status: "ACTIVE",
    },
    {
      id: "architecture-check",
      name: "Architecture & Circular Dependency Graph",
      description: "Layer isolation rules & cycle detection",
      status: "ACTIVE",
    },
    {
      id: "llm-policy-check",
      name: providerName ? `${providerName} LLM Judge` : "LLM Judge (Not Configured)",
      description: providerName
        ? `AI compliance reasoning & prompt-to-fix generation${effectiveLlmModel ? ` — ${effectiveLlmModel}` : ""}`
        : "No ANTHROPIC_API_KEY or OPENAI_API_KEY set — this check is skipped",
      status: providerName ? "AUTHORITATIVE" : "DISABLED",
    },
    {
      id: "policy-router",
      name: "Policy Rules Router (.guardian/policies/)",
      description: `${policyCount} Markdown policy file${policyCount === 1 ? "" : "s"} loaded`,
      status: "ENFORCING",
    },
  ]);
});

dashboardRouter.get("/recent-activity", (req, res) => {
  const limit = parseBoundedInt(req.query.limit, 4, MAX_RECENT_ACTIVITY);
  res.json(listAuditHistory(limit));
});
