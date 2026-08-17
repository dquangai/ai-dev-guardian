import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { blameLine, findEvidenceLine } from "../src/git/blame";

describe("findEvidenceLine — suy ra line number từ evidence khớp trong diff", () => {
  const DIFF = [
    "diff --git a/src/users.ts b/src/users.ts",
    "--- a/src/users.ts",
    "+++ b/src/users.ts",
    "@@ -10,3 +10,4 @@",
    " function checkPassword(password: string): boolean {",
    "+  const expected = process.env.GUARDIAN_DEMO_PASSWORD;",
    "+  return password === expected;",
    " }",
    " ",
  ].join("\n");

  it("tìm đúng line number (post-change) của dòng thêm mới khớp evidence", () => {
    expect(findEvidenceLine(DIFF, "src/users.ts", "return password === expected;")).toBe(12);
  });

  it("whitespace-tolerant — khớp dù evidence model trích khác khoảng trắng", () => {
    expect(findEvidenceLine(DIFF, "src/users.ts", "return   password===expected;")).toBe(12);
  });

  it("file không có trong diff -> null", () => {
    expect(findEvidenceLine(DIFF, "src/other.ts", "return password === expected;")).toBeNull();
  });

  it("evidence không khớp dòng nào -> null", () => {
    expect(findEvidenceLine(DIFF, "src/users.ts", "this line does not exist")).toBeNull();
  });

  it("evidenceSnippet rỗng -> null", () => {
    expect(findEvidenceLine(DIFF, "src/users.ts", "")).toBeNull();
  });
});

describe("blameLine() — git blame thật trên 1 repo tmp thật", () => {
  let tmpDir: string;
  const AUTHOR_NAME = "Nguyễn Test Blame";
  const AUTHOR_EMAIL = "test-blame@guardian.dev";

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "guardian-blame-test-"));
    execFileSync("git", ["init", "-q"], { cwd: tmpDir });
    execFileSync("git", ["config", "user.name", AUTHOR_NAME], { cwd: tmpDir });
    execFileSync("git", ["config", "user.email", AUTHOR_EMAIL], { cwd: tmpDir });
    fs.writeFileSync(
      path.join(tmpDir, "users.ts"),
      ["function checkPassword(password: string): boolean {", "  return password === expected;", "}", ""].join(
        "\n"
      )
    );
    execFileSync("git", ["add", "users.ts"], { cwd: tmpDir });
    execFileSync("git", ["commit", "-q", "-m", "add checkPassword"], { cwd: tmpDir });
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("trả đúng tác giả (tên + email) của dòng thật trong repo git thật", async () => {
    const author = await blameLine("users.ts", 2, tmpDir);
    expect(author).toEqual({ name: AUTHOR_NAME, email: AUTHOR_EMAIL });
  });

  it("file không tồn tại -> null, không throw", async () => {
    const author = await blameLine("khong-ton-tai.ts", 1, tmpDir);
    expect(author).toBeNull();
  });

  it("cwd không phải git repo -> null, không throw", async () => {
    const notGitDir = fs.mkdtempSync(path.join(os.tmpdir(), "guardian-blame-nogit-"));
    try {
      const author = await blameLine("users.ts", 1, notGitDir);
      expect(author).toBeNull();
    } finally {
      fs.rmSync(notGitDir, { recursive: true, force: true });
    }
  });
});
