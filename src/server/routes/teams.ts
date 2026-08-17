import { Router, type NextFunction, type Request, type Response } from "express";
import { ORG_ID, TEAM_SCOPED_ROLES } from "../authz/migrateTeamDefault";
import { tryDeleteTuples, tryWriteTuples } from "../authz/fgaClient";
import { isValidRole } from "../rbac";
import { createTeam, getTeam, listTeams, type Team } from "../store/teamStore";
import { createUser, findUserByEmail, findUserById, listAllUsers, setUserTeam, type DemoUser } from "../users";
import { isSafeId } from "../validation";

export const teamsRouter = Router();

/** T-23: team management is a brand-new (Sprint 3) feature area with no old-RBAC precedent to
 * preserve, so unlike the rest of authz/ it isn't dual-mode behind GUARDIAN_AUTHZ_MODE — it's
 * always gated the same way. A direct role check (rather than an OpenFGA checkRelation() call) is
 * deliberate: with exactly one super-admin demo user, `req.role === "super-admin"` and "is
 * super_admin of org:vsf" are exactly equivalent here, and staying role-based keeps these routes
 * testable without a live OpenFGA instance. */
function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.role !== "super-admin") {
    res.status(403).json({ error: "forbidden", message: "Only Super Admin can manage teams." });
    return;
  }
  next();
}

function relationForRole(role: DemoUser["role"]): string | undefined {
  return TEAM_SCOPED_ROLES.find((r) => r.role === role)?.relation;
}

function toMember(user: DemoUser) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

function toTeamView(team: Team) {
  const members = listAllUsers().filter((u) => u.teamId === team.id).map(toMember);
  return { ...team, members };
}

/** Shared by POST /:id/members and POST /users — writes the matching OpenFGA tuple (best-effort,
 * fail-open, see fgaClient.ts) alongside the persisted teamId change, deleting the old tuple first
 * if the user was already on another team. */
async function assignUserToTeam(user: DemoUser, teamId: string): Promise<void> {
  const relation = relationForRole(user.role);
  if (!relation) return;
  if (user.teamId && user.teamId !== teamId) {
    await tryDeleteTuples([{ user: `user:${user.id}`, relation, object: `team:${user.teamId}` }]);
  }
  await tryWriteTuples([{ user: `user:${user.id}`, relation, object: `team:${teamId}` }]);
  setUserTeam(user.id, teamId);
}

teamsRouter.use(requireSuperAdmin);

/** Also returns every team-scoped user (with their current teamId) so the "add member" UI can
 * build its picker without a separate request — see store/userStore.ts for the persisted directory
 * this now reads from (previously just 4 fixed accounts). */
teamsRouter.get("/", (_req, res) => {
  res.json({
    teams: listTeams().map(toTeamView),
    users: listAllUsers()
      .filter((u) => relationForRole(u.role) !== undefined)
      .map((u) => ({ ...toMember(u), teamId: u.teamId })),
  });
});

teamsRouter.post("/", async (req, res) => {
  const id = req.body?.id;
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!isSafeId(id) || !name) {
    res.status(400).json({ error: "bad_request", message: "id and name are required." });
    return;
  }
  try {
    const team = createTeam({ id, name, createdBy: req.userId });
    // T-19/T-21 gotcha: a team unlinked from the org is invisible to super_admin's inheritance
    // (`admin: [user] or super_admin from org` in model.fga) — link it immediately, not later.
    await tryWriteTuples([{ user: `organization:${ORG_ID}`, relation: "org", object: `team:${id}` }]);
    res.status(201).json(toTeamView(team));
  } catch (error) {
    res.status(409).json({ error: "conflict", message: (error as Error).message });
  }
});

/** New person for the org directory (T-25 multi-team demo roster) — only team-scoped roles, since
 * super-admin is org-wide-by-design and there is exactly one (see users.ts's SEED_USER_IDS). */
teamsRouter.post("/users", async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const role = req.body?.role;
  const teamId = req.body?.teamId;

  if (!name || !email || !email.includes("@")) {
    res.status(400).json({ error: "bad_request", message: "name and a valid email are required." });
    return;
  }
  if (!isValidRole(role) || role === "super-admin") {
    res.status(400).json({ error: "bad_request", message: "role must be one of admin/senior-dev/developer/auditor." });
    return;
  }
  if (teamId !== undefined && !isSafeId(teamId)) {
    res.status(400).json({ error: "bad_request", message: "Invalid teamId." });
    return;
  }
  if (findUserByEmail(email)) {
    res.status(409).json({ error: "conflict", message: `User with email "${email}" already exists.` });
    return;
  }
  if (teamId && !getTeam(teamId)) {
    res.status(404).json({ error: "not_found", message: `Team "${teamId}" not found.` });
    return;
  }

  const user = createUser({ name, email, role, createdBy: req.userId });
  if (teamId) {
    await assignUserToTeam(user, teamId);
  }
  res.status(201).json(toMember(findUserById(user.id) ?? user));
});

teamsRouter.post("/:id/members", async (req, res) => {
  const teamId = req.params.id;
  const userId = req.body?.userId;
  if (!isSafeId(teamId) || typeof userId !== "string") {
    res.status(400).json({ error: "bad_request", message: "userId is required." });
    return;
  }
  const team = getTeam(teamId);
  if (!team) {
    res.status(404).json({ error: "not_found", message: `Team "${teamId}" not found.` });
    return;
  }
  const user = findUserById(userId);
  if (!user) {
    res.status(404).json({ error: "not_found", message: `User "${userId}" not found.` });
    return;
  }
  const relation = relationForRole(user.role);
  if (!relation) {
    res.status(400).json({
      error: "bad_request",
      message: `Role "${user.role}" is org-wide and cannot be assigned to a team.`,
    });
    return;
  }
  if (user.teamId === teamId) {
    res.json(toTeamView(team));
    return;
  }
  await assignUserToTeam(user, teamId);
  res.json(toTeamView(team));
});

teamsRouter.delete("/:id/members/:userId", async (req, res) => {
  const teamId = req.params.id;
  const { userId } = req.params;
  const team = getTeam(teamId);
  if (!team) {
    res.status(404).json({ error: "not_found", message: `Team "${teamId}" not found.` });
    return;
  }
  const user = findUserById(userId);
  if (!user || user.teamId !== teamId) {
    res.status(404).json({ error: "not_found", message: `User "${userId}" is not a member of "${teamId}".` });
    return;
  }
  const relation = relationForRole(user.role);
  if (relation) {
    await tryDeleteTuples([{ user: `user:${user.id}`, relation, object: `team:${teamId}` }]);
  }
  setUserTeam(user.id, undefined);
  res.json(toTeamView(team));
});
