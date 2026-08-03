import { Router } from "express";
import { requirePermission } from "../authMiddleware";
import { hasPermission } from "../rbac";
import {
  deletePolicyFile,
  getPolicy,
  listChangeRequests,
  listPolicies,
  resolveChangeRequest,
  submitChangeRequest,
  writePolicyFile,
} from "../store/policyStore";

export const policiesRouter = Router();

policiesRouter.get("/", requirePermission("policy:view"), (_req, res) => {
  res.json(listPolicies());
});

policiesRouter.get("/requests", requirePermission("policy:view"), (req, res) => {
  const status = req.query.status as "pending" | "approved" | "rejected" | undefined;
  res.json(listChangeRequests(status));
});

policiesRouter.get("/:id", requirePermission("policy:view"), (req, res) => {
  const policy = getPolicy(req.params.id);
  if (!policy) {
    res.status(404).json({ error: "not_found", message: `Policy "${req.params.id}" not found.` });
    return;
  }
  res.json(policy);
});

/** Create/update: direct write for roles with policy:edit-direct, otherwise a pending
 * change request that an approver (policy:approve) must resolve. Same handler for both
 * so the workflow logic — who needs review — lives in exactly one place. */
function submitOrApply(action: "create" | "update") {
  return (req: import("express").Request, res: import("express").Response) => {
    const id = req.params.id ?? req.body.id;
    const content = req.body.content as string | undefined;
    if (!id || typeof content !== "string") {
      res.status(400).json({ error: "bad_request", message: "id and content are required." });
      return;
    }

    try {
      if (hasPermission(req.role, "policy:edit-direct")) {
        writePolicyFile(id, content);
        res.json({ status: "applied", policy: getPolicy(id) });
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
  if (hasPermission(req.role, "policy:edit-direct")) {
    deletePolicyFile(id);
    res.json({ status: "applied" });
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

policiesRouter.post("/requests/:id/approve", requirePermission("policy:approve"), (req, res) => {
  try {
    const request = resolveChangeRequest(req.params.id, "approved", req.userId, req.body?.note);
    res.json(request);
  } catch (error) {
    res.status(400).json({ error: "invalid", message: (error as Error).message });
  }
});

policiesRouter.post("/requests/:id/reject", requirePermission("policy:approve"), (req, res) => {
  try {
    const request = resolveChangeRequest(req.params.id, "rejected", req.userId, req.body?.note);
    res.json(request);
  } catch (error) {
    res.status(400).json({ error: "invalid", message: (error as Error).message });
  }
});
