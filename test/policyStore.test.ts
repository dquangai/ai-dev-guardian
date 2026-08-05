import matter from "gray-matter";
import { describe, it, expect } from "vitest";
import { buildPolicyFileContent, gitSyncHint } from "../src/server/store/policyStore";

const RAW = `---\ncategory: Test\nseverity: medium\n---\n\n# Body\n`;

describe("gitSyncHint", () => {
  it("gợi ý git add + commit + push khi ghi file (create/update)", () => {
    const hint = gitSyncHint("sso-redirect.policy.md", "write");
    expect(hint).toContain("git add");
    expect(hint).toContain("sso-redirect.policy.md");
    expect(hint).toContain("git commit");
    expect(hint).toContain("git push");
    expect(hint).not.toContain("git rm");
  });

  it("gợi ý git rm + commit + push khi xoá file (delete)", () => {
    const hint = gitSyncHint("old.policy.md", "delete");
    expect(hint).toContain("git rm");
    expect(hint).toContain("old.policy.md");
    expect(hint).toContain("git commit");
    expect(hint).toContain("git push");
    expect(hint).not.toContain("git add");
  });
});

describe("buildPolicyFileContent (T-17)", () => {
  it("bắt đầu ở version 1 khi chưa có version trước đó (policy mới)", () => {
    const { data } = matter(buildPolicyFileContent(RAW, undefined, { updatedBy: "admin-1" }));
    expect(data.version).toBe(1);
    expect(data.updatedBy).toBe("admin-1");
    expect(data.changeSummary).toBe("");
    expect(typeof data.lastUpdated).toBe("string");
  });

  it("tăng version thêm 1 so với version trước đó", () => {
    const { data } = matter(buildPolicyFileContent(RAW, 5, { updatedBy: "senior-dev-1" }));
    expect(data.version).toBe(6);
  });

  it("giữ lại changeSummary khi được truyền vào", () => {
    const { data } = matter(
      buildPolicyFileContent(RAW, 1, { updatedBy: "admin-1", changeSummary: "Siết chặt severity" })
    );
    expect(data.changeSummary).toBe("Siết chặt severity");
  });

  it("giữ nguyên các field frontmatter gốc (category, severity) và body", () => {
    const { data, content } = matter(buildPolicyFileContent(RAW, undefined, { updatedBy: "admin-1" }));
    expect(data.category).toBe("Test");
    expect(data.severity).toBe("medium");
    expect(content.trim()).toBe("# Body");
  });
});
