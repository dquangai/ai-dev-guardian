import path from "node:path";
import { describe, it, expect } from "vitest";
import { checkArchitectureRules } from "../src/checks/architectureRulesCheck";
import type { DiffResult } from "../src/git/diff";
import type { Policy } from "../src/policy/types";

const VIOLATES_CWD = path.join(__dirname, "fixtures", "architecture-rules", "violates");
const CLEAN_CWD = path.join(__dirname, "fixtures", "architecture-rules", "clean");

function diffFor(changedFiles: string[]): DiffResult {
  return { diffText: "", changedFiles };
}

function policyWithRule(overrides: Partial<Policy> = {}): Policy {
  return {
    id: "architecture.policy.md",
    category: "Architecture",
    scope: [],
    severity: "high",
    tags: [],
    body: "body",
    rules: [{ from: ["from-layer/**"], forbid: ["forbidden-layer/**"] }],
    dependencyAllowlist: [],
    gitWorkflow: [],
    ...overrides,
  };
}

describe("checkArchitectureRules", () => {
  it("phát hiện import bị cấm từ file trong diff khớp glob `from`", async () => {
    const violations = await checkArchitectureRules(
      diffFor(["from-layer/a.ts"]),
      [policyWithRule()],
      VIOLATES_CWD
    );

    expect(violations).toHaveLength(1);
    expect(violations[0].source).toBe("architecture-rules-check");
    expect(violations[0].location).toBe("from-layer/a.ts → forbidden-layer/b.ts");
    expect(violations[0].errorWhat).toContain("from-layer/a.ts");
    expect(violations[0].errorWhat).toContain("forbidden-layer/b.ts");
  });

  it("lấy severity từ policy sở hữu rule, không hardcode", async () => {
    const violations = await checkArchitectureRules(
      diffFor(["from-layer/a.ts"]),
      [policyWithRule({ severity: "critical" })],
      VIOLATES_CWD
    );
    expect(violations[0].riskLevel).toBe("critical");
    expect(violations[0].promptToFix).toContain("CRITICAL");
  });

  it("dùng description của rule làm `why` nếu có", async () => {
    const violations = await checkArchitectureRules(
      diffFor(["from-layer/a.ts"]),
      [
        policyWithRule({
          rules: [
            {
              from: ["from-layer/**"],
              forbid: ["forbidden-layer/**"],
              description: "Lý do tuỳ chỉnh từ policy.",
            },
          ],
        }),
      ],
      VIOLATES_CWD
    );
    expect(violations[0].why).toBe("Lý do tuỳ chỉnh từ policy.");
  });

  it("KHÔNG báo cáo file không khớp glob `from`, dù nó cũng import target bị cấm", async () => {
    const violations = await checkArchitectureRules(
      diffFor(["other-layer/c.ts"]),
      [policyWithRule()],
      VIOLATES_CWD
    );
    expect(violations).toEqual([]);
  });

  it("KHÔNG báo cáo vi phạm có sẵn trong repo nếu diff không đụng tới file `from`", async () => {
    const violations = await checkArchitectureRules(
      diffFor(["forbidden-layer/b.ts"]),
      [policyWithRule()],
      VIOLATES_CWD
    );
    expect(violations).toEqual([]);
  });

  it("trả về [] nếu không policy nào định nghĩa rules", async () => {
    const noRulesPolicy: Policy = { ...policyWithRule(), rules: [] };
    const violations = await checkArchitectureRules(diffFor(["from-layer/a.ts"]), [noRulesPolicy], VIOLATES_CWD);
    expect(violations).toEqual([]);
  });

  it("trả về [] khi import thực tế không khớp glob `forbid`", async () => {
    const violations = await checkArchitectureRules(diffFor(["from-layer/a.ts"]), [policyWithRule()], CLEAN_CWD);
    expect(violations).toEqual([]);
  });

  it("trả về [] ngay lập tức (không gọi madge) nếu diff không đụng file TS/JS nào", async () => {
    const violations = await checkArchitectureRules(diffFor(["README.md"]), [policyWithRule()], VIOLATES_CWD);
    expect(violations).toEqual([]);
  });

  it("fail-safe: trả về [] thay vì throw nếu cwd không tồn tại", async () => {
    const badCwd = path.join(__dirname, "fixtures", "architecture-rules", "does-not-exist");
    await expect(
      checkArchitectureRules(diffFor(["from-layer/a.ts"]), [policyWithRule()], badCwd)
    ).resolves.toEqual([]);
  });
});
