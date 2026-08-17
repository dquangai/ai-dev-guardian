import crypto from "node:crypto";
import { isValidRole, type Role } from "./rbac";
import { createUser, getUser, getUserByEmail, listUsers, updateUserTeam, SEED_USER_IDS, type StoredUser } from "./store/userStore";

/** Kept as an alias so route files can keep saying "the user record shape" without caring that
 * it's now backed by store/userStore.ts (JSON, persistent, many users per role) instead of the
 * old in-memory Record<Role, DemoUser>. */
export type DemoUser = StoredUser;

export { SEED_USER_IDS, createUser };

export function findUserByEmail(email: string): DemoUser | null {
  return getUserByEmail(email);
}

/** Only meaningful for `super-admin` now — that's still the one role guaranteed to have exactly
 * one account (routes/teams.ts's requireSuperAdmin, auth.ts's /act-as-team). For the 4 team-scoped
 * roles there can be many people, so callers must look those up by id/email instead. */
export function findUserByRole(role: unknown): DemoUser | null {
  if (!isValidRole(role) || role !== "super-admin") return null;
  return getUser(SEED_USER_IDS["super-admin"]);
}

export function findUserById(userId: string): DemoUser | null {
  return getUser(userId);
}

export function listAllUsers(): DemoUser[] {
  return listUsers();
}

/** T-23: moves/removes a user's team assignment, now persisted (see userStore.ts) instead of
 * mutating an in-memory const — survives a server restart, matching the FGA tuple change a caller
 * makes alongside this so req.teamId (set at next login) and the FGA graph agree. */
export function setUserTeam(userId: string, teamId: string | undefined): void {
  updateUserTeam(userId, teamId);
}

/** All demo accounts share one password (GUARDIAN_DEMO_PASSWORD, root .env) — there's nothing
 * per-user to hash here, the env var itself is the secret, so a direct compare doesn't trade away
 * any real security versus bcrypt-ing a single shared plaintext value. Digests are compared with
 * `timingSafeEqual` (fixed-length, so unequal input lengths don't throw) purely as defense in
 * depth against timing side-channels — not because the shared plaintext itself needs hashing. */
export function checkPassword(password: string): boolean {
  const expected = process.env.GUARDIAN_DEMO_PASSWORD;
  if (!expected) return false;
  const digest = (value: string) => crypto.createHash("sha256").update(value).digest();
  return crypto.timingSafeEqual(digest(password), digest(expected));
}
