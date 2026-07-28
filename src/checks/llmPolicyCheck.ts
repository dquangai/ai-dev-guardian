import type { DiffResult } from "../git/diff";
import { splitDiffByFile } from "../git/diffSplitter";
import type { Policy } from "../policy/types";
import { routePolicies } from "../policy/router";
import type { Violation } from "../report/types";
import { resolveLLMClient } from "./llm/resolveClient";
import { readFileContextSafe } from "./llm/fileContext";

const BINARY_DIFF_MARKER = "Binary files";

function buildPrompt(
  file: string,
  fileDiffText: string,
  fileContent: string | null,
  policies: Policy[]
): string {
  const policyBlocks = policies
    .map((p) => `### ${p.category} (id: ${p.id}, severity mặc định: ${p.severity})\n${p.body}`)
    .join("\n\n");

  const contentSection = fileContent
    ? `## Nội dung hiện tại của file "${file}"\n\n\`\`\`\n${fileContent}\n\`\`\`\n\n`
    : "";

  return `Bạn là AI Dev Guardian, một AI Engineering Governance Agent. Nhiệm vụ của bạn là kiểm tra
thay đổi trong file "${file}" dưới đây có vi phạm bất kỳ policy nào trong danh sách policy được
cung cấp hay không.

CHỈ đánh giá dựa trên các policy được liệt kê — không đưa ra nhận xét code review chung chung
(style, performance...) nằm ngoài các policy này. Chỉ đánh giá file "${file}", không suy diễn về
các file khác.

## Policies áp dụng cho file này

${policyBlocks}

${contentSection}## Diff cần kiểm tra (file "${file}")

\`\`\`diff
${fileDiffText}
\`\`\`

Gọi tool report_violations với danh sách vi phạm tìm được (mảng rỗng nếu diff tuân thủ đầy đủ).
Với mỗi vi phạm, "policyId" PHẢI là một trong các id đã liệt kê ở trên. Với mỗi vi phạm, "promptToFix"
PHẢI là một prompt tiếng Việt theo đúng mẫu: "Xin chào, trong file [tên file], tôi đã vi phạm luật
[tên luật] do [lỗi cụ thể]. Hãy giúp tôi sửa đoạn code này theo hướng [cách sửa] mà không làm ảnh
hưởng đến logic hiện tại." — KHÔNG tự sinh code sửa lỗi, chỉ sinh prompt nhờ vả.`;
}

export interface LLMPolicyCheckDeps {
  resolveLLMClient: typeof resolveLLMClient;
  cwd: string;
}

/**
 * Runs an LLM-based semantic check of the diff against the given (already
 * route-matched) policies — one call per changed file, each scoped to only
 * that file's diff, full current content (best-effort), and only the
 * policies whose scope actually matches that file. `policyId` returned by
 * the model is validated against the exact set offered for that file before
 * being trusted (grounding — see llm/types.ts).
 *
 * Returns [] without calling any API if there are no policies to check
 * against, or if no LLM provider is configured (see resolveLLMClient:
 * ANTHROPIC_API_KEY / OPENAI_API_KEY / GUARDIAN_LLM_PROVIDER).
 */
export async function checkPoliciesWithLLM(
  diff: DiffResult,
  policies: Policy[],
  deps: Partial<LLMPolicyCheckDeps> = {}
): Promise<Violation[]> {
  if (policies.length === 0) return [];

  const _resolveLLMClient = deps.resolveLLMClient ?? resolveLLMClient;
  const cwd = deps.cwd ?? process.cwd();

  const resolved = _resolveLLMClient();
  if (!resolved) {
    console.error(
      "[guardian] Không tìm thấy ANTHROPIC_API_KEY hoặc OPENAI_API_KEY — bỏ qua LLM policy check (chỉ chạy secret scan)."
    );
    return [];
  }

  const { client } = resolved;
  const diffByFile = splitDiffByFile(diff.diffText);

  const perFileResults = await Promise.all(
    diff.changedFiles.map(async (file): Promise<Violation[]> => {
      const filePolicies = routePolicies(policies, [file]);
      if (filePolicies.length === 0) return [];

      const fileDiffText = diffByFile.get(file) ?? diff.diffText;
      if (fileDiffText.includes(BINARY_DIFF_MARKER)) return [];

      const fileContent = readFileContextSafe(file, cwd);
      const policyById = new Map(filePolicies.map((p) => [p.id, p]));

      const rawViolations = await client.reportViolations(
        buildPrompt(file, fileDiffText, fileContent, filePolicies),
        filePolicies.map((p) => p.id)
      );

      const violations: Violation[] = [];
      for (const v of rawViolations) {
        const policy = policyById.get(v.policyId);
        if (!policy) {
          console.error(
            `[guardian] LLM trả về policyId không hợp lệ ("${v.policyId}") cho file ${file} — bỏ qua vi phạm này.`
          );
          continue;
        }
        violations.push({
          errorWhat: v.errorWhat,
          policyViolated: `${policy.category} (${policy.id})`,
          riskLevel: v.riskLevel,
          why: v.why,
          howToFix: v.howToFix,
          promptToFix: v.promptToFix,
          source: "llm-policy-check" as const,
        });
      }
      return violations;
    })
  );

  return perFileResults.flat();
}
