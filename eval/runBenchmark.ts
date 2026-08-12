import "dotenv/config";
import chalk from "chalk";
import { EVAL_CASES } from "./dataset/cases";
import { runEvalCases } from "./runSuite";
import { buildSummary, pct } from "./report";
import { checkThresholds } from "./checkThresholds";
import { loadPolicies } from "../src/policy/loader";
import { routePolicies } from "../src/policy/router";
import type { EvalCase, EvalSummary } from "./types";

interface ModelConfig {
  provider: "openai" | "anthropic";
  model: string;
}

const DEFAULT_MATRIX: ModelConfig[] = [
  { provider: "openai", model: "gpt-4o" },
  { provider: "openai", model: "gpt-4o-mini" },
];

/**
 * USD per 1M tokens, captured at the time this file was written — an approximation to make
 * relative cost comparisons between models legible, NOT a live-metered bill. Verify current
 * pricing at the provider's own pricing page before using this table for a real budget decision.
 */
const PRICING: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  "gpt-4o": { inputPer1M: 2.5, outputPer1M: 10 },
  "gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.6 },
};

// Structured tool-call responses here are short (a handful of fields per violation) — this is a
// deliberately simple flat assumption, not a measurement, documented so the cost column reads as
// what it is: an estimate.
const ASSUMED_OUTPUT_TOKENS_PER_CALL = 200;

/** Rough approximation (~4 chars/token), not a real tokenizer — good enough for a comparative estimate. */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Estimates the INPUT tokens `checkPoliciesWithLLM` would actually send for this case — diff text
 * plus the body of every policy real routing would match for this case's file(s), same as
 * production (`routePolicies`). Cases whose file matches no policy cost nothing (no LLM call would
 * actually be made), matching the real orchestrator's early-return.
 */
function estimateInputTokensForCase(evalCase: EvalCase, policies: ReturnType<typeof loadPolicies>): number {
  const matched = routePolicies(policies, evalCase.changedFiles);
  if (matched.length === 0) return 0;
  const policyText = matched.map((p) => p.body).join("\n");
  return estimateTokens(evalCase.diffText + policyText);
}

/**
 * Lower-bound cost estimate: assumes exactly one LLM call per case that matches a policy. Real
 * runs cost MORE whenever a case triggers the critical self-consistency re-check (2nd identical
 * call) or a judge pass (extra call) — see llmPolicyCheck.ts. Treat this as a floor, not a ceiling.
 */
function estimateCostUsd(cases: EvalCase[], model: string): number {
  const pricing = PRICING[model];
  if (!pricing) return NaN;

  const policies = loadPolicies();
  let totalCostUsd = 0;
  for (const evalCase of cases) {
    const inputTokens = estimateInputTokensForCase(evalCase, policies);
    if (inputTokens === 0) continue;
    totalCostUsd += (inputTokens / 1_000_000) * pricing.inputPer1M;
    totalCostUsd += (ASSUMED_OUTPUT_TOKENS_PER_CALL / 1_000_000) * pricing.outputPer1M;
  }
  return totalCostUsd;
}

interface BenchmarkRow {
  config: ModelConfig;
  summary: EvalSummary | null;
  runtimeSeconds: number;
  estimatedCostUsd: number;
  gatePassed: boolean;
  error?: string;
}

function hasApiKey(provider: ModelConfig["provider"]): boolean {
  return provider === "anthropic" ? Boolean(process.env.ANTHROPIC_API_KEY) : Boolean(process.env.OPENAI_API_KEY);
}

/**
 * Runs the full eval suite once per `config`, forcing GUARDIAN_LLM_PROVIDER/GUARDIAN_LLM_MODEL for
 * the duration of that run and restoring the previous values afterward — this is the only way to
 * point a run at a specific model without changing the production orchestrator/llmPolicyCheck
 * (which resolve the client from env internally) or the API key currently configured.
 */
