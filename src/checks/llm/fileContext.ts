import fs from "node:fs";
import path from "node:path";
import { parse as parseAstGrep, Lang } from "@ast-grep/napi";

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
// depends on, without needing a real embedding/retrieval pipeline. Not a
// real parser for any of these languages — good enough to find specifiers
// for an MVP, per the deliberately lightweight scope of this feature. ---

const MAX_SATELLITE_FILES = 3;
const SATELLITE_MAX_BYTES = 10_000;

export interface SatelliteFile {
  /** The raw specifier as written in the source, e.g. "./types". */
  importPath: string;
  /** Resolved path (forward-slash, relative to cwd) actually read. */
  resolvedPath: string;
  content: string;
}

export type Language = "ts" | "py" | "c" | "go";

const LANGUAGE_EXTENSIONS: Record<Language, string[]> = {
  ts: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"],
  py: [".py"],
  c: [".c", ".h", ".cc", ".cpp", ".cxx", ".hpp", ".hh", ".hxx"],
  go: [".go"],
};

export function detectLanguage(file: string): Language | null {
  const ext = path.extname(file).toLowerCase();
  for (const lang of Object.keys(LANGUAGE_EXTENSIONS) as Language[]) {
    if (LANGUAGE_EXTENSIONS[lang].includes(ext)) return lang;
  }
  return null;
}

function joinAsPosix(...segments: string[]): string {
  return path.join(...segments).split(path.sep).join("/");
}

/** Tries each candidate `${basePath}${suffix}` in order, returning the first that exists as a file. */
function resolveWithSuffixes(basePath: string, suffixes: string[], cwd: string): string | null {
  for (const suffix of suffixes) {
    const candidate = `${basePath}${suffix}`;
    try {
      if (fs.statSync(path.join(cwd, candidate)).isFile()) return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

/** Collects unique capture-group-1 matches of `regex` against `sourceCode`, in order. */
function dedupCaptures(sourceCode: string, regex: RegExp): string[] {
  const specifiers: string[] = [];
  const seen = new Set<string>();
  for (const match of sourceCode.matchAll(regex)) {
    if (!seen.has(match[1])) {
      seen.add(match[1]);
      specifiers.push(match[1]);
    }
  }
  return specifiers;
}

// --- TS/JS: `import ... from "spec"` / bare `import "spec"`. Local only
// (./ or ../) — anything else is a package (node_modules), a subpath import
// alias, or a Node builtin, none of which are useful/safe to read here. ---

const TS_IMPORT_REGEX = /import\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g;
const TS_LOCAL_PATTERN = /^\.\.?\//;
const TS_RESOLVE_SUFFIXES = ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx"];

const AST_GREP_CALL_NAMES = new Set(["require", "import"]);

export function astGrepLangFor(file: string): Lang {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".tsx" || ext === ".jsx") return Lang.Tsx;
  if (ext === ".ts") return Lang.TypeScript;
  return Lang.JavaScript; // .js, .mjs, .cjs
}

/**
 * Real parser (tree-sitter via ast-grep) instead of a regex — correctly
 * handles `import type {...}`, `export {...} from "..."` re-exports, and
 * `require("...")`/dynamic `import("...")` calls that TS_IMPORT_REGEX misses.
 */
function extractTsSpecifiersWithAstGrep(file: string, sourceCode: string): string[] {
  const root = parseAstGrep(astGrepLangFor(file), sourceCode).root();
  const specifiers: string[] = [];
  const seen = new Set<string>();
  const add = (raw: string | null | undefined) => {
    if (raw && !seen.has(raw)) {
      seen.add(raw);
      specifiers.push(raw);
    }
  };

  for (const kind of ["import_statement", "export_statement"]) {
    for (const node of root.findAll({ rule: { kind } })) {
      const source = node.field("source")?.text();
      add(source ? source.slice(1, -1) : null); // strip surrounding quotes
    }
  }

  for (const node of root.findAll({ rule: { kind: "call_expression" } })) {
    const fnName = node.field("function")?.text();
    if (!fnName || !AST_GREP_CALL_NAMES.has(fnName)) continue;
    add(node.find({ rule: { kind: "string_fragment" } })?.text());
  }

  return specifiers;
}

/**
 * Tries the real parser first; falls back to the regex extractor if parsing
 * throws (unsupported syntax) or comes back empty (tree-sitter is fault
 * tolerant and rarely throws outright, so an empty result is the more likely
 * failure signal — and a false-positive fallback here just costs re-running
 * a cheap regex, never produces wrong data).
 */
function extractTsSpecifiers(file: string, sourceCode: string): string[] {
  try {
    const specifiers = extractTsSpecifiersWithAstGrep(file, sourceCode);
    if (specifiers.length > 0) return specifiers;
  } catch {
    // fall through to the regex fallback below
  }
  return dedupCaptures(sourceCode, TS_IMPORT_REGEX);
}

function resolveTsImportPath(fromFile: string, specifier: string, cwd: string): string | null {
  if (!TS_LOCAL_PATTERN.test(specifier)) return null;
  return resolveWithSuffixes(joinAsPosix(path.dirname(fromFile), specifier), TS_RESOLVE_SUFFIXES, cwd);
}

// --- Python: `from .foo.bar import x` / `from . import x`. Relative
// imports only (leading dot) — plain `import pkg` is always a top-level
// package, never a same-project relative file. ---

const PY_IMPORT_REGEX = /^\s*from\s+(\.[\w.]*)\s+import\s*([^\n]*)/gm;

/**
 * `from . import pkg` (bare dots) names the current/parent package itself —
 * the actual submodule being addressed is the first name after `import`, so
 * fold it into the specifier as ".pkg" for resolution. A module already
 * named after the dots (`from .a import X`) doesn't need this: `.a` already
 * points at the right file, and `X` is just a name defined inside it.
 */
function extractPySpecifiers(sourceCode: string): string[] {
  const specifiers: string[] = [];
  const seen = new Set<string>();

  for (const match of sourceCode.matchAll(PY_IMPORT_REGEX)) {
    const pkg = match[1];
    const isBarePackage = /^\.+$/.test(pkg);
    // undefined for "*", "(" (multi-line parenthesized import) — nothing usable to fold in.
    const firstName = match[2].match(/^([A-Za-z_]\w*)/)?.[1];
    const specifier = isBarePackage && firstName ? `${pkg}${firstName}` : pkg;

    if (!seen.has(specifier)) {
      seen.add(specifier);
      specifiers.push(specifier);
    }
  }

  return specifiers;
}

function resolvePyImportPath(fromFile: string, specifier: string, cwd: string): string | null {
  const match = specifier.match(/^(\.+)(.*)$/);
  if (!match) return null;

  // First dot = current package (this file's directory); each extra dot walks up one more.
  let dir = path.dirname(fromFile);
  for (let i = 1; i < match[1].length; i++) dir = path.dirname(dir);

  const rest = match[2].replace(/\./g, "/"); // "foo.bar" -> "foo/bar"
  const basePath = joinAsPosix(dir, rest);
  // "from . import x" (rest === "") can only resolve to the package's own __init__.py.
  const suffixes = rest ? [".py", "/__init__.py"] : ["/__init__.py"];
  return resolveWithSuffixes(basePath, suffixes, cwd);
}

// --- C/C++: `#include "relative/path.h"`. Quote form only — angle-bracket
// `#include <...>` is always a system/library header, never local. ---

const C_INCLUDE_REGEX = /^\s*#include\s+"([^"]+)"/gm;

function extractCSpecifiers(sourceCode: string): string[] {
  return dedupCaptures(sourceCode, C_INCLUDE_REGEX);
}

function resolveCImportPath(fromFile: string, specifier: string, cwd: string): string | null {
  return resolveWithSuffixes(joinAsPosix(path.dirname(fromFile), specifier), [""], cwd);
}

// --- Go: `import "module/path/pkg"`, single or grouped `import (...)`.
// Local when prefixed by this module's own go.mod path. Go imports name a
// *package directory*, not a file, so resolution reads the first non-test
// .go file in that directory as a representative satellite. ---

const GO_IMPORT_BLOCK_REGEX = /import\s*\(([\s\S]*?)\)/g;
const GO_IMPORT_LINE_REGEX = /"([^"]+)"/g;
const GO_SINGLE_IMPORT_REGEX = /^\s*import\s+(?:\w+\s+)?"([^"]+)"/gm;

