import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// Lives under .git/ — never tracked/pushed, safe to store local scan state.
export const DEFAULT_CACHE_PATH = ".git/guardian_cache.json";

// Keeps the check cheap when switching between branches: a diff hash that
// PASSed on branch A shouldn't need re-checking just because branch B's
// push wrote a different hash in between.
const MAX_CACHED_HASHES = 20;

export interface GuardianCache {
  passedDiffHashes: string[];
}

/** SHA-256 hex digest of the diff text — used as the cache key. */
export function hashDiffText(diffText: string): string {
  return crypto.createHash("sha256").update(diffText).digest("hex");
}

function resolveCachePath(cwd: string): string {
  return path.join(cwd, DEFAULT_CACHE_PATH);
}

/**
 * Reads the diff hashes of recent PASS verdicts. Returns null on any failure
 * (no cache yet, corrupt JSON, not inside a git repo, ...) — caching is a
 * pure optimization and must never block or alter the actual check.
 */
export function readCache(cwd: string = process.cwd()): GuardianCache | null {
  try {
    const raw = fs.readFileSync(resolveCachePath(cwd), "utf-8");
    const parsed: unknown = JSON.parse(raw);
    const hashes = (parsed as Partial<GuardianCache> | null)?.passedDiffHashes;
    if (!Array.isArray(hashes) || !hashes.every((h) => typeof h === "string")) return null;
    return { passedDiffHashes: hashes };
  } catch {
    return null;
  }
}

/**
 * Records the diff hash of a PASS verdict, most-recent first, deduplicated
 * and capped at MAX_CACHED_HASHES. Silently no-ops on failure (e.g. .git
 * missing, read-only filesystem) — same reasoning as above.
 */
export function writeCache(diffHash: string, cwd: string = process.cwd()): void {
  try {
    const existing = readCache(cwd)?.passedDiffHashes ?? [];
    const passedDiffHashes = [diffHash, ...existing.filter((h) => h !== diffHash)].slice(
      0,
      MAX_CACHED_HASHES
    );
    const cache: GuardianCache = { passedDiffHashes };
    fs.writeFileSync(resolveCachePath(cwd), JSON.stringify(cache, null, 2), "utf-8");
  } catch {
    // best-effort — a failed write should never affect the check result.
  }
}
