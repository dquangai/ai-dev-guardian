import { Router } from "express";
import { authzGate, listGate, listRouteGate } from "../authz/authzGate";
import { getPolicy, listPolicies } from "../store/policyStore";
import { getReadVersion, markPolicyRead } from "../store/notificationStore";
import { isSafeId } from "../validation";

export const notificationsRouter = Router();

/** T-18: every role with policy:view gets the bell — Dev/Senior Dev/Auditor need to notice Admin's
 * (or an approved) edit just as much as Admin needs to notice a Senior Dev's.
 * T-22: list-filtered via listGate() same as GET /api/policies — a user only sees the notification
 * bell for policies they can actually view. */
notificationsRouter.get("/policies", listRouteGate("policy:view"), async (req, res) => {
  const visible = await listGate(req.userId, listPolicies(), {
    objectType: "policy",
    relation: "can_view",
    objectIdFor: (p) => p.id,
  });
  const items = visible.map((policy) => {
    const version = policy.version ?? 1;
    return {
      id: policy.id,
      version,
      lastUpdated: policy.lastUpdated,
      updatedBy: policy.updatedBy,
      changeSummary: policy.changeSummary,
      unread: version > getReadVersion(req.userId, policy.id),
    };
  });
  res.json(items);
});

// T-22: migrated to authzGate — object is the policy itself (:id in the URL is the policy id).
notificationsRouter.post(
  "/policies/:id/read",
  authzGate("policy:view", { objectType: "policy", relation: "can_view", objectIdFrom: (req) => req.params.id }),
  (req, res) => {
    const id = req.params.id;
    if (!isSafeId(id)) {
      res.status(400).json({ error: "bad_request", message: "Invalid policy id." });
      return;
    }
    const policy = getPolicy(id);
    if (!policy) {
      res.status(404).json({ error: "not_found", message: `Policy "${id}" not found.` });
      return;
    }
    markPolicyRead(req.userId, id, policy.version ?? 1);
    res.json({ status: "ok" });
  }
);
