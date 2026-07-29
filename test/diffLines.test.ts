import { describe, it, expect } from "vitest";
import { addedLineNumbers } from "../src/git/diffLines";

describe("addedLineNumbers", () => {
  it("trả về số dòng mới (post-change) của các dòng '+' trong 1 hunk", () => {
    const diffText = [
      "diff --git a/a.ts b/a.ts",
      "--- a/a.ts",
      "+++ b/a.ts",
      "@@ -1,3 +1,4 @@",
      " context1",
      "+added1",
      " context2",
      "+added2",
      " context3",
    ].join("\n");

    expect(addedLineNumbers(diffText, "a.ts")).toEqual(new Set([2, 4]));
  });

  it("không tính dòng bị xoá ('-') vào số dòng mới", () => {
    const diffText = [
      "diff --git a/a.ts b/a.ts",
      "--- a/a.ts",
      "+++ b/a.ts",
      "@@ -1,3 +1,2 @@",
      " context1",
      "-removed",
      "+added",
    ].join("\n");

    expect(addedLineNumbers(diffText, "a.ts")).toEqual(new Set([2]));
  });

  it("xử lý đúng nhiều hunk trong cùng 1 file", () => {
    const diffText = [
      "diff --git a/a.ts b/a.ts",
      "--- a/a.ts",
      "+++ b/a.ts",
      "@@ -1,1 +1,2 @@",
      " context",
      "+added-top",
      "@@ -10,1 +11,2 @@",
      " context",
      "+added-bottom",
    ].join("\n");

    expect(addedLineNumbers(diffText, "a.ts")).toEqual(new Set([2, 12]));
  });

  it("trả về set rỗng nếu file không nằm trong diff", () => {
    const diffText = [
      "diff --git a/a.ts b/a.ts",
      "--- a/a.ts",
      "+++ b/a.ts",
      "@@ -1,1 +1,2 @@",
      " context",
      "+added",
    ].join("\n");

    expect(addedLineNumbers(diffText, "b.ts")).toEqual(new Set());
  });
});
