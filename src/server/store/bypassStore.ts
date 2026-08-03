import path from "node:path";
import { DEFAULT_POLICY_DIR } from "../../policy/loader";
import { JsonArrayStore } from "./jsonStore";

export type BypassStatus = "pending" | "approved" | "rejected";

export interface BypassRequest {
  id: string;
  auditId?: string;
  reason: string;
  requestedBy: string;
  requestedAt: string;
  status: BypassStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
}

const BYPASS_PATH = path.join(DEFAULT_POLICY_DIR, "..", "bypass-requests.json");
const store = new JsonArrayStore<BypassRequest>(BYPASS_PATH);

export function listBypassRequests(status?: BypassStatus): BypassRequest[] {
  const all = store.readAll();
  return status ? all.filter((r) => r.status === status) : all;
}

export function createBypassRequest(input: {
  auditId?: string;
  reason: string;
  requestedBy: string;
}): BypassRequest {
  if (!input.reason.trim()) throw new Error("A bypass request must include a reason.");
  const request: BypassRequest = {
    ...input,
    id: `bypass-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    requestedAt: new Date().toISOString(),
    status: "pending",
  };
  store.append(request, 200);
  return request;
}

export function resolveBypassRequest(
  id: string,
  decision: "approved" | "rejected",
  reviewedBy: string,
  reviewNote?: string
): BypassRequest {
  const all = store.readAll();
  const request = all.find((r) => r.id === id);
  if (!request) throw new Error(`Bypass request "${id}" not found.`);
  if (request.status !== "pending") throw new Error(`Bypass request "${id}" already resolved.`);

  request.status = decision;
  request.reviewedBy = reviewedBy;
  request.reviewedAt = new Date().toISOString();
  request.reviewNote = reviewNote;
  store.writeAll(all);
  return request;
}
