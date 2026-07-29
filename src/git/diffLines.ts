import { splitDiffByFile } from "./diffSplitter";

const HUNK_HEADER_PATTERN = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

/**
 * Line numbers (in the post-change file) of every `+` line added to `file`
 * in this diff. Used to cross-reference findings from a tool that scans the
 * whole file (like Semgrep) against only the lines this diff actually
 * touches — Guardian only ever judges the diff, never pre-existing code.
 */
export function addedLineNumbers(diffText: string, file: string): Set<number> {
  const segment = splitDiffByFile(diffText).get(file);
  const lineNumbers = new Set<number>();
  if (!segment) return lineNumbers;

  let newLine = 0;
  for (const line of segment.split("\n")) {
    const hunkMatch = HUNK_HEADER_PATTERN.exec(line);
    if (hunkMatch) {
      newLine = Number(hunkMatch[1]);
      continue;
    }
    if (newLine === 0) continue; // still in the "diff --git"/"+++" header, before the first hunk

    if (line.startsWith("+")) {
      lineNumbers.add(newLine);
      newLine++;
    } else if (!line.startsWith("-")) {
      newLine++;
    }
  }

  return lineNumbers;
}
