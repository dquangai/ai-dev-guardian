import path from "node:path";
import { describe, it, expect } from "vitest";
import { checkDependencyRules } from "../src/checks/dependencyRulesCheck";
import type { DiffResult } from "../src/git/diff";
import type { Policy } from "../src/policy/types";

// Real package.json on disk, matching the diff's "after" state — the check
// cross-references added lines against this to confirm they're actually
// dependency entries, not e.g. a `scripts` line that happens to look similar.
const BASE_CWD = path.join(__dirname, "fixtures", "dependency-rules", "base");

function makePackageJsonDiff(hunkLines: string[]): DiffResult {
  const diffText = [
    "diff --git a/package.json b/package.json",
    "--- a/package.json",
    "+++ b/package.json",
    `@@ -10,${hunkLines.length} +10,${hunkLines.length} @@`,
    ...hunkLines,
  ].join("\n");
  return { diffText, changedFiles: ["package.json"] };
}

function policyWithAllowlist(overrides: Partial<Policy> = {}): Policy {
  return {
    id: "dependency.policy.md",
    category: "Dependency",
    scope: ["package.json"],
    severity: "medium",
    tags: [],
    body: "body",
    rules: [],
    dependencyAllowlist: ["chalk", "commander"],
    gitWorkflow: [],
    ...overrides,
  };
}

describe("checkDependencyRules", () => {
  it("báo vi phạm khi thêm dependency mới không nằm trong allowlist", () => {
    const diff = makePackageJsonDiff(['     "commander": "^12.1.0",', '+    "left-pad": "^1.3.0"']);
    const violations = checkDependencyRules(diff, [policyWithAllowlist()], BASE_CWD);

    expect(violations).toHaveLength(1);
    expect(violations[0].source).toBe("dependency-rules-check");
    expect(violations[0].location).toBe("package.json (left-pad@^1.3.0)");
    expect(violations[0].errorWhat).toContain("left-pad@^1.3.0");
  });

  it("KHÔNG bỏ lỡ dependency mới dù hunk KHÔNG chứa dòng mở section \"dependencies\": { (bug thật đã gặp khi smoke-test)", () => {
    // Đúng hình dạng diff thật của `git diff` (context 3 dòng, không thấy
    // dòng "dependencies": { vì thay đổi nằm sâu trong danh sách).
    const diff = makePackageJsonDiff([
      '     "madge": "^8.0.0",',
      '     "micromatch": "^4.0.8",',
      '     "commander": "^12.1.0",',
      '-    "chalk": "^4.1.2"',
      '+    "chalk": "^4.2.0",',
      '+    "left-pad": "^1.3.0"',
      "   },",
    ]);
    const violations = checkDependencyRules(diff, [policyWithAllowlist()], BASE_CWD);

    expect(violations).toHaveLength(1);
    expect(violations[0].location).toBe("package.json (left-pad@^1.3.0)");
  });

  it("KHÔNG báo vi phạm khi dependency mới khớp allowlist", () => {
    const diff = makePackageJsonDiff(['     "left-pad": "^1.3.0",', '+    "commander": "^12.1.0"']);
    const violations = checkDependencyRules(diff, [policyWithAllowlist()], BASE_CWD);
    expect(violations).toEqual([]);
  });

  it("KHÔNG báo vi phạm khi chỉ là version bump của dependency đã có (xuất hiện ở cả added và removed)", () => {
    const diff = makePackageJsonDiff(['-    "chalk": "^4.1.2",', '+    "chalk": "^4.2.0",', '     "commander": "^12.1.0"']);
    const violations = checkDependencyRules(diff, [policyWithAllowlist()], BASE_CWD);
    expect(violations).toEqual([]);
  });

  it("KHÔNG báo vi phạm khi dependency bị xoá (chỉ nằm trong removed)", () => {
    const diff = makePackageJsonDiff(['-    "left-pad": "^1.3.0",', '     "commander": "^12.1.0"']);
    const violations = checkDependencyRules(diff, [policyWithAllowlist()], BASE_CWD);
    expect(violations).toEqual([]);
  });

  it("lấy severity từ policy sở hữu allowlist, không hardcode", () => {
    const diff = makePackageJsonDiff(['     "commander": "^12.1.0",', '+    "left-pad": "^1.3.0"']);
    const violations = checkDependencyRules(diff, [policyWithAllowlist({ severity: "critical" })], BASE_CWD);
    expect(violations[0].riskLevel).toBe("critical");
    expect(violations[0].promptToFix).toContain("CRITICAL");
  });

  it("không nhầm dòng added ở section khác (vd scripts) thành dependency, dù tên đó không có trên đĩa dưới dependencies/devDependencies", () => {
    const diff = makePackageJsonDiff(['   "scripts": {', '+    "lint": "eslint ."', "   },"]);
    const violations = checkDependencyRules(diff, [policyWithAllowlist()], BASE_CWD);
    expect(violations).toEqual([]);
  });

  it("báo nhiều vi phạm độc lập khi có nhiều dependency mới không được duyệt", () => {
    const diff = makePackageJsonDiff([
      '     "commander": "^12.1.0",',
      '+    "left-pad": "^1.3.0",',
      '+    "is-odd": "^3.0.1"',
    ]);
    const violations = checkDependencyRules(diff, [policyWithAllowlist()], BASE_CWD);
    expect(violations).toHaveLength(2);
    expect(violations.map((v) => v.location).sort()).toEqual([
      "package.json (is-odd@^3.0.1)",
      "package.json (left-pad@^1.3.0)",
    ]);
  });

  it("trả về [] ngay lập tức nếu diff không đụng tới package.json", () => {
    const diff: DiffResult = { diffText: "", changedFiles: ["src/a.ts"] };
    const violations = checkDependencyRules(diff, [policyWithAllowlist()], BASE_CWD);
    expect(violations).toEqual([]);
  });

  it("trả về [] nếu không policy nào định nghĩa dependencyAllowlist", () => {
    const diff = makePackageJsonDiff(['     "commander": "^12.1.0",', '+    "left-pad": "^1.3.0"']);
    const noAllowlistPolicy = policyWithAllowlist({ dependencyAllowlist: [] });
    const violations = checkDependencyRules(diff, [noAllowlistPolicy], BASE_CWD);
    expect(violations).toEqual([]);
  });

  it("hỗ trợ glob pattern trong allowlist (vd @scope/*)", () => {
    const diff = makePackageJsonDiff(['     "commander": "^12.1.0",', '+    "@anthropic-ai/sdk": "^0.68.0"']);
    const violations = checkDependencyRules(
      diff,
      [policyWithAllowlist({ dependencyAllowlist: ["@anthropic-ai/*"] })],
      BASE_CWD
    );
    expect(violations).toEqual([]);
  });

  it("fail-safe: trả về [] nếu package.json không tồn tại/không parse được ở cwd", () => {
    const diff = makePackageJsonDiff(['     "commander": "^12.1.0",', '+    "left-pad": "^1.3.0"']);
    const badCwd = path.join(__dirname, "fixtures", "dependency-rules", "does-not-exist");
    const violations = checkDependencyRules(diff, [policyWithAllowlist()], badCwd);
    expect(violations).toEqual([]);
  });
});
