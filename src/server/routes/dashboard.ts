import { Router } from "express";
import { computeDashboardSummary, listAuditHistory } from "../store/auditStore";
import { listPolicies } from "../store/policyStore";

export const dashboardRouter = Router();

dashboardRouter.get("/summary", (_req, res) => {
  res.json(computeDashboardSummary());
});

/** Powers the "Engine Subsystems Breakdown" panel — static metadata about each check plus a
 * live count for the policy router card, since that's the one subsystem whose state (how many
 * policies are loaded) actually changes as users edit .guardian/policies. */
dashboardRouter.get("/subsystems", (_req, res) => {
  const policyCount = listPolicies().length;
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
      name: "Google Gemini 2.5 Flash LLM Judge",
      description: "AI compliance reasoning & prompt-to-fix generation",
      status: "AUTHORITATIVE",
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
  const limit = Number(req.query.limit) || 4;
  res.json(listAuditHistory(limit));
});
