/**
 * Builds a unified-diff string for a brand-new file (`--- /dev/null`) purely from in-memory
 * content — no real file on disk, no git repo required. Used to feed `runGuardianCheck()` a
 * synthetic `DiffResult` for content that was never actually committed: `eval/dataset/cases.ts`'s
 * golden dataset, and `src/server/routes/playground.ts`'s fixed demo scenarios.
 *
 * Safe as input to the real checkers: `readFileContextSafe` just returns null for a path that
 * doesn't exist on disk, which is a normal, fail-open path the LLM check already handles (see
 * src/checks/llm/fileContext.ts) — no special-casing needed downstream.
 */
export function newFileDiff(file: string, contentLines: string[]): string {
  return [
    `diff --git a/${file} b/${file}`,
    `new file mode 100644`,
    `index 0000000..1111111`,
    `--- /dev/null`,
    `+++ b/${file}`,
    `@@ -0,0 +1,${contentLines.length} @@`,
    ...contentLines.map((line) => `+${line}`),
  ].join("\n");
}
