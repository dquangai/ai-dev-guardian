import path from "node:path";
import { describe, it, expect } from "vitest";
import { checkCircularDependencies } from "../src/checks/architectureCheck";
import type { DiffResult } from "../src/git/diff";
import type { Policy } from "../src/policy/types";

const CYCLE_CWD = path.join(__dirname, "fixtures", "architecture", "cycle");
const NO_CYCLE_CWD = path.join(__dirname, "fixtures", "architecture", "no-cycle");

function diffFor(changedFiles: string[]): DiffResult {
  return { diffText: "", changedFiles };
}

function architecturePolicy(overrides: Partial<Policy> = {}): Policy {
  return {
    id: "architecture.policy.md",
    category: "Architecture",
    scope: [],
    severity: "high",
    tags: [],
    body: "body",
    rules: [{ from: ["**"], forbid: ["nothing/**"] }],
    ...overrides,
  };
}

describe("checkCircularDependencies", () => {
  it("phát hiện circular dependency khi file trong diff nằm trong vòng lặp", async () => {
    const violations = await checkCircularDependencies(diffFor(["a.ts"]), [], CYCLE_CWD);

    expect(violations).toHaveLength(1);
    expect(violations[0].source).toBe("architecture-check");
    expect(violations[0].riskLevel).toBe("medium");
    expect(violations[0].errorWhat).toContain("a.ts");
    expect(violations[0].errorWhat).toContain("b.ts");
  });

  it("KHÔNG báo cáo cycle có sẵn trong repo nếu diff không đụng tới file nào trong vòng lặp đó", async () => {
    const violations = await checkCircularDependencies(diffFor(["c.ts"]), [], CYCLE_CWD);
    expect(violations).toEqual([]);
  });

  it("trả về [] nếu không có circular dependency nào", async () => {
    const violations = await checkCircularDependencies(diffFor(["a.ts"]), [], NO_CYCLE_CWD);
    expect(violations).toEqual([]);
  });

  it("trả về [] ngay lập tức (không gọi madge) nếu diff không đụng file TS/JS nào", async () => {
    const violations = await checkCircularDependencies(diffFor(["README.md"]), [], CYCLE_CWD);
    expect(violations).toEqual([]);
  });

  it("fail-safe: trả về [] thay vì throw nếu cwd không tồn tại", async () => {
    const badCwd = path.join(__dirname, "fixtures", "architecture", "does-not-exist");
    await expect(checkCircularDependencies(diffFor(["a.ts"]), [], badCwd)).resolves.toEqual([]);
  });

  it("mặc định severity = medium khi không có policy nào định nghĩa rules", async () => {
    const violations = await checkCircularDependencies(diffFor(["a.ts"]), [], CYCLE_CWD);
    expect(violations[0].riskLevel).toBe("medium");
  });

  it("lấy severity từ policy đầu tiên có rules thay vì hardcode", async () => {
    const policies = [architecturePolicy({ severity: "critical" })];
    const violations = await checkCircularDependencies(diffFor(["a.ts"]), policies, CYCLE_CWD);

    expect(violations).toHaveLength(1);
    expect(violations[0].riskLevel).toBe("critical");
    expect(violations[0].promptToFix).toContain("CRITICAL");
  });

  it("bỏ qua policy không có rules khi tìm severity (vẫn fallback medium)", async () => {
    const policies = [architecturePolicy({ id: "no-rules.md", severity: "critical", rules: [] })];
    const violations = await checkCircularDependencies(diffFor(["a.ts"]), policies, CYCLE_CWD);
    expect(violations[0].riskLevel).toBe("medium");
  });
});
