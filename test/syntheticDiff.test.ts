import { describe, it, expect } from "vitest";
import { newFileDiff } from "../src/git/syntheticDiff";

describe("newFileDiff", () => {
  it("dựng đúng format unified diff cho 1 file mới hoàn toàn", () => {
    const diff = newFileDiff("sso/session.go", ["line one", "line two"]);
    expect(diff).toBe(
      [
        "diff --git a/sso/session.go b/sso/session.go",
        "new file mode 100644",
        "index 0000000..1111111",
        "--- /dev/null",
        "+++ b/sso/session.go",
        "@@ -0,0 +1,2 @@",
        "+line one",
        "+line two",
      ].join("\n")
    );
  });

  it("mỗi dòng nội dung được thêm dấu + đúng vị trí, không đổi thứ tự", () => {
    const diff = newFileDiff("a.ts", ["first", "second", "third"]);
    const addedLines = diff.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++"));
    expect(addedLines).toEqual(["+first", "+second", "+third"]);
  });

  it("header hunk phản ánh đúng số dòng nội dung", () => {
    const diff = newFileDiff("a.ts", ["x", "y", "z", "w"]);
    expect(diff).toContain("@@ -0,0 +1,4 @@");
  });

  it("mảng nội dung rỗng vẫn dựng được diff hợp lệ (0 dòng thêm)", () => {
    const diff = newFileDiff("empty.ts", []);
    expect(diff).toContain("@@ -0,0 +1,0 @@");
    expect(diff.split("\n").some((l) => l.startsWith("+") && !l.startsWith("+++"))).toBe(false);
  });

  it("kết quả có thể parse lại đúng bằng splitDiffByFile (dùng chung với orchestrator thật)", async () => {
    const { splitDiffByFile } = await import("../src/git/diffSplitter");
    const diff = newFileDiff("sso/session.go", ["hello"]);
    const segment = splitDiffByFile(diff).get("sso/session.go");
    expect(segment).toBeDefined();
    expect(segment).toContain("+hello");
  });
});
