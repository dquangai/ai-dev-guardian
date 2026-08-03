import type { NextFunction, Request, Response } from "express";
import { hasPermission, isValidRole, type Permission, type Role } from "./rbac";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      role: Role;
      userId: string;
    }
  }
}

// Deliberately the least-privileged role in the RBAC matrix (see rbac.ts) — falling back here on
// a missing/invalid x-guardian-role header is a fail-closed default, not privilege escalation:
// an unrecognized caller gets fewer permissions than any real role, never more.
const DEFAULT_ROLE: Role = "developer";

/** Reads the caller's asserted role/identity from headers set by the frontend's role switcher. */
export function attachIdentity(req: Request, _res: Response, next: NextFunction): void {
  const headerRole = req.header("x-guardian-role");
  req.role = isValidRole(headerRole) ? headerRole : DEFAULT_ROLE;
  req.userId = req.header("x-guardian-user") || `${req.role}@local`;
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
