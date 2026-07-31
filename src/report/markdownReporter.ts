import type { CheckReport, Violation } from "./types";

/**
 * Hidden at the top of every render so the CI job can find its own previous
 * comment on a PR (search comment bodies for this marker) and PATCH it
 * instead of posting a new comment on every push.
 */
export const GUARDIAN_REPORT_MARKER = "<!-- guardian-report -->";

function riskBadge(risk: Violation["riskLevel"]): string {
  switch (risk) {
    case "critical":
    case "high":
      return `⛔ ${risk.toUpperCase()}`;
    case "medium":
      return `⚠️ ${risk.toUpperCase()}`;
    default:
      return `ℹ️ ${risk.toUpperCase()}`;
  }
}

function renderViolation(v: Violation, index: number): string {
  return `### ${index + 1}. ${riskBadge(v.riskLevel)} — ${v.errorWhat}

- **Policy:** ${v.policyViolated}
- **Vị trí:** \`${v.location}\`
- **Vì sao:** ${v.why}
- **Cách sửa:** ${v.howToFix}

<details>
<summary>💬 Prompt gợi ý sửa lỗi (copy-paste vào Copilot/ChatGPT/Claude)</summary>

\`\`\`
${v.promptToFix}
\`\`\`

</details>`;
}

export function renderMarkdownReport(report: CheckReport): string {
  const badge = report.verdict === "PASS" ? "✅ PASS" : "⛔ BLOCK";
  const summary =
    report.violations.length === 0
      ? "Không phát hiện vi phạm policy nào."
      : `**${report.violations.length}** vi phạm được phát hiện trong PR này.`;

  const header = `${GUARDIAN_REPORT_MARKER}
## 🛡️ AI Dev Guardian — ${badge}

${summary}`;

  if (report.violations.length === 0) {
    return header;
  }

  const sections = report.violations.map((v, i) => renderViolation(v, i));
  return [header, ...sections].join("\n\n---\n\n");
}
