import { Router } from "express";
import { requirePermission } from "../authMiddleware";
import {
  createBypassRequest,
  listBypassRequests,
  resolveBypassRequest,
} from "../store/bypassStore";

export const bypassRouter = Router();

bypassRouter.get("/", requirePermission("audit:view"), (req, res) => {
  const status = req.query.status as "pending" | "approved" | "rejected" | undefined;
  res.json(listBypassRequests(status));
});

bypassRouter.post("/", requirePermission("bypass:request"), (req, res) => {
  try {
    const request = createBypassRequest({
      auditId: req.body?.auditId,
      reason: req.body?.reason ?? "",
      requestedBy: req.userId,
    });
    res.status(201).json(request);
  } catch (error) {
    res.status(400).json({ error: "invalid", message: (error as Error).message });
  }
});

bypassRouter.post("/:id/approve", requirePermission("bypass:approve"), (req, res) => {
  try {
    res.json(resolveBypassRequest(req.params.id, "approved", req.userId, req.body?.note));
  } catch (error) {
    res.status(400).json({ error: "invalid", message: (error as Error).message });
  }
});

bypassRouter.post("/:id/reject", requirePermission("bypass:approve"), (req, res) => {
  try {
    res.json(resolveBypassRequest(req.params.id, "rejected", req.userId, req.body?.note));
  } catch (error) {
    res.status(400).json({ error: "invalid", message: (error as Error).message });
  }
});
