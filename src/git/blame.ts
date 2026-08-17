import simpleGit from "simple-git";
import { splitDiffByFile } from "./diffSplitter";

const HUNK_HEADER_PATTERN = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

// Mirrors llmPolicyCheck.ts's isEvidenceGrounded whitespace normalization intentionally — same
// notion of "does this line contain this evidence", just needs the line NUMBER here too, not just
// a boolean, so it can't share that function directly (kept local to avoid an awkward checks/ ->
// git/ dependency in the other direction).
function stripWhitespace(text: string): string {
  return text.replace(/\s+/g, "");
}

/**
 * Post-change line number of the first `+` line in `file`'s diff hunk whose content contains
 * evidenceSnippet's first non-empty line (whitespace-insensitive). Returns null if the file isn't
 * in this diff or no added line matches — never throws, this is a best-effort lookup used only for
 * git-blame author attribution (see blameLine below), not for verdict logic.
 */
export function findEvidenceLine(diffText: string, file: string, evidenceSnippet: string): number | null {
  const segment = splitDiffByFile(diffText).get(file);
  if (!segment) return null;

  const firstSnippetLine = evidenceSnippet
    .split("\n")
    .map(stripWhitespace)
    .find((line) => line.length > 0);
  if (!firstSnippetLine) return null;

  let newLine = 0;
  for (const line of segment.split("\n")) {
    const hunkMatch = HUNK_HEADER_PATTERN.exec(line);
    if (hunkMatch) {
      newLine = Number(hunkMatch[1]);
      continue;
    }
    if (newLine === 0) continue; // still in the "diff --git"/"+++" header, before the first hunk

    if (line.startsWith("+") && !line.startsWith("+++")) {
      if (stripWhitespace(line.slice(1)).includes(firstSnippetLine)) return newLine;
      newLine++;
    } else if (!line.startsWith("-")) {
      newLine++;
    }
  }

  return null;
}

export interface BlameAuthor {
  name: string;
  email: string;
}

/**
 * Last author of `file:line` via `git blame --line-porcelain`. Returns null on any failure
 * (untracked file, line out of range, not inside a git repo, ...) — component ownership is
 * best-effort context for routing a fix, never a reason to fail or slow down the actual check.
 */
export async function blameLine(
  file: string,
  line: number,
  cwd: string = process.cwd()
): Promise<BlameAuthor | null> {
  try {
    const raw = await simpleGit(cwd).raw(["blame", "--line-porcelain", "-L", `${line},${line}`, "--", file]);
    const nameMatch = /^author (.+)$/m.exec(raw);
    if (!nameMatch) return null;
    const emailMatch = /^author-mail <(.+)>$/m.exec(raw);
    return { name: nameMatch[1], email: emailMatch?.[1] ?? "" };
  } catch {
    return null;
  }
}