async function runOneModel(config: ModelConfig): Promise<BenchmarkRow> {
  if (!hasApiKey(config.provider)) {
    return {
      config,
      summary: null,
      runtimeSeconds: 0,
      estimatedCostUsd: 0,
      gatePassed: false,
      error: `Thiếu API key cho provider "${config.provider}" — bỏ qua model này.`,
    };
  }

  const savedProvider = process.env.GUARDIAN_LLM_PROVIDER;
  const savedModel = process.env.GUARDIAN_LLM_MODEL;
  process.env.GUARDIAN_LLM_PROVIDER = config.provider;
  process.env.GUARDIAN_LLM_MODEL = config.model;

  try {
    console.log(chalk.bold(`\n▶ Đang chạy ${EVAL_CASES.length} case với ${config.provider}/${config.model}...`));
    const startedAt = Date.now();
    const results = await runEvalCases(EVAL_CASES);
    const runtimeSeconds = (Date.now() - startedAt) / 1000;

    const summary = buildSummary(results);
    const estimatedCostUsd = estimateCostUsd(EVAL_CASES, config.model);
    const gatePassed = checkThresholds(summary).passed;

    return { config, summary, runtimeSeconds, estimatedCostUsd, gatePassed };
  } finally {
    if (savedProvider === undefined) delete process.env.GUARDIAN_LLM_PROVIDER;
    else process.env.GUARDIAN_LLM_PROVIDER = savedProvider;
    if (savedModel === undefined) delete process.env.GUARDIAN_LLM_MODEL;
    else process.env.GUARDIAN_LLM_MODEL = savedModel;
  }
}

function padRight(text: string, width: number): string {
  return text.length >= width ? text : text + " ".repeat(width - text.length);
}

function printComparisonMatrix(rows: BenchmarkRow[]): void {
  const columns = [
    { label: "Model", width: 16 },
    { label: "Recall", width: 9 },
    { label: "Precision", width: 11 },
    { label: "FPR", width: 8 },
    { label: "Thời gian", width: 11 },
    { label: "Chi phí ($)", width: 12 },
    { label: "Gate", width: 6 },
  ];

  console.log("");
  console.log(chalk.bold("📊 Executive Comparison Matrix — Recall/Precision/FPR/Runtime/Cost theo model"));
  console.log(columns.map((c) => padRight(c.label, c.width)).join(" | "));
  console.log(columns.map((c) => "-".repeat(c.width)).join("-|-"));

  for (const row of rows) {
    if (!row.summary) {
      console.log(chalk.dim(`${padRight(row.config.model, columns[0].width)} | ${row.error}`));
      continue;
    }
    const cells = [
      row.config.model,
      pct(row.summary.recall),
      pct(row.summary.precision),
      pct(row.summary.falsePositiveRate),
      `${row.runtimeSeconds.toFixed(1)}s`,
      `~$${row.estimatedCostUsd.toFixed(3)}`,
      row.gatePassed ? chalk.green("PASS") : chalk.red("FAIL"),
    ];
    console.log(cells.map((cell, i) => padRight(cell, columns[i].width)).join(" | "));
  }
  console.log("");
  console.log(
    chalk.dim(
      "Chi phí là ƯỚC TÍNH SÀN (1 lượt gọi/case, chưa tính lượt xác nhận critical/judge phát sinh thêm) " +
        "dựa trên bảng giá tại thời điểm viết code — xác nhận lại giá thật trước khi dùng để quyết định ngân sách."
    )
  );
}

async function main(): Promise<void> {
  console.log(chalk.bold(`🏁 Guardian Eval — Multi-Model Benchmark (${DEFAULT_MATRIX.length} model)`));

  const rows: BenchmarkRow[] = [];
  for (const config of DEFAULT_MATRIX) {
    rows.push(await runOneModel(config));
  }

  printComparisonMatrix(rows);

  // Informational — same reasoning as runEval.ts's default mode: a benchmark comparing models
  // shouldn't itself fail a CI job just because one candidate model misses the bar.
  process.exitCode = 0;
}

main();
