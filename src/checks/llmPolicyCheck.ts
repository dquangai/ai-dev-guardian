import type { DiffResult } from "../git/diff";
import { splitDiffByFile } from "../git/diffSplitter";
import type { Policy } from "../policy/types";
import { routePolicies } from "../policy/router";
import type { Violation } from "../report/types";
import { resolveLLMClient } from "./llm/resolveClient";
import { readFileContextSafe, readSatelliteFiles, type SatelliteFile } from "./llm/fileContext";
import { annotateForLLM } from "./llm/annotate";

const BINARY_DIFF_MARKER = "Binary files";
const CRITICAL_RISK_LEVEL = "critical";

// Matches a diff line (after stripping its leading +/-/space marker) that is
// entirely a comment — //, /*, JSDoc continuation (*), or # (Python/shell).
// Not a real per-language parser, just enough to catch the observed failure
// mode below.
const COMMENT_ONLY_LINE_PATTERN = /^[+\- ]?\s*(\/\/|\/\*|\*\/?|#)/;

/**
 * Checks that a model-claimed evidenceSnippet actually occurs in the real
 * diff text, line by line — grounding for the free-text part of a
 * violation, the same way policyId grounding works via the schema enum.
 *
 * Comment-only diff lines are excluded from the pool of valid evidence.
 * Without this, a JSDoc sentence like "Fail-safe: any madge error..." grounds
 * successfully (the text is real) for a claim like "uses the `any` type" —
 * the model quoted a real line, but that line is prose describing the code,
 * not code using `any`. Grounding proves the quote is real; it doesn't prove
 * the quote means what the model says it means. Restricting evidence to
 * non-comment lines closes that specific gap (observed in practice — see the
 * project's own commit history around this function).
 */
function isEvidenceGrounded(evidenceSnippet: string, fileDiffText: string): boolean {
  const codeLines = fileDiffText
    .split("\n")
    .filter((line) => !COMMENT_ONLY_LINE_PATTERN.test(line))
    .join("\n");

  const snippetLines = evidenceSnippet
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return snippetLines.length > 0 && snippetLines.every((line) => codeLines.includes(line));
}

function buildSatelliteSection(satelliteFiles: SatelliteFile[]): string {
  if (satelliteFiles.length === 0) return "";

  const blocks = satelliteFiles
    .map((s) => {
      const annotated = annotateForLLM(s.resolvedPath, s.content);
      return `### File "${s.resolvedPath}" (import từ "${s.importPath}")\n\`\`\`\n${annotated}\n\`\`\``;
    })
    .join("\n\n");

  return `=== BỔ SUNG NGỮ CẢNH TỪ CÁC FILE LIÊN QUAN (RAG) ===\n\n${blocks}\n\n`;
}

function buildPrompt(
  file: string,
  fileDiffText: string,
  fileContent: string | null,
  satelliteFiles: SatelliteFile[],
  policies: Policy[]
): string {
  const policyBlocks = policies
    .map((p) => `### ${p.category} (id: ${p.id}, severity mặc định: ${p.severity})\n${p.body}`)
    .join("\n\n");

  const contentSection = fileContent
    ? `## Nội dung hiện tại của file "${file}"\n\n\`\`\`\n${annotateForLLM(file, fileContent)}\n\`\`\`\n\n`
    : "";
  const satelliteSection = buildSatelliteSection(satelliteFiles);

  return `Bạn là AI Dev Guardian, một AI Engineering Governance Agent. Nhiệm vụ của bạn là kiểm tra
thay đổi trong file "${file}" dưới đây có vi phạm bất kỳ policy nào trong danh sách policy được
cung cấp hay không.

CHỈ đánh giá dựa trên các policy được liệt kê — không đưa ra nhận xét code review chung chung
(style, performance...) nằm ngoài các policy này. Chỉ đánh giá file "${file}", không suy diễn về
các file khác. Có thể dùng phần "BỔ SUNG NGỮ CẢNH" bên dưới (nếu có) để hiểu đúng type/interface/
function được import vào file này, nhưng KHÔNG báo vi phạm nằm trong các file đó — chúng chỉ để
tham khảo ngữ cảnh. Nếu một policy có phần "Ví dụ vi phạm" / "Ví dụ KHÔNG vi phạm", bám sát chính
xác ranh giới của các ví dụ đó khi ra quyết định — đừng suy diễn rộng hơn những gì ví dụ thể hiện.

Trong phần nội dung file (nếu có), comment được đánh dấu bằng <comment>...</comment> và chuỗi
string được đánh dấu bằng <string>...</string>. Bên trong <comment> KHÔNG BAO GIỜ tính là code
đang thực thi — không được báo vi phạm về cú pháp/kiểu dữ liệu (type, syntax) dựa trên nội dung
trong <comment>, trừ khi chính policy đang áp dụng nói rõ về nội dung/định dạng của comment. Bên
trong <string> vẫn có thể là bằng chứng vi phạm hợp lệ nếu chính GIÁ TRỊ của chuỗi đó là vấn đề
(ví dụ: chuỗi là secret/API key thật) — nhưng nội dung mô tả bằng ngôn ngữ tự nhiên bên trong một
string (thông báo lỗi, text hiển thị cho người dùng) không phải là báo cáo về trạng thái thật của
codebase.

## Policies áp dụng cho file này

${policyBlocks}

${contentSection}${satelliteSection}## Diff cần kiểm tra (file "${file}")

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
 * policies whose scope actually matches that file. Every violation is
 * grounded before being trusted: `policyId` must be one of the ids offered
 * for that file (schema enum), and `evidenceSnippet` must actually occur in
 * the real diff text (see llm/types.ts). A `critical` violation additionally
 * requires a second, independent pass on the same file to confirm the same
 * policyId before it's kept — self-consistency for the severity that
 * actually blocks a push.
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
      const satelliteFiles = readSatelliteFiles(file, fileContent, cwd);
      const policyById = new Map(filePolicies.map((p) => [p.id, p]));

      const prompt = buildPrompt(file, fileDiffText, fileContent, satelliteFiles, filePolicies);
      const policyIds = filePolicies.map((p) => p.id);
      const rawViolations = await client.reportViolations(prompt, policyIds);

      // Self-consistency re-check: a `critical` verdict blocks the push, so
      // before trusting one, ask the same question again and only keep it if
      // the model agrees with itself both times. Only fires when the first
      // pass actually found a critical violation, so a normal push (no
      // critical findings) still costs exactly one call.
      let confirmedCriticalPolicyIds: Set<string> | null = null;
      if (rawViolations.some((v) => v.riskLevel === CRITICAL_RISK_LEVEL)) {
        const secondPass = await client.reportViolations(prompt, policyIds);
        confirmedCriticalPolicyIds = new Set(secondPass.map((v) => v.policyId));
      }

      const violations: Violation[] = [];
      for (const v of rawViolations) {
        const policy = policyById.get(v.policyId);
        if (!policy) {
          console.error(
            `[guardian] LLM trả về policyId không hợp lệ ("${v.policyId}") cho file ${file} — bỏ qua vi phạm này.`
          );
          continue;
        }
        if (!isEvidenceGrounded(v.evidenceSnippet, fileDiffText)) {
          console.error(
            `[guardian] Vi phạm "${v.policyId}" cho file ${file} thiếu bằng chứng khớp với diff thật — bỏ qua. Reasoning của model: ${v.reasoning}`
          );
          continue;
        }
        if (v.riskLevel === CRITICAL_RISK_LEVEL && !confirmedCriticalPolicyIds?.has(v.policyId)) {
          console.error(
            `[guardian] Vi phạm critical "${v.policyId}" cho file ${file} không được xác nhận lại ở lượt kiểm tra thứ 2 — bỏ qua để tránh false positive.`
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
