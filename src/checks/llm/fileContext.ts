import fs from "node:fs";
import path from "node:path";

const DEFAULT_MAX_BYTES = 20_000;

/**
 * Best-effort read of a file's current working-tree content, to give the LLM
 * full-file context beyond the diff hunk. Returns null if the file doesn't
 * exist (e.g. deleted in this diff) or exceeds maxBytes — callers should
 * treat null as "no extra context available", not an error.
 *
 * This reads the working tree rather than reconstructing the exact git blob
 * for the diff's ref (staged index / pushed sha): `guardian check` always
 * runs right before commit/push, so the working tree closely approximates
 * what's about to enter git — an acceptable approximation for MVP context.
 */
export function readFileContextSafe(
  file: string,
  cwd: string = process.cwd(),
  maxBytes: number = DEFAULT_MAX_BYTES
): string | null {
  try {
    const fullPath = path.join(cwd, file);
    const stat = fs.statSync(fullPath);
    if (!stat.isFile() || stat.size > maxBytes) return null;
    return fs.readFileSync(fullPath, "utf-8");
  } catch {
    return null;
  }
}
