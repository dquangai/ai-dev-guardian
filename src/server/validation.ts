/** Shared request-input validation for route handlers — never trust req.query/req.params/req.body verbatim. */

const SAFE_ID_PATTERN = /^[\w.-]{1,120}$/;

/** True for route-param/body ids matching the shape every id in this app is generated with (see JsonArrayStore-backed stores). */
export function isSafeId(value: unknown): value is string {
  return typeof value === "string" && SAFE_ID_PATTERN.test(value);
}

/** Parses a query param into a bounded positive integer, falling back to `fallback` for anything else (missing, NaN, negative, non-numeric junk). */
export function parseBoundedInt(value: unknown, fallback: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

/** Returns `value` only if it's a string in `allowed`; otherwise undefined (treated as "no filter" by callers). */
export function parseEnumQuery<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

/** True for an optional string field (e.g. a body field that's either absent or a real string) — rejects non-string junk like objects/arrays. */
export function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}
