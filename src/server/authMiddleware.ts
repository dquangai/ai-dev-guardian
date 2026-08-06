import type { NextFunction, Request, Response } from "express";
import { hasPermission, type Permission, type Role } from "./rbac";
import { verifyToken } from "./token";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      role: Role;
      userId: string;
      userName: string;
      userEmail: string;
      // T-22: absent for org-wide roles (super-admin) — see users.ts's DemoUser.teamId.
      teamId?: string;
    }
  }
}

/** Verifies the caller's `Authorization: Bearer <token>` against the signed session issued at
 * login (see routes/auth.ts). Fail-closed: no token, a malformed header, or a token that doesn't
 * verify (wrong signature, expired, tampered) all 401 rather than falling back to any role —
 * unlike the old `x-guardian-role` header, there is no client-set value left to trust here. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.header("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  const payload = scheme === "Bearer" && token ? verifyToken(token) : null;

  if (!payload) {
    res.status(401).json({ error: "unauthorized", message: "Missing or invalid session token." });
    return;
  }

  req.role = payload.role;
  req.userId = payload.sub;
  req.userName = payload.name;
  req.userEmail = payload.email;
  req.teamId = payload.teamId;
  next();
}

/** Route guard: 403s unless the caller's role carries the given permission. */
export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!hasPermission(req.role, permission)) {
      res.status(403).json({
        error: "forbidden",
        message: `Role "${req.role}" lacks permission "${permission}".`,
      });
      return;
    }
    next();
  };
}
