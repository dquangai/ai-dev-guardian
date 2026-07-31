import fs from "node:fs";
import path from "node:path";
import madge from "madge";
import type { MadgeInstance } from "madge";

export const TS_JS_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

const MADGE_FILE_EXTENSIONS = ["js", "jsx", "ts", "tsx", "mjs", "cjs"];
const MADGE_EXCLUDE = [/(^|[\\/])(node_modules|dist|\.git|coverage)([\\/]|$)/];

export function toPosix(p: string): string {
  return p.split(path.sep).join("/").replace(/^\.\//, "");
}

/**
 * Shared madge setup for every architecture check (circular-dependency,
 * forbidden-import rules): same file extensions, excludes, and tsconfig
 * detection. Fail-safe — returns null on any madge error (missing tsconfig,
 * unparseable project, ...) instead of throwing; callers treat that as
 * "no violations found", never allowed to block a push on its own failure.
 */
export async function buildMadgeInstance(cwd: string): Promise<MadgeInstance | null> {
  try {
    const tsconfigPath = path.join(cwd, "tsconfig.json");
    return await madge(cwd, {
      fileExtensions: MADGE_FILE_EXTENSIONS,
      excludeRegExp: MADGE_EXCLUDE,
      tsConfig: fs.existsSync(tsconfigPath) ? tsconfigPath : undefined,
    });
  } catch {
    return null;
  }
}
