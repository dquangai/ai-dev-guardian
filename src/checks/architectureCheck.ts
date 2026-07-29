import fs from "node:fs";
import path from "node:path";
import madge from "madge";
import type { DiffResult } from "../git/diff";
import type { Violation } from "../report/types";

const TS_JS_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

const MADGE_FILE_EXTENSIONS = ["js", "jsx", "ts", "tsx", "mjs", "cjs"];
const MADGE_EXCLUDE = [/(^|[\\/])(node_modules|dist|\.git|coverage)([\\/]|$)/];

function toPosix(p: string): string {
  return p.split(path.sep).join("/").replace(/^\.\//, "");
}

function formatChain(chain: string[]): string {
  return [...chain, chain[0]].join(" → ");
}

/**
 * Deterministic, madge-based circular-dependency check — no LLM involved.
 * Scoped to TS/JS/JSX/MJS/CJS only (madge doesn't parse Python/Go/C).
 *
 * Runs a whole-repo dependency walk (madge has no diff-scoped mode) but only
 * *reports* chains that include at least one file from this push's diff —
 * pre-existing cycles the push doesn't touch are never flagged, consistent
 * with every other check in Guardian being scoped to the current diff.
 *
 * Fail-safe: any madge error (missing tsconfig, unparseable project, ...)
 * is swallowed and treated as "no violations found" — this is a best-effort
 * enrichment check, never allowed to block a push on its own failure.
 */
export async function checkCircularDependencies(
  diff: DiffResult,
  cwd: string = process.cwd()
): Promise<Violation[]> {
  const hasTsJsChange = diff.changedFiles.some((file) => TS_JS_EXTENSIONS.has(path.extname(file)));
  if (!hasTsJsChange) return [];

  let chains: string[][];
  try {
    const tsconfigPath = path.join(cwd, "tsconfig.json");
    const instance = await madge(cwd, {
      fileExtensions: MADGE_FILE_EXTENSIONS,
      excludeRegExp: MADGE_EXCLUDE,
      tsConfig: fs.existsSync(tsconfigPath) ? tsconfigPath : undefined,
    });
    chains = instance.circular();
  } catch {
    return [];
  }

  const changedFiles = new Set(diff.changedFiles.map(toPosix));
  const violations: Violation[] = [];

  for (const chain of chains) {
    const posixChain = chain.map(toPosix);
    if (!posixChain.some((file) => changedFiles.has(file))) continue;

    violations.push({
      errorWhat: `Phát hiện circular dependency liên quan tới thay đổi trong diff: ${formatChain(posixChain)}`,
      policyViolated: "Architecture Policy — không được có circular dependency giữa các module",
      riskLevel: "medium",
      why: "Circular dependency khiến các module không thể test/refactor độc lập, dễ gây lỗi thứ tự khởi tạo (init order) khó debug, và là dấu hiệu ranh giới trách nhiệm giữa các module chưa rõ ràng.",
      howToFix: "Tách phần logic dùng chung của các module trong vòng lặp ra một module mới mà cả hai cùng phụ thuộc, hoặc đảo một chiều phụ thuộc bằng interface/dependency injection.",
      promptToFix: `Hãy giúp tôi phá vỡ circular dependency giữa các file sau: ${posixChain.join(", ")}. Gợi ý cách tách logic dùng chung hoặc đảo chiều phụ thuộc mà không làm ảnh hưởng đến logic hiện tại.`,
      source: "architecture-check",
    });
  }

  return violations;
}
