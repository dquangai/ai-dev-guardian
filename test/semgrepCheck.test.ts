import path from "node:path";
import { describe, it, expect, vi } from "vitest";
import { checkWithSemgrep, type ExecFileResult } from "../src/checks/semgrepCheck";
import type { DiffResult } from "../src/git/diff";

const FIXTURES_CWD = path.join(__dirname, "fixtures", "llm"); // reuses sample.ts/deleted.ts fixtures

function semgrepOutput(results: unknown[]): string {
  return JSON.stringify({ results });
}

function twoLineDiff(file: string): DiffResult {
  const diffText = [
    `diff --git a/${file} b/${file}`,
    `--- a/${file}`,
    `+++ b/${file}`,
    "@@ -1,1 +1,2 @@",
    " context",
    "+added",
  ].join("\n");
  return { diffText, changedFiles: [file] };
}

function finding(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    check_id: "rule.id",
    path: "sample.ts",
    start: { line: 2 },
    extra: { message: "vấn đề bảo mật", severity: "ERROR" },
    ...overrides,
  };
}

describe("checkWithSemgrep", () => {
  it("trả về [] không throw nếu binary semgrep không tồn tại (ENOENT)", async () => {
    const execFile = vi.fn(async () => {
      const error = new Error("not found") as NodeJS.ErrnoException;
      error.code = "ENOENT";
      throw error;
    });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const violations = await checkWithSemgrep(twoLineDiff("sample.ts"), FIXTURES_CWD, { execFile });

    expect(violations).toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("giữ finding nằm trên dòng mới thêm trong diff, map đúng severity/riskLevel", async () => {
    const execFile = vi.fn(
      async (): Promise<ExecFileResult> => ({ stdout: semgrepOutput([finding({ start: { line: 2 } })]) })
    );

    const violations = await checkWithSemgrep(twoLineDiff("sample.ts"), FIXTURES_CWD, { execFile });

    expect(violations).toHaveLength(1);
    expect(violations[0].source).toBe("semgrep-check");
    expect(violations[0].riskLevel).toBe("high");
    expect(violations[0].policyViolated).toContain("rule.id");
  });

  it("loại bỏ finding nằm trên dòng KHÔNG đổi trong diff (semgrep quét cả file, Guardian chỉ xét diff)", async () => {
    const execFile = vi.fn(
      async (): Promise<ExecFileResult> => ({ stdout: semgrepOutput([finding({ start: { line: 1 } })]) })
    );

    const violations = await checkWithSemgrep(twoLineDiff("sample.ts"), FIXTURES_CWD, { execFile });

    expect(violations).toEqual([]);
  });

  it("map severity WARNING -> medium, INFO -> low", async () => {
    const execFile = vi.fn(async (): Promise<ExecFileResult> => ({
      stdout: semgrepOutput([
        finding({ check_id: "warn.rule", start: { line: 2 }, extra: { message: "m", severity: "WARNING" } }),
        finding({ check_id: "info.rule", start: { line: 2 }, extra: { message: "m", severity: "INFO" } }),
      ]),
    }));

    const violations = await checkWithSemgrep(twoLineDiff("sample.ts"), FIXTURES_CWD, { execFile });

    expect(violations.map((v) => v.riskLevel).sort()).toEqual(["low", "medium"]);
  });

  it("trả về [] không throw nếu stdout không phải JSON hợp lệ", async () => {
    const execFile = vi.fn(async (): Promise<ExecFileResult> => ({ stdout: "not json" }));
    const violations = await checkWithSemgrep(twoLineDiff("sample.ts"), FIXTURES_CWD, { execFile });
    expect(violations).toEqual([]);
  });

  it("không gọi semgrep nếu không có file nào trong diff thực sự tồn tại trên đĩa", async () => {
    const execFile = vi.fn(async (): Promise<ExecFileResult> => ({ stdout: semgrepOutput([]) }));
    const diff: DiffResult = { diffText: "", changedFiles: ["does-not-exist.ts"] };

    const violations = await checkWithSemgrep(diff, FIXTURES_CWD, { execFile });

    expect(execFile).not.toHaveBeenCalled();
    expect(violations).toEqual([]);
  });
});
