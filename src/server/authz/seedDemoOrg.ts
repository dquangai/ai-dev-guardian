/**
 * T-25: idempotent (re-runnable) demo-roster seed — creates 4 technical teams (Backend, Mobile,
 * Security, DevOps), each with its own admin/senior-dev/developer/auditor, and writes the matching
 * OpenFGA tuples so `team-default`'s 4 fixed accounts aren't the only people who can ever exist.
 * Built for the V-ID pitch demo (multiple real teams with their own people, not everyone sharing
 * the same 4 accounts) — run via `npm run authz:seed-demo-org` after `authz:migrate`/`authz:demo-up`
 * (needs FGA_API_URL/FGA_STORE_ID/FGA_MODEL_ID pointed at a running instance, same as
 * migrateTeamDefault.ts).
 */
import { createTeam, getTeam } from "../store/teamStore";
import { createUser, findUserByEmail, SEED_USER_IDS, type DemoUser } from "../users";
import { ORG_ID, TEAM_SCOPED_ROLES } from "./migrateTeamDefault";
import { writeTuples, type Tuple } from "./fgaClient";

interface DemoTeamSpec {
  id: string;
  name: string;
  emailSlug: string;
}

export const DEMO_TEAMS: DemoTeamSpec[] = [
  { id: "team-backend", name: "Backend Team", emailSlug: "backend" },
  { id: "team-mobile", name: "Mobile Team", emailSlug: "mobile" },
  { id: "team-security", name: "Security Team", emailSlug: "security" },
  { id: "team-devops", name: "DevOps Team", emailSlug: "devops" },
];

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  admin: "Quản trị viên",
  "senior-dev": "Trưởng nhóm",
  developer: "Lập trình viên",
  auditor: "Kiểm toán viên",
};

/** Reuses an existing account by email if this has already run before (idempotent), otherwise
 * creates a brand-new one — never throws on "already exists" the way a bare createUser() would. */
function ensureUser(spec: DemoTeamSpec, role: (typeof TEAM_SCOPED_ROLES)[number]["role"]): DemoUser {
  const email = `${role}@${spec.emailSlug}.guardian.dev`;
  const existing = findUserByEmail(email);
  if (existing) return existing;
  return createUser({
    name: `${ROLE_DISPLAY_NAMES[role]} ${spec.name}`,
    email,
    role,
    teamId: spec.id,
    createdBy: SEED_USER_IDS["super-admin"],
  });
}

export function buildDemoOrgTuples(users: { user: DemoUser; relation: string; teamId: string }[]): Tuple[] {
  const tuples: Tuple[] = [];
  for (const spec of DEMO_TEAMS) {
    // Same T-19 gotcha as team-default: unlinked from org == invisible to super_admin's inheritance.
    tuples.push({ user: `organization:${ORG_ID}`, relation: "org", object: `team:${spec.id}` });
  }
  for (const { user, relation, teamId } of users) {
    tuples.push({ user: `user:${user.id}`, relation, object: `team:${teamId}` });
  }
  return tuples;
}

export async function seedDemoOrg(): Promise<{ teamCount: number; userCount: number; tupleCount: number }> {
  const assignments: { user: DemoUser; relation: string; teamId: string }[] = [];

  for (const spec of DEMO_TEAMS) {
    if (!getTeam(spec.id)) {
      createTeam({ id: spec.id, name: spec.name, createdBy: SEED_USER_IDS["super-admin"] });
    }
    for (const { role, relation } of TEAM_SCOPED_ROLES) {
      const user = ensureUser(spec, role);
      assignments.push({ user, relation, teamId: spec.id });
    }
  }

  const tuples = buildDemoOrgTuples(assignments);
  await writeTuples(tuples);

  return { teamCount: DEMO_TEAMS.length, userCount: assignments.length, tupleCount: tuples.length };
}

/* eslint-disable no-console */
if (require.main === module) {
  seedDemoOrg()
    .then(({ teamCount, userCount, tupleCount }) => {
      console.log(
        `Seeded ${teamCount} team(s), ${userCount} user(s), wrote ${tupleCount} tuple(s) (idempotent — safe to re-run).`
      );
    })
    .catch((error) => {
      console.error("Demo org seed failed:", error);
      process.exitCode = 1;
    });
}
