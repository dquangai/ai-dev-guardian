/**
 * RBAC model for the web dashboard. The caller's role comes from a signed session token
 * verified in requireAuth() (see authMiddleware.ts, token.ts) — never trust req.role without
 * that verification step. Every route handler must go through requirePermission()/hasPermission()
 * rather than branching on req.role directly, so the policy stays in one place.
 *
 * Four tiers: Developer runs audits on their own code; Senior Dev/Lead drafts
 * policy, reviews team-wide findings, and approves policy changes and bypass
 * requests; Admin additionally edits policy directly and configures the
 * engine; Auditor is read-only oversight across the board — no approve, no
 * edit, no run.
 */
export type Role = "admin" | "senior-dev" | "developer" | "auditor";

export const ROLES: Role[] = ["admin", "senior-dev", "developer", "auditor"];

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
  "senior-dev": [
    "policy:view",
    "policy:propose",
    "policy:approve",
    "audit:view",
    "bypass:approve",
  ],
  developer: ["policy:view", "audit:run", "audit:view", "bypass:request"],
  auditor: ["policy:view", "audit:view", "engine-config:view"],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return PERMISSIONS[role]?.includes(permission) ?? false;
}

export function isValidRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as string[]).includes(value);
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  "senior-dev": "Senior Dev-Lead",
  developer: "Dev",
  auditor: "Auditor",
};

export function permissionsForRole(role: Role): Permission[] {
  return PERMISSIONS[role] ?? [];
}
