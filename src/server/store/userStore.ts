import crypto from "node:crypto";
import path from "node:path";
import { DEFAULT_POLICY_DIR } from "../../policy/loader";
import type { Role } from "../rbac";
import { JsonArrayStore } from "./jsonStore";

/** Persistent replacement for the old hard-coded `DEMO_USERS` const in users.ts — same shape
 * (id/name/email/role/teamId), now backed by a JSON file so team assignment survives a server
 * restart and more than one person per role/team can exist at once (see users.ts for the lookup
 * helpers built on top of this store). */
export interface StoredUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  teamId?: string;
  createdAt: string;
  createdBy: string;
}

const USERS_PATH = path.join(DEFAULT_POLICY_DIR, "..", "users.json");
const store = new JsonArrayStore<StoredUser>(USERS_PATH);

const DEFAULT_TEAM_ID = "team-default";
const SYSTEM_CREATED_BY = "system-seed";

/** The 5 original fixed demo accounts (same ids/emails as the old DEMO_USERS const) — every
 * caller that needs "the" admin/senior-dev/developer/auditor/super-admin seed account looks it up
 * by id here rather than assuming a role maps to exactly one user, which stopped being true once
 * more people/teams can be added (see routes/teams.ts POST /users, authz/seedDemoOrg.ts). */
export const SEED_USER_IDS: Record<Role, string> = {
  admin: "admin-1",
  "super-admin": "super-admin-1",
  "senior-dev": "senior-dev-1",
  developer: "developer-1",
  auditor: "auditor-1",
};

function seedUsers(): StoredUser[] {
  const now = new Date().toISOString();
  const base = { createdAt: now, createdBy: SYSTEM_CREATED_BY };
  return [
    { ...base, id: SEED_USER_IDS.admin, name: "Nguyễn Văn An", email: "admin@guardian.dev", role: "admin", teamId: DEFAULT_TEAM_ID },
    { ...base, id: SEED_USER_IDS["super-admin"], name: "Trần Minh Đức", email: "super.admin@guardian.dev", role: "super-admin" },
    { ...base, id: SEED_USER_IDS["senior-dev"], name: "Lê Thị Hương", email: "senior.dev@guardian.dev", role: "senior-dev", teamId: DEFAULT_TEAM_ID },
    { ...base, id: SEED_USER_IDS.developer, name: "Phạm Quang Huy", email: "dev@guardian.dev", role: "developer", teamId: DEFAULT_TEAM_ID },
    { ...base, id: SEED_USER_IDS.auditor, name: "Vũ Thị Lan", email: "auditor@guardian.dev", role: "auditor", teamId: DEFAULT_TEAM_ID },
  ];
}

/** Runs on every read so a brand-new `.guardian/` (fresh clone, fresh test tmp dir) always has the
 * 5 original accounts available without anyone having to run a migration script first — mirrors
 * the old DEMO_USERS const always being present in memory. Idempotent: only writes when the file
 * is genuinely empty, never overwrites accounts a caller has already created/modified. */
function ensureSeeded(): StoredUser[] {
  const existing = store.readAll();
  if (existing.length > 0) return existing;
  const seeded = seedUsers();
  store.writeAll(seeded);
  return seeded;
}

export function listUsers(): StoredUser[] {
  return ensureSeeded();
}

export function getUser(id: string): StoredUser | null {
  return ensureSeeded().find((u) => u.id === id) ?? null;
}

export function getUserByEmail(email: string): StoredUser | null {
  const normalized = email.trim().toLowerCase();
  return ensureSeeded().find((u) => u.email.toLowerCase() === normalized) ?? null;
}

export function createUser(input: { name: string; email: string; role: Role; teamId?: string; createdBy: string }): StoredUser {
  if (getUserByEmail(input.email)) {
    throw new Error(`User with email "${input.email}" already exists.`);
  }
  const user: StoredUser = {
    id: `user-${crypto.randomBytes(4).toString("hex")}`,
    name: input.name,
    email: input.email,
    role: input.role,
    teamId: input.teamId,
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy,
  };
  store.append(user);
  return user;
}

/** Mirrors the old setUserTeam(role, teamId) but keyed by user id, since role no longer identifies
 * a single user. In-memory callers (routes/teams.ts) still pair this with the matching OpenFGA
 * tuple write/delete — this function only owns the persisted `teamId` field. */
export function updateUserTeam(id: string, teamId: string | undefined): void {
  const users = ensureSeeded();
  const next = users.map((u) => (u.id === id ? { ...u, teamId } : u));
  store.writeAll(next);
}
