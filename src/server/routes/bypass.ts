import { Router } from "express";
import { requirePermission } from "../authMiddleware";
import {
  createBypassRequest,
  listBypassRequests,
  resolveBypassRequest,
} from "../store/bypassStore";
import { isOptionalString, isSafeId, parseEnumQuery } from "../validation";

const BYPASS_STATUSES = ["pending", "approved", "rejected"] as const;

export const bypassRouter = Router();

bypassRouter.get("/", requirePermission("audit:view"), (req, res) => {
  const status = parseEnumQuery(req.query.status, BYPASS_STATUSES);
  res.json(listBypassRequests(status));
});

bypassRouter.post("/", requirePermission("bypass:request"), (req, res) => {
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
    res.status(201).json(request);
  } catch (error) {
    res.status(400).json({ error: "invalid", message: (error as Error).message });
  }
});

bypassRouter.post("/:id/approve", requirePermission("bypass:approve"), (req, res) => {
  if (!isSafeId(req.params.id)) {
    res.status(400).json({ error: "bad_request", message: "Invalid request id." });
    return;
  }
  try {
    res.json(resolveBypassRequest(req.params.id, "approved", req.userId, req.body?.note));
  } catch (error) {
    res.status(400).json({ error: "invalid", message: (error as Error).message });
  }
});

bypassRouter.post("/:id/reject", requirePermission("bypass:approve"), (req, res) => {
  if (!isSafeId(req.params.id)) {
    res.status(400).json({ error: "bad_request", message: "Invalid request id." });
    return;
  }
  try {
    res.json(resolveBypassRequest(req.params.id, "rejected", req.userId, req.body?.note));
  } catch (error) {
    res.status(400).json({ error: "invalid", message: (error as Error).message });
  }
});
