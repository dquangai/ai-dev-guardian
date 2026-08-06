import type { NextFunction, Request, Response } from "express";
import { requirePermission } from "../authMiddleware";
import { hasPermission, type Permission } from "../rbac";
import { requireRelation } from "./requireRelation";
import { checkRelation, filterAllowed } from "./fgaClient";

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

/** T-22 counterpart for list endpoints: old RBAC never filtered a list beyond the coarse route
 * gate (a Dev seeing every audit record was T-09's bug), so with the flag off this returns `items`
 * untouched — same behavior as before this file existed. With the flag on, filters to only the
 * items the caller actually has `relation` on via OpenFGA (see fgaClient.filterAllowed). */
export async function listGate<T>(
  userId: string,
  items: T[],
  fga: { objectType: string; relation: string; objectIdFor: (item: T) => string }
): Promise<T[]> {
  if (process.env.GUARDIAN_AUTHZ_MODE !== "fga") return items;
  return filterAllowed(items, userId, fga.relation, (item) => `${fga.objectType}:${fga.objectIdFor(item)}`);
}

/** Coarse route guard for list endpoints: old mode keeps the exact old `requirePermission()` gate
 * (a list route was never ungated before). New mode (flag on) lets any authenticated caller
 * through the route itself — the real per-item authorization is `listGate()`'s job inside the
 * handler, since "can view the list at all" isn't a single relation check the way a single-object
 * route's is. */
export function listRouteGate(permission: Permission) {
  if (process.env.GUARDIAN_AUTHZ_MODE === "fga") {
    return (_req: Request, _res: Response, next: NextFunction): void => next();
  }
  return requirePermission(permission);
}

/** T-22: inline equivalent of authzGate() for branch-y handlers that check "does this role/caller
 * have permission X" mid-function (e.g. submitOrApply's edit-direct-vs-propose fork) rather than
 * as a single route-level gate. Same flag, same fallback guarantee. */
export async function hasRelationOrPermission(
  req: Request,
  permission: Permission,
  fga: { objectType: string; relation: string; object: string }
): Promise<boolean> {
  if (process.env.GUARDIAN_AUTHZ_MODE === "fga") {
    return checkRelation(req.userId, fga.relation, `${fga.objectType}:${fga.object}`);
  }
  return hasPermission(req.role, permission);
}
