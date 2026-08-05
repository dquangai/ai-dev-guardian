import path from "node:path";
import { DEFAULT_POLICY_DIR } from "../../policy/loader";
import { JsonArrayStore } from "./jsonStore";

/** T-18: per-user read-receipt for policy versions — one row per (userId, policyId) pair. */
export interface PolicyReadReceipt {
  userId: string;
  policyId: string;
  readVersion: number;
}

const READS_PATH = path.join(DEFAULT_POLICY_DIR, "..", "policy-reads.json");
const readStore = new JsonArrayStore<PolicyReadReceipt>(READS_PATH);

export function getReadVersion(userId: string, policyId: string): number {
  return readStore.readAll().find((r) => r.userId === userId && r.policyId === policyId)?.readVersion ?? 0;
}

/** Never lowers readVersion — approving/re-reading an older snapshot can't un-read a newer one. */
export function markPolicyRead(userId: string, policyId: string, version: number): void {
  const all = readStore.readAll();
  const existing = all.find((r) => r.userId === userId && r.policyId === policyId);
  if (existing) {
    existing.readVersion = Math.max(existing.readVersion, version);
  } else {
    all.push({ userId, policyId, readVersion: version });
  }
  readStore.writeAll(all);
}
