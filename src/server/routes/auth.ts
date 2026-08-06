import { Router, type Response } from "express";
import { requireAuth } from "../authMiddleware";
import { ROLE_LABELS, permissionsForRole } from "../rbac";
import { signToken } from "../token";
import { getTeam } from "../store/teamStore";
import { checkPassword, findUserByEmail, findUserByRole, type DemoUser } from "../users";
import { isSafeId } from "../validation";

export const authRouter = Router();

/** `teamId` is passed explicitly by every caller (not read off `user.teamId` internally) so
 * /act-as-team below can issue a token with a per-session team choice that's independent of the
 * caller's persistent team assignment (super-admin never has one, see users.ts). */
function respondWithToken(res: Response, user: DemoUser, rememberMe: boolean, teamId: string | undefined): void {
  const token = signToken({ sub: user.id, role: user.role, name: user.name, email: user.email, teamId }, rememberMe);
  res.json({
    token,
    user: {
      ...user,
      teamId,
      label: ROLE_LABELS[user.role],
      permissions: permissionsForRole(user.role),
    },
  });
}

authRouter.post("/login", (req, res) => {
  const { email, password, rememberMe } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "bad_request", message: "email and password must be strings." });
    return;
  }
  const user = findUserByEmail(email);
  if (!user || !checkPassword(password)) {
    res.status(401).json({ error: "invalid_credentials", message: "Email hoặc mật khẩu không đúng." });
    return;
  }
  respondWithToken(res, user, Boolean(rememberMe), user.teamId);
});

/** One-click demo login (the buttons on the Login page): still no password, but now the server
 * issues a real signed token for the chosen role instead of the client asserting it via header. */
authRouter.post("/demo-login", (req, res) => {
  const user = findUserByRole(req.body?.role);
  if (!user) {
    res.status(400).json({ error: "bad_request", message: "Unknown role." });
    return;
  }
  respondWithToken(res, user, true, user.teamId);
});

/** T-24: lets a Super Admin "act as" a specific team's admin — reissues their token with
 * `teamId` set to the chosen team (or cleared, for org-wide) without touching any persistent
 * assignment (super-admin has none, by design — see users.ts). Team-scoped OpenFGA checks and
 * routes that read req.teamId (audit:run, cache:manage, tagPolicyTeam, ...) then behave exactly
 * as they would for that team's own admin, for the rest of this session. */
authRouter.post("/act-as-team", requireAuth, (req, res) => {
  if (req.role !== "super-admin") {
    res.status(403).json({ error: "forbidden", message: "Only Super Admin can switch team context." });
    return;
  }
  const raw = req.body?.teamId;
  if (raw !== undefined && raw !== null && raw !== "" && !isSafeId(raw)) {
    res.status(400).json({ error: "bad_request", message: "Invalid teamId." });
    return;
  }
  const teamId: string | undefined = raw ? raw : undefined;
  if (teamId && !getTeam(teamId)) {
    res.status(404).json({ error: "not_found", message: `Team "${teamId}" not found.` });
    return;
  }
  const superAdmin = findUserByRole("super-admin");
  if (!superAdmin) {
    res.status(500).json({ error: "internal_error", message: "Super Admin demo account missing." });
    return;
  }
  respondWithToken(res, superAdmin, true, teamId);
});
