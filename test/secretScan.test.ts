import { describe, it, expect } from "vitest";
import { scanForSecrets } from "../src/checks/secretScan";
import type { DiffResult } from "../src/git/diff";

function makeDiff(file: string, lines: Array<{ added?: boolean; text: string }>): DiffResult {
  const diffText = [
    `diff --git a/${file} b/${file}`,
    `--- a/${file}`,
    `+++ b/${file}`,
    `@@ -1,${lines.length} +1,${lines.length} @@`,
    ...lines.map((l) => `${l.added ? "+" : " "}${l.text}`),
  ].join("\n");
  return { diffText, changedFiles: [file] };
}

describe("scanForSecrets", () => {
  it("phát hiện AWS Access Key ID trong dòng added", () => {
    const diff = makeDiff("src/config.ts", [
      { added: true, text: 'const key = "AKIAABCDEFGHIJKLMNOP";' },
    ]);
    const violations = scanForSecrets(diff);
    expect(violations).toHaveLength(1);
    expect(violations[0].source).toBe("secret-scan");
    expect(violations[0].riskLevel).toBe("critical");
    expect(violations[0].errorWhat).toContain("AWS Access Key ID");
    expect(violations[0].errorWhat).toContain("src/config.ts");
  });

  it("phát hiện generic hardcoded api key/token/password", () => {
    const diff = makeDiff("src/app.ts", [
      { added: true, text: 'const apiKey = "sk_live_abcdef123456";' },
    ]);
    const violations = scanForSecrets(diff);
    expect(violations).toHaveLength(1);
    expect(violations[0].errorWhat).toContain("Generic hardcoded API key");
  });

  it("phát hiện PEM private key block", () => {
    const diff = makeDiff("id_rsa", [
      { added: true, text: "-----BEGIN RSA PRIVATE KEY-----" },
    ]);
    const violations = scanForSecrets(diff);
    expect(violations).toHaveLength(1);
    expect(violations[0].errorWhat).toContain("PEM private key block");
  });

  it("không flag dòng bị xoá (removed line) dù chứa pattern secret", () => {
    const file = "src/config.ts";
    const diffText = [
      `diff --git a/${file} b/${file}`,
      `--- a/${file}`,
      `+++ b/${file}`,
      `@@ -1,1 +1,1 @@`,
      `-const key = "AKIAABCDEFGHIJKLMNOP";`,
      `+const key = process.env.AWS_KEY;`,
    ].join("\n");
    const violations = scanForSecrets({ diffText, changedFiles: [file] });
    expect(violations).toHaveLength(0);
  });

  it("trả về mảng rỗng với diff sạch", () => {
    const diff = makeDiff("src/app.ts", [{ added: true, text: "export const answer = 42;" }]);
    expect(scanForSecrets(diff)).toEqual([]);
  });

  it("mask giá trị secret trong message thay vì lộ full", () => {
    const diff = makeDiff("src/config.ts", [
      { added: true, text: 'const key = "AKIAABCDEFGHIJKLMNOP";' },
    ]);
    const violations = scanForSecrets(diff);
    expect(violations[0].errorWhat).not.toContain("AKIAABCDEFGHIJKLMNOP");
  });
});
