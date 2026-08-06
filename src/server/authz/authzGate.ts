import type { Request } from "express";
import { requirePermission } from "../authMiddleware";
import type { Permission } from "../rbac";
import { requireRelation } from "./requireRelation";

/** T-20 migration feature flag: `GUARDIAN_AUTHZ_MODE=fga` switches a route from the old flat
 * `requirePermission()` to the new OpenFGA `requireRelation()` — decided once at route
 * registration time, not per-request. Default (unset) keeps every route on the old mechanism, so
 * T-11's 57 RBAC integration tests keep exercising exactly what they did before this file existed.
 * Once every route is migrated (T-22), this flag and `requirePermission()` both go away. */
export function authzGate(
  permission: Permission,
  fga: { objectType: string; relation: string; objectIdFrom: (req: Request) => string }
) {
  if (process.env.GUARDIAN_AUTHZ_MODE === "fga") {
    return requireRelation(fga.objectType, fga.relation, fga.objectIdFrom);
  }
  return requirePermission(permission);
}
