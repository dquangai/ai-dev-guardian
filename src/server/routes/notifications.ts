import { Router } from "express";
import { requirePermission } from "../authMiddleware";
import { getPolicy, listPolicies } from "../store/policyStore";
import { getReadVersion, markPolicyRead } from "../store/notificationStore";
import { isSafeId } from "../validation";

export const notificationsRouter = Router();

/** T-18: every role with policy:view gets the bell — Dev/Senior Dev/Auditor need to notice Admin's
 * (or an approved) edit just as much as Admin needs to notice a Senior Dev's. */
notificationsRouter.get("/policies", requirePermission("policy:view"), (req, res) => {
  const items = listPolicies().map((policy) => {
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

notificationsRouter.post("/policies/:id/read", requirePermission("policy:view"), (req, res) => {
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
});
