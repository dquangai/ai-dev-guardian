import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { DEFAULT_POLICY_DIR, loadPolicies } from "../../policy/loader";
import type { Policy } from "../../policy/types";
import { JsonArrayStore } from "./jsonStore";

export interface PolicyWithSource extends Policy {
  /** Raw markdown (frontmatter + body) as stored on disk, for the editor. */
  raw: string;
}

export type ChangeRequestAction = "create" | "update" | "delete";
export type ChangeRequestStatus = "pending" | "approved" | "rejected";

export interface PolicyChangeRequest {
  id: string;
  policyId: string;
  action: ChangeRequestAction;
  /** Full raw markdown to write on approval. Absent for "delete". */
  content?: string;
  submittedBy: string;
  submittedAt: string;
  status: ChangeRequestStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
}

const REQUESTS_PATH = path.join(DEFAULT_POLICY_DIR, "..", "policy-requests.json");
const requestStore = new JsonArrayStore<PolicyChangeRequest>(REQUESTS_PATH);

function policyPath(id: string): string {
  return path.join(DEFAULT_POLICY_DIR, id);
}

export function listPolicies(): PolicyWithSource[] {
  return loadPolicies().map((policy) => ({
    ...policy,
    raw: fs.readFileSync(policyPath(policy.id), "utf-8"),
  }));
}

export function getPolicy(id: string): PolicyWithSource | null {
  const filePath = policyPath(id);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf-8");
  const policy = loadPolicies().find((p) => p.id === id);
  if (!policy) return null;
  return { ...policy, raw };
}

/** Validates that raw markdown at least parses as frontmatter + body before it ever touches disk. */
export function assertValidPolicyContent(raw: string): void {
  const { data, content } = matter(raw);
  if (!content.trim()) throw new Error("Policy body cannot be empty.");
  if (data.scope !== undefined && !Array.isArray(data.scope)) {
    throw new Error('Frontmatter "scope" must be an array of glob patterns.');
  }
}

function isSafePolicyId(id: string): boolean {
  return /^[\w.-]+\.policy\.md$/.test(id);
}

export function writePolicyFile(id: string, raw: string): void {
  if (!isSafePolicyId(id)) {
    throw new Error('Policy id must look like "name.policy.md" (letters, digits, - and _ only).');
  }
  assertValidPolicyContent(raw);
  fs.mkdirSync(DEFAULT_POLICY_DIR, { recursive: true });
  fs.writeFileSync(policyPath(id), raw, "utf-8");
}

export function deletePolicyFile(id: string): void {
  const filePath = policyPath(id);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

export function listChangeRequests(status?: ChangeRequestStatus): PolicyChangeRequest[] {
  const all = requestStore.readAll();
  return status ? all.filter((r) => r.status === status) : all;
}

export function submitChangeRequest(
  input: Omit<PolicyChangeRequest, "id" | "submittedAt" | "status">
): PolicyChangeRequest {
  if (input.action !== "delete" && input.content) assertValidPolicyContent(input.content);
  if (!isSafePolicyId(input.policyId)) {
    throw new Error('Policy id must look like "name.policy.md" (letters, digits, - and _ only).');
  }
  const request: PolicyChangeRequest = {
    ...input,
    id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    submittedAt: new Date().toISOString(),
    status: "pending",
  };
  requestStore.append(request, 200);
  return request;
}

export function resolveChangeRequest(
  id: string,
  decision: "approved" | "rejected",
  reviewedBy: string,
  reviewNote?: string
): PolicyChangeRequest {
  const all = requestStore.readAll();
  const request = all.find((r) => r.id === id);
  if (!request) throw new Error(`Change request "${id}" not found.`);
  if (request.status !== "pending") throw new Error(`Change request "${id}" already resolved.`);

  request.status = decision;
  request.reviewedBy = reviewedBy;
  request.reviewedAt = new Date().toISOString();
  request.reviewNote = reviewNote;

  if (decision === "approved") {
    if (request.action === "delete") deletePolicyFile(request.policyId);
    else if (request.content) writePolicyFile(request.policyId, request.content);
  }

  requestStore.writeAll(all);
  return request;
}
