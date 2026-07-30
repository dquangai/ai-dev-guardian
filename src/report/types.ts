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
   * Vị trí gây lỗi, mỗi nguồn tự format theo đúng thứ nó có: "file.ts",
   * "file.ts:12", hoặc một chuỗi file cho circular dependency
   * ("a.ts → b.ts → c.ts → a.ts"). Dùng để build promptToFix — xem
   * report/promptToFix.ts.
   */
  location: string;
  /**
   * Prompt ngôn ngữ tự nhiên, sẵn sàng copy-paste vào Copilot/ChatGPT/Claude cá
   * nhân của dev để nhờ sửa lỗi này. Guardian không tự sinh code vá lỗi (rủi ro
   * vỡ code) — chỉ sinh prompt nhờ vả có cấu trúc rõ ràng, build bằng
   * report/promptToFix.ts#buildPromptToFix() từ các field phía trên, không để
   * LLM tự soạn (đồng nhất chất lượng + không tốn token cho việc này).
   */
  promptToFix: string;
  /** Which check produced this violation. */
  source: "secret-scan" | "llm-policy-check" | "architecture-check" | "semgrep-check";
}

export interface CheckReport {
  verdict: "PASS" | "BLOCK";
  violations: Violation[];
}
