/**
 * RBAC model for the web dashboard. There is no login/session system — the
 * dashboard is an internal tool run alongside the CLI, so the caller's role
 * is asserted via the `x-guardian-role` header (set by the frontend's role
 * switcher). Every route handler must go through requireRole()/hasPermission()
 * rather than trusting req.role directly, so the policy stays in one place.
 */
export type Role = "admin" | "senior-dev" | "developer" | "auditor";

export const ROLES: Role[] = ["admin", "senior-dev", "developer", "auditor"];

export type Permission =
  | "policy:view"
  | "policy:edit-direct" // write policy files immediately, no review needed
  | "policy:propose" // submit a change request that needs approval
  | "policy:approve" // approve/reject other users' change requests
  | "audit:run"
  | "audit:view"
  | "cache:manage" // clear the audit cache
  | "bypass:request"
  | "bypass:approve"
  | "engine-config:view"
  | "engine-config:edit";

const PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    "policy:view",
    "policy:edit-direct",
    "policy:approve",
    "audit:run",
    "audit:view",
    "cache:manage",
    "bypass:request",
    "bypass:approve",
    "engine-config:view",
    "engine-config:edit",
  ],
  "senior-dev": [
    "policy:view",
    "policy:propose",
    "audit:run",
    "audit:view",
    "bypass:request",
    "engine-config:view",
  ],
  developer: ["policy:view", "audit:run", "audit:view", "bypass:request", "engine-config:view"],
  auditor: ["policy:view", "audit:view", "bypass:approve", "engine-config:view"],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return PERMISSIONS[role]?.includes(permission) ?? false;
}

export function isValidRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as string[]).includes(value);
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin / Team Lead",
  "senior-dev": "Senior Developer",
  developer: "Developer",
  auditor: "Auditor",
};

export function permissionsForRole(role: Role): Permission[] {
  return PERMISSIONS[role] ?? [];
}
