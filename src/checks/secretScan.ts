import type { DiffResult } from "../git/diff";
import type { Violation } from "../report/types";

interface SecretRule {
  name: string;
  pattern: RegExp;
}

// Deterministic, regex-based rules — no external binary required.
// Coverage is intentionally narrow for MVP; gitleaks/semgrep are a fast-follow.
const SECRET_RULES: SecretRule[] = [
  { name: "AWS Access Key ID", pattern: /AKIA[0-9A-Z]{16}/ },
  {
    name: "AWS Secret Access Key",
    pattern: /aws_secret_access_key\s*[:=]\s*['"][A-Za-z0-9/+=]{40}['"]/i,
  },
  {
    name: "Generic hardcoded API key / token / password",
    pattern: /(api[_-]?key|apikey|secret|token|password)\s*[:=]\s*['"][A-Za-z0-9\-_.]{8,}['"]/i,
  },
  {
    name: "PEM private key block",
    pattern: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
  },
  { name: "Slack token", pattern: /xox[baprs]-[0-9A-Za-z-]{10,}/ },
  { name: "GitHub token", pattern: /gh[pousr]_[A-Za-z0-9]{36}/ },
];

function mask(value: string): string {
  if (value.length <= 8) return "****";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

/** Extracts (file, added-line-text) pairs from a unified diff. */
function addedLinesByFile(diffText: string): Array<{ file: string; line: string }> {
  const result: Array<{ file: string; line: string }> = [];
  let currentFile = "unknown";

  for (const rawLine of diffText.split("\n")) {
    const fileHeaderMatch = /^\+\+\+ b\/(.+)$/.exec(rawLine);
    if (fileHeaderMatch) {
      currentFile = fileHeaderMatch[1];
      continue;
    }
    if (rawLine.startsWith("+") && !rawLine.startsWith("+++")) {
      result.push({ file: currentFile, line: rawLine.slice(1) });
    }
  }
  return result;
}

export function scanForSecrets(diff: DiffResult): Violation[] {
  const violations: Violation[] = [];

  for (const { file, line } of addedLinesByFile(diff.diffText)) {
    for (const rule of SECRET_RULES) {
      const match = rule.pattern.exec(line);
      if (!match) continue;

      violations.push({
        errorWhat: `Phát hiện ${rule.name} trong ${file}: ${mask(match[0])}`,
        policyViolated: "Security Policy — không hardcode secret/API key trong source code",
        riskLevel: "critical",
        why: "Secret bị commit vào lịch sử git sẽ lộ vĩnh viễn, kể cả khi xoá ở commit sau — bất kỳ ai clone repo đều đọc được.",
        howToFix: "Chuyển giá trị này sang biến môi trường hoặc secret manager, revoke/rotate secret đã lộ ngay lập tức.",
        autoFix: null,
        source: "secret-scan",
      });
    }
  }

  return violations;
}
