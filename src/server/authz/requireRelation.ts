import type { NextFunction, Request, Response } from "express";
import { checkRelation } from "./fgaClient";

/** T-20 proof-of-concept: OpenFGA-backed route guard — checks `user:<req.userId>` has `relation`
 * on `<objectType>:<objectIdFrom(req)>` instead of the flat `requirePermission()` role lookup.
 * See authz/model.fga (T-19) for what each relation means and authz/authzGate.ts for how this
 * runs side-by-side with the old mechanism during migration. */
export function requireRelation(
  objectType: string,
  relation: string,
  objectIdFrom: (req: Request) => string
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const object = `${objectType}:${objectIdFrom(req)}`;
    try {
      const allowed = await checkRelation(req.userId, relation, object);
      if (!allowed) {
        res.status(403).json({
          error: "forbidden",
          message: `User lacks relation "${relation}" on "${object}".`,
        });
        return;
      }
      next();
    } catch (error) {
      res.status(500).json({ error: "authz_check_failed", message: (error as Error).message });
    }
  };
}
