import path from "node:path";
import { DEFAULT_POLICY_DIR } from "../../policy/loader";
import type { CheckReport } from "../../report/types";
import { JsonArrayStore } from "./jsonStore";

export interface AuditRecord {
  id: string;
  timestamp: string;
  verdict: CheckReport["verdict"];
  violations: CheckReport["violations"];
  changedFiles: string[];
  target: "staged" | "branch";
  triggeredBy: string;
}

const HISTORY_PATH = path.join(DEFAULT_POLICY_DIR, "..", "audit-history.json");
const MAX_HISTORY = 200;
const historyStore = new JsonArrayStore<AuditRecord>(HISTORY_PATH);

export function recordAudit(input: Omit<AuditRecord, "id" | "timestamp">): AuditRecord {
  const record: AuditRecord = {
    ...input,
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
  };
  historyStore.append(record, MAX_HISTORY);
  return record;
}

export function listAuditHistory(limit?: number): AuditRecord[] {
  const all = historyStore.readAll();
  return limit ? all.slice(0, limit) : all;
}

export interface DashboardSummary {
  governanceHealthPct: number;
  totalAudits: number;
  passed: number;
  warnings: number;
  mergeBlocked: number;
  criticalLeaks: number;
}

const BLOCKING_SEVERITIES = new Set(["medium", "high", "critical"]);

export function computeDashboardSummary(): DashboardSummary {
  const history = historyStore.readAll();
  const totalAudits = history.length;
  const mergeBlocked = history.filter((r) => r.verdict === "BLOCK").length;
  const passed = totalAudits - mergeBlocked;

  // "Warnings" = non-blocking (low severity) findings surfaced on otherwise-passing runs.
  const warnings = history.reduce((count, record) => {
    const hasNonBlocking = record.violations.some((v) => !BLOCKING_SEVERITIES.has(v.riskLevel));
    return count + (hasNonBlocking && record.verdict === "PASS" ? 1 : 0);
  }, 0);

  const criticalLeaks = history.reduce(
    (count, record) =>
      count +
      record.violations.filter((v) => v.source === "secret-scan" || v.riskLevel === "critical")
        .length,
    0
  );

  const governanceHealthPct = totalAudits === 0 ? 100 : Math.round((passed / totalAudits) * 100);

  return { governanceHealthPct, totalAudits, passed, warnings, mergeBlocked, criticalLeaks };
}
