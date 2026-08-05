import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { DEFAULT_POLICY_DIR, loadPolicies } from "../../policy/loader";
import type { Policy } from "../../policy/types";
import { JsonArrayStore } from "./jsonStore";

export interface PolicyWithSource extends Policy {
  /** Raw markdown (frontmatter + body) as stored on disk, for the editor. */
  raw: string;
  /** Auto-managed metadata (T-17), absent on policies never written through writePolicyFile(). */
  version?: number;
  lastUpdated?: string;
  updatedBy?: string;
  changeSummary?: string;
}

export type ChangeRequestAction = "create" | "update" | "delete";
export type ChangeRequestStatus = "pending" | "approved" | "rejected";

export interface PolicyChangeRequest {
  id: string;
  policyId: string;
  action: ChangeRequestAction;
  /** Full raw markdown to write on approval. Absent for "delete". */
  content?: string;
  /** T-17: human-readable summary of what changed, carried onto the policy's frontmatter on approval. */
  changeSummary?: string;
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

/** Reads the T-17 auto-managed fields back out of frontmatter; absent/malformed values are left undefined
 * rather than defaulted, so callers can tell "never written through writePolicyFile()" from "version 1". */
function parseMetadata(raw: string): Pick<PolicyWithSource, "version" | "lastUpdated" | "updatedBy" | "changeSummary"> {
  const { data } = matter(raw);
  return {
    version: typeof data.version === "number" ? data.version : undefined,
    lastUpdated: typeof data.lastUpdated === "string" ? data.lastUpdated : undefined,
    updatedBy: typeof data.updatedBy === "string" ? data.updatedBy : undefined,
    changeSummary: typeof data.changeSummary === "string" ? data.changeSummary : undefined,
  };
}

export function listPolicies(): PolicyWithSource[] {
  return loadPolicies().map((policy) => {
    const raw = fs.readFileSync(policyPath(policy.id), "utf-8");
    return { ...policy, raw, ...parseMetadata(raw) };
  });
}

export function getPolicy(id: string): PolicyWithSource | null {
  const filePath = policyPath(id);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf-8");
  const policy = loadPolicies().find((p) => p.id === id);
  if (!policy) return null;
  return { ...policy, raw, ...parseMetadata(raw) };
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

export interface PolicyWriteMeta {
  /** Who authored this content — the direct editor, or the original change-request submitter on approval. */
  updatedBy: string;
  changeSummary?: string;
}

/** Pure step, split out from writePolicyFile so version-bump/metadata-injection is testable without disk I/O. */
export function buildPolicyFileContent(raw: string, previousVersion: number | undefined, meta: PolicyWriteMeta): string {
  const { data, content } = matter(raw);
  return matter.stringify(
    content,
    {
      ...data,
      version: (previousVersion ?? 0) + 1,
      lastUpdated: new Date().toISOString(),
      updatedBy: meta.updatedBy,
      changeSummary: meta.changeSummary ?? "",
    },
    // js-yaml re-serializes the *entire* frontmatter on every write; lineWidth: -1 stops it from
    // re-wrapping long scalar strings (e.g. rule descriptions) into folded block scalars, which
    // would otherwise turn a one-field metadata bump into a large, unrelated-looking diff.
    // gray-matter's .d.ts omits js-yaml passthrough options even though its own docs say they're
    // forwarded — cast is for the type gap, not a runtime workaround.
    { lineWidth: -1 } as Parameters<typeof matter.stringify>[2]
  );
}

export function writePolicyFile(id: string, raw: string, meta: PolicyWriteMeta): void {
  if (!isSafePolicyId(id)) {
    throw new Error('Policy id must look like "name.policy.md" (letters, digits, - and _ only).');
  }
  assertValidPolicyContent(raw);
  fs.mkdirSync(DEFAULT_POLICY_DIR, { recursive: true });

  const filePath = policyPath(id);
  const previousVersion = fs.existsSync(filePath) ? parseMetadata(fs.readFileSync(filePath, "utf-8")).version : undefined;
  fs.writeFileSync(filePath, buildPolicyFileContent(raw, previousVersion, meta), "utf-8");
}

export function deletePolicyFile(id: string): void {
  const filePath = policyPath(id);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

/** T-10: writes only ever touch the local filesystem — no auto commit/push (see docs/sprint-plan.html).
 * Callers surface this hint to the client so a human commits the change themselves. */
export function gitSyncHint(id: string, action: "write" | "delete"): string {
  const filePath = policyPath(id);
  const gitCmd = action === "delete" ? `git rm ${filePath}` : `git add ${filePath}`;
  const verb = action === "delete" ? "remove" : "update";
  return `Đã ${action === "delete" ? "xoá" : "ghi"} ${filePath} cục bộ — CHƯA commit/push. Chạy thủ công: ${gitCmd} && git commit -m "policy: ${verb} ${id}" && git push`;
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
    else if (request.content) {
      writePolicyFile(request.policyId, request.content, {
        updatedBy: request.submittedBy,
        changeSummary: request.changeSummary,
      });
    }
  }

  requestStore.writeAll(all);
  return request;
}
