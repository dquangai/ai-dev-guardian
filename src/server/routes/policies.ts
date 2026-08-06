import { Router } from "express";
import { authzGate, hasRelationOrPermission, listGate, listRouteGate } from "../authz/authzGate";
import { tryWriteTuples } from "../authz/fgaClient";
import { findUserById } from "../users";
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

policiesRouter.get("/", listRouteGate("policy:view"), async (req, res) => {
  const policies = await listGate(req.userId, listPolicies(), {
    objectType: "policy",
    relation: "can_view",
    objectIdFor: (p) => p.id,
  });
  res.json(policies);
});

policiesRouter.get("/requests", listRouteGate("policy:view"), async (req, res) => {
  const status = parseEnumQuery(req.query.status, CHANGE_REQUEST_STATUSES);
  const requests = await listGate(req.userId, listChangeRequests(status), {
    objectType: "policy",
    relation: "can_view",
    objectIdFor: (r) => r.policyId,
  });
  res.json(requests);
});

// T-20: migrated to authzGate (OpenFGA when GUARDIAN_AUTHZ_MODE=fga, requirePermission otherwise).
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

/** T-22: a brand-new policy needs a `team` tuple the moment it's created (direct-apply) or the
 * moment its change request is approved, or nobody — including its own team — can ever satisfy
 * `can_view`/`can_edit_direct` on it afterwards (T-21 found this exact gap for pre-existing
 * policies; new ones need the same fix at creation time). Team = the content's author's team:
 * the direct-editor for an immediate apply, or the original proposer for an approved request. */
async function tagPolicyTeam(policyId: string, authorUserId: string): Promise<void> {
  const teamId = findUserById(authorUserId)?.teamId;
  if (!teamId) return; // super-admin or unknown author — no single team to tag; skip, not fatal.
  await tryWriteTuples([{ user: `team:${teamId}`, relation: "team", object: `policy:${policyId}` }]);
}

/** Create/update: direct write for roles with policy:edit-direct, otherwise a pending
 * change request that an approver (policy:approve) must resolve. Same handler for both
 * so the workflow logic — who needs review — lives in exactly one place. */
function submitOrApply(action: "create" | "update") {
  return async (req: import("express").Request, res: import("express").Response) => {
    const id = req.params.id ?? req.body.id;
    const content = req.body.content as string | undefined;
    const changeSummary = req.body.changeSummary as string | undefined;
    if (!isSafeId(id) || typeof content !== "string") {
      res.status(400).json({ error: "bad_request", message: "id and content are required." });
      return;
    }

    try {
      const canEditDirect = await hasRelationOrPermission(req, "policy:edit-direct", {
        objectType: "policy",
        relation: "can_edit_direct",
        object: id,
      });
      if (canEditDirect) {
        writePolicyFile(id, content, { updatedBy: req.userId, changeSummary });
        if (action === "create") await tagPolicyTeam(id, req.userId);
        res.json({ status: "applied", policy: getPolicy(id), gitHint: gitSyncHint(id, "write") });
        return;
      }
      const canPropose = await hasRelationOrPermission(req, "policy:propose", {
        objectType: "policy",
        relation: "can_propose",
        object: id,
      });
      if (!canPropose) {
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

policiesRouter.delete("/:id", async (req, res) => {
  const id = req.params.id;
  if (!isSafeId(id)) {
    res.status(400).json({ error: "bad_request", message: "Invalid policy id." });
    return;
  }
  const canEditDirect = await hasRelationOrPermission(req, "policy:edit-direct", {
    objectType: "policy",
    relation: "can_edit_direct",
    object: id,
  });
  if (canEditDirect) {
    deletePolicyFile(id);
    res.json({ status: "applied", gitHint: gitSyncHint(id, "delete") });
    return;
  }
  const canPropose = await hasRelationOrPermission(req, "policy:propose", {
    objectType: "policy",
    relation: "can_propose",
    object: id,
  });
  if (!canPropose) {
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
 * approve/reject route's :id is the *request*, but `can_approve` (T-19 model) is a relation on
 * the *policy* it targets. "__unknown__" on a missing request 403s harmlessly; the handler's own
 * isSafeId/resolveChangeRequest checks below give the real 400/404. */
function policyIdForChangeRequest(req: import("express").Request): string {
  return listChangeRequests().find((r) => r.id === req.params.id)?.policyId ?? "__unknown__";
}

// T-20: migrated to authzGate (OpenFGA when GUARDIAN_AUTHZ_MODE=fga, requirePermission otherwise).
policiesRouter.post(
  "/requests/:id/approve",
  authzGate("policy:approve", {
    objectType: "policy",
    relation: "can_approve",
    objectIdFrom: policyIdForChangeRequest,
  }),
  async (req, res) => {
    if (!isSafeId(req.params.id)) {
      res.status(400).json({ error: "bad_request", message: "Invalid request id." });
      return;
    }
    try {
      const before = listChangeRequests().find((r) => r.id === req.params.id);
      const request = resolveChangeRequest(req.params.id, "approved", req.userId, req.body?.note);
      if (before?.action === "create") await tagPolicyTeam(request.policyId, request.submittedBy);
      const gitHint = gitSyncHint(request.policyId, request.action === "delete" ? "delete" : "write");
      res.json({ ...request, gitHint });
    } catch (error) {
      res.status(400).json({ error: "invalid", message: (error as Error).message });
    }
  }
);

// T-22: migrated to authzGate — was still on requirePermission() directly until now.
policiesRouter.post(
  "/requests/:id/reject",
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
      const request = resolveChangeRequest(req.params.id, "rejected", req.userId, req.body?.note);
      res.json(request);
    } catch (error) {
      res.status(400).json({ error: "invalid", message: (error as Error).message });
    }
  }
);
