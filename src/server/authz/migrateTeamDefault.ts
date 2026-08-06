/**
 * T-21: one-time (but re-runnable / idempotent) migration — creates the `team-default` Team
 * record and writes the OpenFGA tuples that put today's 4 fixed demo users + the new super-admin
 * demo user into the model built in T-19. Run via `npm run authz:migrate` (needs FGA_API_URL,
 * FGA_STORE_ID, FGA_MODEL_ID pointed at a running instance — see authz/README.md).
 */
import { createTeam, getTeam } from "../store/teamStore";
import { listPolicies } from "../store/policyStore";
import { DEMO_USERS } from "../users";
import type { Role } from "../rbac";
import { writeTuples, type Tuple } from "./fgaClient";

export const ORG_ID = "vsf";
export const DEFAULT_TEAM_ID = "team-default";

const TEAM_SCOPED_ROLES: { role: Role; relation: string }[] = [
  { role: "admin", relation: "admin" },
  { role: "senior-dev", relation: "senior_dev" },
  { role: "developer", relation: "developer" },
  { role: "auditor", relation: "auditor" },
];

/** `policyIds` is a parameter (not read from disk here) so this stays a pure, unit-testable
 * function — `migrateTeamDefault()` below is what actually reads the real .guardian/policies/. */
export function buildMigrationTuples(policyIds: string[] = []): Tuple[] {
  const tuples: Tuple[] = [
    // Learned the hard way in T-19: a team MUST be linked to its org, or super_admin's
    // inheritance (`admin: [user] or super_admin from org` in model.fga) silently never fires.
    { user: `organization:${ORG_ID}`, relation: "org", object: `team:${DEFAULT_TEAM_ID}` },
    {
      user: `user:${DEMO_USERS["super-admin"].id}`,
      relation: "super_admin",
      object: `organization:${ORG_ID}`,
    },
  ];

  for (const { role, relation } of TEAM_SCOPED_ROLES) {
    tuples.push({
      user: `user:${DEMO_USERS[role].id}`,
      relation,
      object: `team:${DEFAULT_TEAM_ID}`,
    });
  }

  // Found during T-21 live verification: without this, can_view/can_edit_direct/can_approve on
  // an existing policy never resolves for ANYONE (including team members) — the policy relation
  // tupleset (`team: [team]`) has nothing to point at. Every policy file that predates Sprint 3
  // is treated as belonging to team-default.
  for (const policyId of policyIds) {
    tuples.push({
      user: `team:${DEFAULT_TEAM_ID}`,
      relation: "team",
      object: `policy:${policyId}`,
    });
  }

  return tuples;
}

export async function migrateTeamDefault(): Promise<{ team: ReturnType<typeof getTeam>; tupleCount: number }> {
  let team = getTeam(DEFAULT_TEAM_ID);
  if (!team) {
    team = createTeam({ id: DEFAULT_TEAM_ID, name: "Default Team", createdBy: DEMO_USERS["super-admin"].id });
  }

  const policyIds = listPolicies().map((p) => p.id);
  const tuples = buildMigrationTuples(policyIds);
  await writeTuples(tuples);

  return { team, tupleCount: tuples.length };
}

/* eslint-disable no-console */
if (require.main === module) {
  migrateTeamDefault()
    .then(({ team, tupleCount }) => {
      console.log(`Team "${team?.id}" ready. Wrote ${tupleCount} tuples (idempotent — safe to re-run).`);
    })
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exitCode = 1;
    });
}
