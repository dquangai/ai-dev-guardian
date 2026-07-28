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

// --- Inter-file context ("RAG-lite"): pull in local files the changed file
// imports, so the LLM can see type/interface/function definitions the diff
// depends on, without needing a real embedding/retrieval pipeline. ---

const MAX_SATELLITE_FILES = 3;
const SATELLITE_MAX_BYTES = 10_000;

// Matches `import ... from "spec"` and bare `import "spec"`. Not a real
// parser — good enough to find specifiers for an MVP, per the deliberately
// lightweight scope of this feature.
const IMPORT_REGEX = /import\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g;

// Local relative imports only — anything else is a package (node_modules),
// a subpath import alias, or a Node builtin, none of which are useful/safe
// to read off the local filesystem here.
const LOCAL_IMPORT_PATTERN = /^\.\.?\//;

const RESOLVE_CANDIDATE_SUFFIXES = ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx"];

export interface SatelliteFile {
  /** The raw specifier as written in the source, e.g. "./types". */
  importPath: string;
  /** Resolved path (forward-slash, relative to cwd) actually read. */
  resolvedPath: string;
  content: string;
}

/** Extracts local (./ or ../) import specifiers from source code, in order, de-duplicated. */
function extractLocalImportSpecifiers(sourceCode: string): string[] {
  const specifiers: string[] = [];
  const seen = new Set<string>();

  for (const match of sourceCode.matchAll(IMPORT_REGEX)) {
    const specifier = match[1];
    if (!LOCAL_IMPORT_PATTERN.test(specifier) || seen.has(specifier)) continue;
    seen.add(specifier);
    specifiers.push(specifier);
  }

  return specifiers;
}

/** Resolves a local import specifier (relative to `fromFile`) to an existing file, trying common extensions. */
function resolveLocalImportPath(fromFile: string, specifier: string, cwd: string): string | null {
  const basePath = path
    .join(path.dirname(fromFile), specifier)
    .split(path.sep)
    .join("/");

  for (const suffix of RESOLVE_CANDIDATE_SUFFIXES) {
    const candidate = `${basePath}${suffix}`;
    try {
      if (fs.statSync(path.join(cwd, candidate)).isFile()) return candidate;
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Best-effort "inter-file RAG": extracts local import specifiers from the
 * changed file's own (already-read) content, resolves up to
 * MAX_SATELLITE_FILES of them, and reads their content (each capped at
 * SATELLITE_MAX_BYTES) — so the LLM sees the type/interface/function
 * definitions the diff actually depends on, at bounded token cost.
 *
 * Fully fail-safe: any error extracting, resolving, or reading a given
 * import is silently swallowed and that import is skipped — this is a
 * best-effort context enrichment, never allowed to crash the check.
 */
export function readSatelliteFiles(
  file: string,
  fileContent: string | null,
  cwd: string = process.cwd()
): SatelliteFile[] {
  if (!fileContent) return [];

  const satellites: SatelliteFile[] = [];

  try {
    for (const importPath of extractLocalImportSpecifiers(fileContent)) {
      if (satellites.length >= MAX_SATELLITE_FILES) break;

      try {
        const resolvedPath = resolveLocalImportPath(file, importPath, cwd);
        if (!resolvedPath || resolvedPath === file) continue;

        const content = readFileContextSafe(resolvedPath, cwd, SATELLITE_MAX_BYTES);
        if (content === null) continue;

        satellites.push({ importPath, resolvedPath, content });
      } catch {
        // fail-safe: skip this one import, keep going
      }
    }
  } catch {
    // fail-safe: never let RAG context gathering crash the check
  }

  return satellites;
}
