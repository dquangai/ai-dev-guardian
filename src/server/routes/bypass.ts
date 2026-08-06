import { Router } from "express";
import { authzGate, listGate, listRouteGate } from "../authz/authzGate";
import { tryWriteTuples } from "../authz/fgaClient";
import {
  createBypassRequest,
  listBypassRequests,
  resolveBypassRequest,
} from "../store/bypassStore";
import { isOptionalString, isSafeId, parseEnumQuery } from "../validation";

const BYPASS_STATUSES = ["pending", "approved", "rejected"] as const;

export const bypassRouter = Router();

bypassRouter.get("/", listRouteGate("audit:view"), async (req, res) => {
  const status = parseEnumQuery(req.query.status, BYPASS_STATUSES);
  const requests = await listGate(req.userId, listBypassRequests(status), {
    objectType: "bypass_request",
    relation: "can_view",
    objectIdFor: (r) => r.id,
  });
  res.json(requests);
});

// T-22: bypass:request (developer-only) maps to the `developer` relation on the caller's own
// team, same reasoning as audit:run in audit.ts.
bypassRouter.post(
  "/",
  authzGate("bypass:request", {
    objectType: "team",
    relation: "developer",
    objectIdFrom: (req) => req.teamId ?? "",
  }),
  async (req, res) => {
    if (!isOptionalString(req.body?.auditId) || typeof req.body?.reason !== "string") {
      res.status(400).json({ error: "bad_request", message: "reason must be a string; auditId, if present, must be a string." });
      return;
    }
    try {
      const request = createBypassRequest({
        auditId: req.body.auditId,
        reason: req.body.reason,
        requestedBy: req.userId,
      });
      // T-22: without this, can_view/can_approve never resolve for anyone on this record — same
      // gap T-21 found for pre-existing policies, and audit.ts's /run just fixed for audit_record.
      if (req.teamId) {
        await tryWriteTuples([
          { user: `team:${req.teamId}`, relation: "team", object: `bypass_request:${request.id}` },
          { user: `user:${req.userId}`, relation: "requester", object: `bypass_request:${request.id}` },
        ]);
      }
      res.status(201).json(request);
    } catch (error) {
      res.status(400).json({ error: "invalid", message: (error as Error).message });
    }
  }
);

// T-22: migrated to authzGate — bypass:approve maps to can_approve on the bypass_request itself.
bypassRouter.post(
  "/:id/approve",
  authzGate("bypass:approve", {
    objectType: "bypass_request",
    relation: "can_approve",
    objectIdFrom: (req) => req.params.id,
  }),
  (req, res) => {
    if (!isSafeId(req.params.id)) {
      res.status(400).json({ error: "bad_request", message: "Invalid request id." });
      return;
    }
    try {
      res.json(resolveBypassRequest(req.params.id, "approved", req.userId, req.body?.note));
    } catch (error) {
      res.status(400).json({ error: "invalid", message: (error as Error).message });
    }
  }
);

bypassRouter.post(
  "/:id/reject",
  authzGate("bypass:approve", {
    objectType: "bypass_request",
    relation: "can_approve",
    objectIdFrom: (req) => req.params.id,
  }),
  (req, res) => {
    if (!isSafeId(req.params.id)) {
      res.status(400).json({ error: "bad_request", message: "Invalid request id." });
      return;
    }
    try {
      res.json(resolveBypassRequest(req.params.id, "rejected", req.userId, req.body?.note));
    } catch (error) {
      res.status(400).json({ error: "invalid", message: (error as Error).message });
    }
  }
);
