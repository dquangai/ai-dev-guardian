import { Router } from "express";
import { requirePermission } from "../authMiddleware";
import { hasPermission } from "../rbac";
import { authzGate } from "../authz/authzGate";
import {
  deletePolicyFile,
  getPolicy,
  gitSyncHint,
  listChangeRequests,
  listPolicies,
  resolveChangeRequest,
  submitChangeRequest,
  writePolicyFile,
} from "../store/policyStore";
import { isSafeId, parseEnumQuery } from "../validation";

const CHANGE_REQUEST_STATUSES = ["pending", "approved", "rejected"] as const;

export const policiesRouter = Router();

policiesRouter.get("/", requirePermission("policy:view"), (_req, res) => {
  res.json(listPolicies());
});

policiesRouter.get("/requests", requirePermission("policy:view"), (req, res) => {
  const status = parseEnumQuery(req.query.status, CHANGE_REQUEST_STATUSES);
  res.json(listChangeRequests(status));
});

// T-20 PoC: migrated to authzGate (OpenFGA when GUARDIAN_AUTHZ_MODE=fga, requirePermission otherwise).
policiesRouter.get(
  "/:id",
  authzGate("policy:view", { objectType: "policy", relation: "can_view", objectIdFrom: (req) => req.params.id }),
  (req, res) => {
    if (!isSafeId(req.params.id)) {
      res.status(400).json({ error: "bad_request", message: "Invalid policy id." });
      return;
    }
    const policy = getPolicy(req.params.id);
    if (!policy) {
      res.status(404).json({ error: "not_found", message: `Policy "${req.params.id}" not found.` });
      return;
    }
    res.json(policy);
  }
);

/** Create/update: direct write for roles with policy:edit-direct, otherwise a pending
 * change request that an approver (policy:approve) must resolve. Same handler for both
 * so the workflow logic — who needs review — lives in exactly one place. */
function submitOrApply(action: "create" | "update") {
  return (req: import("express").Request, res: import("express").Response) => {
    const id = req.params.id ?? req.body.id;
    const content = req.body.content as string | undefined;
    const changeSummary = req.body.changeSummary as string | undefined;
    if (!isSafeId(id) || typeof content !== "string") {
      res.status(400).json({ error: "bad_request", message: "id and content are required." });
      return;
    }

    try {
      if (hasPermission(req.role, "policy:edit-direct")) {
        writePolicyFile(id, content, { updatedBy: req.userId, changeSummary });
        res.json({ status: "applied", policy: getPolicy(id), gitHint: gitSyncHint(id, "write") });
        return;
      }
      if (!hasPermission(req.role, "policy:propose")) {
        res.status(403).json({
          error: "forbidden",
          message: `Role "${req.role}" cannot edit or propose policy changes.`,
        });
        return;
      }
      const request = submitChangeRequest({
        policyId: id,
        action,
        content,
        changeSummary,
        submittedBy: req.userId,
      });
      res.status(202).json({ status: "pending-approval", request });
    } catch (error) {
      res.status(400).json({ error: "invalid", message: (error as Error).message });
    }
  };
}

policiesRouter.post("/", submitOrApply("create"));
policiesRouter.put("/:id", submitOrApply("update"));

policiesRouter.delete("/:id", (req, res) => {
  const id = req.params.id;
  if (!isSafeId(id)) {
    res.status(400).json({ error: "bad_request", message: "Invalid policy id." });
    return;
  }
  if (hasPermission(req.role, "policy:edit-direct")) {
    deletePolicyFile(id);
    res.json({ status: "applied", gitHint: gitSyncHint(id, "delete") });
    return;
  }
  if (!hasPermission(req.role, "policy:propose")) {
    res.status(403).json({
      error: "forbidden",
      message: `Role "${req.role}" cannot delete or propose policy changes.`,
    });
    return;
  }
  const request = submitChangeRequest({ policyId: id, action: "delete", submittedBy: req.userId });
  res.status(202).json({ status: "pending-approval", request });
});

/** Resolves a change-request id to its target policy id, for authzGate's objectIdFrom — the
 * approve route's :id is the *request*, but `can_approve` (T-19 model) is a relation on the
 * *policy* it targets. "__unknown__" on a missing request 403s harmlessly; the handler's own
 * isSafeId/resolveChangeRequest checks below give the real 400/404. */
function policyIdForChangeRequest(req: import("express").Request): string {
  return listChangeRequests().find((r) => r.id === req.params.id)?.policyId ?? "__unknown__";
}

// T-20 PoC: migrated to authzGate (OpenFGA when GUARDIAN_AUTHZ_MODE=fga, requirePermission otherwise).
policiesRouter.post(
  "/requests/:id/approve",
  authzGate("policy:approve", {
    objectType: "policy",
    relation: "can_approve",
    objectIdFrom: policyIdForChangeRequest,
  }),
  (req, res) => {
    if (!isSafeId(req.params.id)) {
      res.status(400).json({ error: "bad_request", message: "Invalid request id." });
      return;
    }
    try {
      const request = resolveChangeRequest(req.params.id, "approved", req.userId, req.body?.note);
      const gitHint = gitSyncHint(request.policyId, request.action === "delete" ? "delete" : "write");
      res.json({ ...request, gitHint });
    } catch (error) {
      res.status(400).json({ error: "invalid", message: (error as Error).message });
    }
  }
);

policiesRouter.post("/requests/:id/reject", requirePermission("policy:approve"), (req, res) => {
  if (!isSafeId(req.params.id)) {
    res.status(400).json({ error: "bad_request", message: "Invalid request id." });
    return;
  }
  try {
    const request = resolveChangeRequest(req.params.id, "rejected", req.userId, req.body?.note);
    res.json(request);
  } catch (error) {
    res.status(400).json({ error: "invalid", message: (error as Error).message });
  }
});
