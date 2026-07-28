import type { Severity } from "../policy/types";

export interface Violation {
  /** Lỗi gì — what was found, concretely (file, line context if available). */
  errorWhat: string;
  /** Vi phạm policy nào — human-readable policy/category reference. */
  policyViolated: string;
  /** Mức độ rủi ro. */
  riskLevel: Severity;
  /** Tại sao sai — why it matters if left unfixed. */
  why: string;
  /** Cách sửa — concrete remediation guidance. */
  howToFix: string;
  /** Tự động tạo bản sửa — reserved for Phase 2 (auto-fix generation). Always null in MVP. */
  autoFix: string | null;
  /** Which check produced this violation. */
  source: "secret-scan" | "llm-policy-check";
}

export interface CheckReport {
  verdict: "PASS" | "BLOCK";
  violations: Violation[];
}
