import { describe, it, expect } from "vitest";
import { splitDiffByFile } from "../src/git/diffSplitter";

function twoFileDiff(): string {
  return [
    "diff --git a/src/a.ts b/src/a.ts",
    "index 111..222 100644",
    "--- a/src/a.ts",
    "+++ b/src/a.ts",
    "@@ -1,1 +1,1 @@",
    "-old a",
    "+new a",
    "diff --git a/src/b.ts b/src/b.ts",
    "index 333..444 100644",
    "--- a/src/b.ts",
    "+++ b/src/b.ts",
    "@@ -1,1 +1,1 @@",
    "-old b",
    "+new b",
  ].join("\n");
}

describe("splitDiffByFile", () => {
  it("tách diff nhiều file thành đúng số segment, key theo path b/", () => {
    const result = splitDiffByFile(twoFileDiff());
    expect([...result.keys()]).toEqual(["src/a.ts", "src/b.ts"]);
  });

  it("mỗi segment giữ nguyên header + hunk của đúng file, không lẫn nội dung file khác", () => {
    const result = splitDiffByFile(twoFileDiff());
    const segmentA = result.get("src/a.ts")!;
    const segmentB = result.get("src/b.ts")!;

    expect(segmentA).toContain("diff --git a/src/a.ts b/src/a.ts");
    expect(segmentA).toContain("-old a");
    expect(segmentA).toContain("+new a");
    expect(segmentA).not.toContain("src/b.ts");

    expect(segmentB).toContain("diff --git a/src/b.ts b/src/b.ts");
    expect(segmentB).toContain("-old b");
    expect(segmentB).toContain("+new b");
    expect(segmentB).not.toContain("src/a.ts");
  });

  it("trả về map rỗng với diff text rỗng", () => {
    expect(splitDiffByFile("").size).toBe(0);
  });

  it("xử lý đúng diff chỉ có 1 file", () => {
    const diffText = [
      "diff --git a/only.ts b/only.ts",
      "--- a/only.ts",
      "+++ b/only.ts",
      "@@ -1,1 +1,1 @@",
      "-x",
      "+y",
    ].join("\n");
    const result = splitDiffByFile(diffText);
    expect([...result.keys()]).toEqual(["only.ts"]);
    expect(result.get("only.ts")).toContain("+y");
  });
});
