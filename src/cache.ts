import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// Lives under .git/ — never tracked/pushed, safe to store local scan state.
export const DEFAULT_CACHE_PATH = ".git/guardian_cache.json";

export interface GuardianCache {
  lastPassDiffHash: string;
}

/** SHA-256 hex digest of the diff text — used as the cache key. */
export function hashDiffText(diffText: string): string {
  return crypto.createHash("sha256").update(diffText).digest("hex");
}

function resolveCachePath(cwd: string): string {
  return path.join(cwd, DEFAULT_CACHE_PATH);
}

/**
 * Reads the diff hash of the last PASS verdict. Returns null on any failure
 * (no cache yet, corrupt JSON, not inside a git repo, ...) — caching is a
 * pure optimization and must never block or alter the actual check.
 */
export function readCache(cwd: string = process.cwd()): GuardianCache | null {
  try {
    const raw = fs.readFileSync(resolveCachePath(cwd), "utf-8");
    const parsed: unknown = JSON.parse(raw);
    const hash = (parsed as Partial<GuardianCache> | null)?.lastPassDiffHash;
    return typeof hash === "string" ? { lastPassDiffHash: hash } : null;
  } catch {
    return null;
  }
}

/**
 * Persists the diff hash of the most recent PASS verdict. Silently no-ops on
 * failure (e.g. .git missing, read-only filesystem) — same reasoning as above.
 */
export function writeCache(diffHash: string, cwd: string = process.cwd()): void {
  try {
    const cache: GuardianCache = { lastPassDiffHash: diffHash };
    fs.writeFileSync(resolveCachePath(cwd), JSON.stringify(cache, null, 2), "utf-8");
  } catch {
    // best-effort — a failed write should never affect the check result.
  }
}