function extractGoSpecifiers(sourceCode: string): string[] {
  const specifiers: string[] = [];
  const seen = new Set<string>();
  const add = (raw: string) => {
    if (!seen.has(raw)) {
      seen.add(raw);
      specifiers.push(raw);
    }
  };

  for (const block of sourceCode.matchAll(GO_IMPORT_BLOCK_REGEX)) {
    for (const line of block[1].matchAll(GO_IMPORT_LINE_REGEX)) add(line[1]);
  }
  for (const single of sourceCode.matchAll(GO_SINGLE_IMPORT_REGEX)) add(single[1]);

  return specifiers;
}

function readGoModuleName(cwd: string): string | null {
  try {
    const content = fs.readFileSync(path.join(cwd, "go.mod"), "utf-8");
    return content.match(/^module\s+(\S+)/m)?.[1] ?? null;
  } catch {
    return null;
  }
}

function resolveGoImportPath(specifier: string, cwd: string, moduleName: string | null): string | null {
  if (!moduleName || !specifier.startsWith(`${moduleName}/`)) return null;

  const dirPath = specifier.slice(moduleName.length + 1);
  try {
    const fullDir = path.join(cwd, dirPath);
    if (!fs.statSync(fullDir).isDirectory()) return null;

    const goFiles = fs
      .readdirSync(fullDir)
      .filter((f) => f.endsWith(".go") && !f.endsWith("_test.go"))
      .sort();
    return goFiles.length > 0 ? `${dirPath}/${goFiles[0]}` : null;
  } catch {
    return null;
  }
}

/**
 * Best-effort "inter-file RAG": extracts local import/include specifiers
 * from the changed file's own (already-read) content, resolves up to
 * MAX_SATELLITE_FILES of them, and reads their content (each capped at
 * SATELLITE_MAX_BYTES) — so the LLM sees the type/interface/function
 * definitions the diff actually depends on, at bounded token cost.
 * Supports TS/JS, Python, C/C++, and Go; any other file extension yields no
 * satellites.
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

  const language = detectLanguage(file);
  if (!language) return [];

  const satellites: SatelliteFile[] = [];
  // Read once per call, not once per specifier — go.mod doesn't change mid-scan.
  const goModuleName = language === "go" ? readGoModuleName(cwd) : null;

  try {
    const specifiers =
      language === "ts"
        ? extractTsSpecifiers(file, fileContent)
        : language === "py"
          ? extractPySpecifiers(fileContent)
          : language === "c"
            ? extractCSpecifiers(fileContent)
            : extractGoSpecifiers(fileContent);

    for (const importPath of specifiers) {
      if (satellites.length >= MAX_SATELLITE_FILES) break;

      try {
        const resolvedPath =
          language === "ts"
            ? resolveTsImportPath(file, importPath, cwd)
            : language === "py"
              ? resolvePyImportPath(file, importPath, cwd)
              : language === "c"
                ? resolveCImportPath(file, importPath, cwd)
                : resolveGoImportPath(importPath, cwd, goModuleName);
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
