/**
 * RBAC model for the web dashboard. There is no login/session system — the
 * dashboard is an internal tool run alongside the CLI, so the caller's role
 * is asserted via the `x-guardian-role` header (set by the frontend's login
 * flow). Every route handler must go through requireRole()/hasPermission()
 * rather than trusting req.role directly, so the policy stays in one place.
 *
 * Three tiers, each a strict subset of the next in scope of oversight:
 * Developer runs audits on their own code; Senior Dev drafts policy and
 * reviews team-wide findings but can't approve anything; Admin/Lead is the
 * only role that approves policy changes, approves bypasses, and configures
 * the engine.
 */
export type Role = "admin" | "senior-dev" | "developer";

export const ROLES: Role[] = ["admin", "senior-dev", "developer"];

export type Permission =
  | "policy:view"
  | "policy:edit-direct" // write policy files immediately, no review needed
  | "policy:propose" // submit a new draft policy that needs approval
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
    "audit:view",
    "cache:manage",
    "bypass:approve",
    "engine-config:view",
    "engine-config:edit",
  ],
  "senior-dev": ["policy:view", "policy:propose", "audit:view"],
  developer: ["policy:view", "audit:run", "audit:view", "bypass:request"],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return PERMISSIONS[role]?.includes(permission) ?? false;
}

export function isValidRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as string[]).includes(value);
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin / Lead",
  "senior-dev": "Senior Dev",
  developer: "Dev",
};

export function permissionsForRole(role: Role): Permission[] {
  return PERMISSIONS[role] ?? [];
}
