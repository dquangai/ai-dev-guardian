import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { Role } from "./rbac";

export interface TokenPayload {
  sub: string; // userId
  role: Role;
  name: string;
  email: string;
  // T-22: absent for org-wide roles (super-admin) — see users.ts's DemoUser.teamId.
  teamId?: string;
}

// GUARDIAN_JWT_SECRET lets a secret survive server restarts (set it for anything longer-lived
// than a single `guardian dashboard` session). Left unset, a fresh random secret is generated at
// boot — every previously issued token stops verifying on restart, which just means "log back
// in"; there's no persisted session store to invalidate, so this fail-safe default costs nothing.
const SECRET = process.env.GUARDIAN_JWT_SECRET || crypto.randomBytes(32).toString("hex");

const SHORT_LIVED = "12h";
const REMEMBER_ME = "30d";

export function signToken(payload: TokenPayload, rememberMe: boolean): string {
  return jwt.sign(payload, SECRET, { expiresIn: rememberMe ? REMEMBER_ME : SHORT_LIVED });
}

/** Returns the verified payload, or null for a missing/invalid/expired/tampered token — callers
 * treat null as "not authenticated" rather than distinguishing the failure reason. */
export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, SECRET) as TokenPayload;
  } catch {
    return null;
  }
}
