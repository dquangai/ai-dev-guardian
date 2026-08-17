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
  source:
    | "secret-scan"
    | "llm-policy-check"
    | "architecture-check"
    | "architecture-rules-check"
    | "dependency-rules-check"
    | "semgrep-check"
    | "git-workflow-check"
    | "testing-standards-check";
  /**
   * Verbatim code that matched this violation in the diff — set by secretScan (the raw regex
   * match) and llmPolicyCheck (its grounding-verified evidenceSnippet). Used only internally by
   * the orchestrator to look up the violating line for git-blame author attribution (see
   * git/blame.ts) — never rendered directly. Absent for checks whose violation isn't tied to one
   * specific added line (architecture/dependency checks span multiple files or target
   * `package.json` as a whole).
   */
  evidenceSnippet?: string;
  /**
   * Last author of the violating line, from `git blame` — attached by the orchestrator after all
   * checks run, so `promptToFix` can be routed to the right person instead of printed generically.
   * Best-effort: absent if the line couldn't be resolved (evidence not grounded to one line, blame
   * failed, not inside a git repo, ...) — never blocks the check.
   */
  author?: { name: string; email: string };
}

export interface CheckReport {
  verdict: "PASS" | "BLOCK";
  violations: Violation[];
}
