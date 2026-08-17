import { describe, it, expect } from "vitest";
import { checkTestingStandards } from "../src/checks/testingStandardsCheck";
import type { DiffResult } from "../src/git/diff";
import type { Policy, TestingStandardsRule } from "../src/policy/types";

function newFileSegment(file: string): string {
  return [
    `diff --git a/${file} b/${file}`,
    "new file mode 100644",
    "index 0000000..abc1234",
    "--- /dev/null",
    `+++ b/${file}`,
    "@@ -0,0 +1,1 @@",
    "+export const x = 1;",
  ].join("\n");
}

function modifiedFileSegment(file: string): string {
  return [
    `diff --git a/${file} b/${file}`,
    "index aaa1111..bbb2222 100644",
    `--- a/${file}`,
    `+++ b/${file}`,
    "@@ -1,1 +1,1 @@",
    "-old",
    "+new",
  ].join("\n");
}

function diffFor(segments: Record<string, string>): DiffResult {
  return {
    diffText: Object.values(segments).join("\n"),
    changedFiles: Object.keys(segments),
  };
}

function policyWithRule(rule: TestingStandardsRule, overrides: Partial<Policy> = {}): Policy {
  return {
    id: "testing-standards.policy.md",
    category: "Testing Standards",
    scope: [],
    severity: "low",
    tags: [],
    body: "body",
    rules: [],
    dependencyAllowlist: [],
    gitWorkflow: [],
    testingStandards: [rule],
    ...overrides,
  };
}

const RULE: TestingStandardsRule = {
  sourcePattern: ["src/checks/**/*.ts"],
  testPattern: ["test/**/*.test.ts"],
};

describe("checkTestingStandards", () => {
  it("file src mới, không có file test nào trong diff -> 1 violation", () => {
    const diff = diffFor({ "src/checks/newCheck.ts": newFileSegment("src/checks/newCheck.ts") });
    const violations = checkTestingStandards(diff, [policyWithRule(RULE)]);
    expect(violations).toHaveLength(1);
    expect(violations[0].source).toBe("testing-standards-check");
    expect(violations[0].location).toBe("src/checks/newCheck.ts");
  });

  it("file src mới + có đụng 1 file test (không cần khớp tên) -> không vi phạm", () => {
    const diff = diffFor({
      "src/checks/newCheck.ts": newFileSegment("src/checks/newCheck.ts"),
      "test/somethingElse.test.ts": newFileSegment("test/somethingElse.test.ts"),
    });
    expect(checkTestingStandards(diff, [policyWithRule(RULE)])).toEqual([]);
  });

  it("file chỉ SỬA (không phải mới) không bị kiểm tra dù khớp sourcePattern", () => {
    const diff = diffFor({
      "src/checks/existing.ts": modifiedFileSegment("src/checks/existing.ts"),
    });
    expect(checkTestingStandards(diff, [policyWithRule(RULE)])).toEqual([]);
  });

  it("file mới không khớp sourcePattern (ví dụ src/cli.ts) -> không vi phạm", () => {
    const diff = diffFor({ "src/cli.ts": newFileSegment("src/cli.ts") });
    expect(checkTestingStandards(diff, [policyWithRule(RULE)])).toEqual([]);
  });

  it("không có policy nào định nghĩa testingStandards -> []", () => {
    const diff = diffFor({ "src/checks/newCheck.ts": newFileSegment("src/checks/newCheck.ts") });
    const noRulePolicy: Policy = {
      id: "other.policy.md",
      category: "Other",
      scope: [],
      severity: "low",
      tags: [],
      body: "",
      rules: [],
      dependencyAllowlist: [],
      gitWorkflow: [],
      testingStandards: [],
    };
    expect(checkTestingStandards(diff, [noRulePolicy])).toEqual([]);
  });

  it("không có file nào mới trong diff -> [] (không tốn công quét)", () => {
    const diff = diffFor({ "src/checks/existing.ts": modifiedFileSegment("src/checks/existing.ts") });
    expect(checkTestingStandards(diff, [policyWithRule(RULE)])).toEqual([]);
  });

  it("nhiều file src mới cùng lúc, thiếu test -> 1 violation cho mỗi file", () => {
    const diff = diffFor({
      "src/checks/a.ts": newFileSegment("src/checks/a.ts"),
      "src/checks/b.ts": newFileSegment("src/checks/b.ts"),
    });
    const violations = checkTestingStandards(diff, [policyWithRule(RULE)]);
    expect(violations.map((v) => v.location).sort()).toEqual(["src/checks/a.ts", "src/checks/b.ts"]);
  });

  it("lấy severity từ policy sở hữu rule, không hardcode", () => {
    const diff = diffFor({ "src/checks/newCheck.ts": newFileSegment("src/checks/newCheck.ts") });
    const violations = checkTestingStandards(diff, [policyWithRule(RULE, { severity: "medium" })]);
    expect(violations[0].riskLevel).toBe("medium");
  });
});
