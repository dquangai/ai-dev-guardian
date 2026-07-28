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
  /**
   * Prompt ngôn ngữ tự nhiên, sẵn sàng copy-paste vào Copilot/ChatGPT/Claude cá
   * nhân của dev để nhờ sửa lỗi này. Guardian không tự sinh code vá lỗi (rủi ro
   * vỡ code) — chỉ sinh prompt nhờ vả có cấu trúc rõ ràng.
   */
  promptToFix: string | null;
  /** Which check produced this violation. */
  source: "secret-scan" | "llm-policy-check";
}

export interface CheckReport {
  verdict: "PASS" | "BLOCK";
  violations: Violation[];
}
