import path from "node:path";
import { describe, it, expect } from "vitest";
import { loadPolicies } from "../src/policy/loader";

const FIXTURES_DIR = path.join(__dirname, "fixtures", "policies");

describe("loadPolicies", () => {
  it("parse frontmatter + body cho policy đầy đủ trường", () => {
    const policies = loadPolicies(FIXTURES_DIR);
    const a = policies.find((p) => p.id === "sample-a.policy.md");
    expect(a).toBeDefined();
    expect(a?.category).toBe("Test Category");
    expect(a?.scope).toEqual(["src/**/*.ts"]);
    expect(a?.severity).toBe("high");
    expect(a?.tags).toEqual(["a", "b"]);
    expect(a?.body).toContain("Sample body text for policy A.");
  });

  it("áp dụng default (category=Uncategorized, severity=medium) khi thiếu field, và bọc scope string thành mảng", () => {
    const policies = loadPolicies(FIXTURES_DIR);
    const b = policies.find((p) => p.id === "sample-b.policy.md");
    expect(b).toBeDefined();
    expect(b?.category).toBe("Uncategorized");
    expect(b?.severity).toBe("medium");
    expect(b?.scope).toEqual(["src/only.ts"]);
  });

  it("bỏ qua file không phải .md", () => {
    const policies = loadPolicies(FIXTURES_DIR);
    expect(policies.some((p) => p.id === "not-a-policy.txt")).toBe(false);
  });

  it("bỏ qua file bắt đầu bằng _ (template/draft, không phải policy đang áp dụng)", () => {
    const policies = loadPolicies(FIXTURES_DIR);
    expect(policies.some((p) => p.id === "_template.policy.md")).toBe(false);
  });

  it("trả về mảng rỗng nếu thư mục không tồn tại", () => {
    expect(loadPolicies(path.join(FIXTURES_DIR, "does-not-exist"))).toEqual([]);
  });

  it("sắp xếp policy theo id", () => {
    const ids = loadPolicies(FIXTURES_DIR).map((p) => p.id);
    expect(ids).toEqual([...ids].sort((a, b) => a.localeCompare(b)));
  });

  it("policy không có `rules` trong frontmatter có rules = []", () => {
    const policies = loadPolicies(FIXTURES_DIR);
    const a = policies.find((p) => p.id === "sample-a.policy.md");
    expect(a?.rules).toEqual([]);
  });

  it("parse `rules` thành ArchitectureRule[], bọc from/forbid string thành mảng", () => {
    const policies = loadPolicies(FIXTURES_DIR);
    const c = policies.find((p) => p.id === "sample-c.policy.md");
    expect(c?.rules).toHaveLength(1);
    expect(c?.rules[0]).toEqual({
      from: ["src/policy/**"],
      forbid: ["src/checks/**"],
      description: "Policy layer không được phụ thuộc ngược lên checks layer.",
    });
  });

  it("loại bỏ rule thiếu `from` hoặc `forbid` khỏi danh sách rules", () => {
    const policies = loadPolicies(FIXTURES_DIR);
    const c = policies.find((p) => p.id === "sample-c.policy.md");
    expect(c?.rules.some((r) => r.forbid.length === 0)).toBe(false);
  });

  it("parse `dependencyAllowlist` thành mảng string", () => {
    const policies = loadPolicies(FIXTURES_DIR);
    const a = policies.find((p) => p.id === "sample-a.policy.md");
    expect(a?.dependencyAllowlist).toEqual(["chalk", "@scope/*"]);
  });

  it("policy không có `dependencyAllowlist` trong frontmatter có dependencyAllowlist = []", () => {
    const policies = loadPolicies(FIXTURES_DIR);
    const b = policies.find((p) => p.id === "sample-b.policy.md");
    expect(b?.dependencyAllowlist).toEqual([]);
  });

  it("parse `gitWorkflow` thành GitWorkflowRule[], giữ nguyên branchPattern/exemptBranches/commitPattern/description", () => {
    const policies = loadPolicies(FIXTURES_DIR);
    const d = policies.find((p) => p.id === "sample-d.policy.md");
    expect(d?.gitWorkflow).toHaveLength(2);
    expect(d?.gitWorkflow[0]).toEqual({
      branchPattern: "^feature/.+$",
      exemptBranches: ["master", "main"],
      commitPattern: "^(feat|fix): .+$",
      description: "Sample git-workflow rule for loader tests.",
    });
  });

  it("gitWorkflow entry chỉ có commitPattern (không có branchPattern) vẫn giữ lại", () => {
    const policies = loadPolicies(FIXTURES_DIR);
    const d = policies.find((p) => p.id === "sample-d.policy.md");
    expect(d?.gitWorkflow[1]).toEqual({
      branchPattern: undefined,
      exemptBranches: [],
      commitPattern: "^chore: .+$",
      description: undefined,
    });
  });

  it("policy không có `gitWorkflow` trong frontmatter có gitWorkflow = []", () => {
    const policies = loadPolicies(FIXTURES_DIR);
    const a = policies.find((p) => p.id === "sample-a.policy.md");
    expect(a?.gitWorkflow).toEqual([]);
  });

  it("parse `testingStandards` thành TestingStandardsRule[], giữ nguyên sourcePattern/testPattern/description", () => {
    const policies = loadPolicies(FIXTURES_DIR);
    const e = policies.find((p) => p.id === "sample-e.policy.md");
    expect(e?.testingStandards).toEqual([
      {
        sourcePattern: ["src/checks/**/*.ts"],
        testPattern: ["test/**/*.test.ts"],
        description: "Sample testing-standards rule for loader tests.",
      },
    ]);
  });

  it("loại bỏ testingStandards entry thiếu `sourcePattern` hoặc `testPattern`", () => {
    const policies = loadPolicies(FIXTURES_DIR);
    const e = policies.find((p) => p.id === "sample-e.policy.md");
    expect(e?.testingStandards).toHaveLength(1);
    expect(e?.testingStandards.some((r) => r.testPattern.length === 0)).toBe(false);
  });

  it("policy không có `testingStandards` trong frontmatter có testingStandards = []", () => {
    const policies = loadPolicies(FIXTURES_DIR);
    const a = policies.find((p) => p.id === "sample-a.policy.md");
    expect(a?.testingStandards).toEqual([]);
  });
});
