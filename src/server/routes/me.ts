import { Router } from "express";
import { ROLE_LABELS, ROLES, permissionsForRole } from "../rbac";

export const meRouter = Router();

meRouter.get("/", (req, res) => {
  res.json({
    id: req.userId,
    role: req.role,
    name: req.userName,
    email: req.userEmail,
    // T-24: the active team context, if any (from the token — see routes/auth.ts's
    // /act-as-team for how a Super Admin sets this without a persistent team assignment).
    teamId: req.teamId,
    label: ROLE_LABELS[req.role],
    permissions: permissionsForRole(req.role),
  });
});

meRouter.get("/roles", (_req, res) => {
  res.json(ROLES.map((role) => ({ role, label: ROLE_LABELS[role], permissions: permissionsForRole(role) })));
});
