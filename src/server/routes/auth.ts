import { Router, type Response } from "express";
import { ROLE_LABELS, permissionsForRole } from "../rbac";
import { signToken } from "../token";
import { checkPassword, findUserByEmail, findUserByRole, type DemoUser } from "../users";

export const authRouter = Router();

function respondWithToken(res: Response, user: DemoUser, rememberMe: boolean): void {
  const token = signToken(
    { sub: user.id, role: user.role, name: user.name, email: user.email, teamId: user.teamId },
    rememberMe
  );
  res.json({
    token,
    user: {
      ...user,
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
  respondWithToken(res, user, Boolean(rememberMe));
});

/** One-click demo login (the buttons on the Login page): still no password, but now the server
 * issues a real signed token for the chosen role instead of the client asserting it via header. */
authRouter.post("/demo-login", (req, res) => {
  const user = findUserByRole(req.body?.role);
  if (!user) {
    res.status(400).json({ error: "bad_request", message: "Unknown role." });
    return;
  }
  respondWithToken(res, user, true);
});
