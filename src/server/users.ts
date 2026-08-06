import { isValidRole, type Role } from "./rbac";

export interface DemoUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  // T-22: which OpenFGA team this user acts within — absent for super-admin (org-wide, no
  // single team). See authz/migrateTeamDefault.ts for the matching tuples.
  teamId?: string;
}

/**
 * There is still no real backend user store (see README RBAC section) — but unlike before,
 * this directory and the password check below now live server-side only. The client never sees
 * a plaintext password or this list; it gets back a signed token and the single user object it
 * logged in as, via POST /api/auth/login or /api/auth/demo-login.
 */
const DEFAULT_TEAM_ID = "team-default";

export const DEMO_USERS: Record<Role, DemoUser> = {
  admin: { id: "admin-1", name: "Alex Morgan", email: "admin@guardian.dev", role: "admin", teamId: DEFAULT_TEAM_ID },
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
    teamId: DEFAULT_TEAM_ID,
  },
  developer: {
    id: "developer-1",
    name: "Sam Rivera",
    email: "dev@guardian.dev",
    role: "developer",
    teamId: DEFAULT_TEAM_ID,
  },
  auditor: {
    id: "auditor-1",
    name: "Riley Chen",
    email: "auditor@guardian.dev",
    role: "auditor",
    teamId: DEFAULT_TEAM_ID,
  },
};

export function findUserByEmail(email: string): DemoUser | null {
  const normalized = email.trim().toLowerCase();
  return Object.values(DEMO_USERS).find((u) => u.email.toLowerCase() === normalized) ?? null;
}

export function findUserByRole(role: unknown): DemoUser | null {
  return isValidRole(role) ? DEMO_USERS[role] : null;
}

export function findUserById(userId: string): DemoUser | null {
  return Object.values(DEMO_USERS).find((u) => u.id === userId) ?? null;
}

/** T-23: moves/removes a demo user's team assignment. In-memory only (matches the rest of
 * DEMO_USERS — not persisted across a server restart), mirroring the OpenFGA tuple change a
 * caller makes alongside this so `req.teamId` (set at next login) and the FGA graph agree. Caller
 * is responsible for only invoking this with a team-scoped role (see authz/migrateTeamDefault.ts's
 * TEAM_SCOPED_ROLES) — super-admin has no single team by design. */
export function setUserTeam(role: Role, teamId: string | undefined): void {
  DEMO_USERS[role].teamId = teamId;
}

/** All four demo accounts share one password (GUARDIAN_DEMO_PASSWORD, root .env) — there's
 * nothing per-user to hash here, the env var itself is the secret, so a direct compare doesn't
 * trade away any real security versus bcrypt-ing a single shared plaintext value. */
export function checkPassword(password: string): boolean {
  const expected = process.env.GUARDIAN_DEMO_PASSWORD;
  return Boolean(expected) && password === expected;
}
