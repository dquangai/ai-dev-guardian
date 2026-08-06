import { isValidRole, type Role } from "./rbac";

export interface DemoUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

/**
 * There is still no real backend user store (see README RBAC section) — but unlike before,
 * this directory and the password check below now live server-side only. The client never sees
 * a plaintext password or this list; it gets back a signed token and the single user object it
 * logged in as, via POST /api/auth/login or /api/auth/demo-login.
 */
export const DEMO_USERS: Record<Role, DemoUser> = {
  admin: { id: "admin-1", name: "Alex Morgan", email: "admin@guardian.dev", role: "admin" },
  // T-21: org-wide role (Sprint 3 multi-team) — not scoped to any single team, see authz/model.fga.
  "super-admin": {
    id: "super-admin-1",
    name: "Taylor Nguyen",
    email: "super.admin@guardian.dev",
    role: "super-admin",
  },
  "senior-dev": {
    id: "senior-dev-1",
    name: "Jordan Lee",
    email: "senior.dev@guardian.dev",
    role: "senior-dev",
  },
  developer: { id: "developer-1", name: "Sam Rivera", email: "dev@guardian.dev", role: "developer" },
  auditor: { id: "auditor-1", name: "Riley Chen", email: "auditor@guardian.dev", role: "auditor" },
};

export function findUserByEmail(email: string): DemoUser | null {
  const normalized = email.trim().toLowerCase();
  return Object.values(DEMO_USERS).find((u) => u.email.toLowerCase() === normalized) ?? null;
}

export function findUserByRole(role: unknown): DemoUser | null {
  return isValidRole(role) ? DEMO_USERS[role] : null;
}

/** All four demo accounts share one password (GUARDIAN_DEMO_PASSWORD, root .env) — there's
 * nothing per-user to hash here, the env var itself is the secret, so a direct compare doesn't
 * trade away any real security versus bcrypt-ing a single shared plaintext value. */
export function checkPassword(password: string): boolean {
  const expected = process.env.GUARDIAN_DEMO_PASSWORD;
  return Boolean(expected) && password === expected;
}
