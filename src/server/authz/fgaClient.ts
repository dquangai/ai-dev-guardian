import { ClientWriteRequestOnDuplicateWrites, ClientWriteRequestOnMissingDeletes, OpenFgaClient } from "@openfga/sdk";

let client: OpenFgaClient | null = null;

/** Lazily builds the OpenFGA client from env vars (FGA_API_URL, FGA_STORE_ID, FGA_MODEL_ID) — see
 * authz/README.md for how to stand up a local instance (T-19: authz/setup.sh). Returns null when
 * unconfigured so requireRelation() can fail loudly instead of silently misbehaving. */
function resolveFgaClient(): OpenFgaClient | null {
  if (client) return client;
  const apiUrl = process.env.FGA_API_URL;
  const storeId = process.env.FGA_STORE_ID;
  if (!apiUrl || !storeId) return null;

  client = new OpenFgaClient({
    apiUrl,
    storeId,
    authorizationModelId: process.env.FGA_MODEL_ID,
  });
  return client;
}

/** Reset the memoized client — tests only (so each test can point at a fresh mock/instance). */
export function _resetFgaClientForTests(): void {
  client = null;
}

function requireFgaClient(): OpenFgaClient {
  const fga = resolveFgaClient();
  if (!fga) {
    throw new Error(
      "OpenFGA client not configured — set FGA_API_URL and FGA_STORE_ID (see authz/README.md)."
    );
  }
  return fga;
}

export async function checkRelation(userId: string, relation: string, object: string): Promise<boolean> {
  const response = await requireFgaClient().check({ user: `user:${userId}`, relation, object });
  return response.allowed ?? false;
}

export interface Tuple {
  user: string;
  relation: string;
  object: string;
}

/** Idempotent by design (onDuplicateWrites: "ignore") — safe to re-run a migration script that
 * calls this against tuples that already exist, matching T-21's "chạy lại được" requirement. */
export async function writeTuples(tuples: Tuple[]): Promise<void> {
  await requireFgaClient().writeTuples(tuples, {
    conflict: { onDuplicateWrites: ClientWriteRequestOnDuplicateWrites.Ignore },
  });
}

/** T-22: best-effort tuple write for record-creation side effects (new audit_record/
 * bypass_request/policy needs a `team`/`owner` tuple the moment it's created, or nobody can ever
 * satisfy `can_view` on it). Never throws — a request that creates a resource must still succeed
 * when GUARDIAN_AUTHZ_MODE is off (client unconfigured) or OpenFGA is briefly unreachable; the
 * resource is still fully usable via the old RBAC path in that case, same as before this file
 * existed. Logs loudly so a persistently-failing write doesn't go unnoticed forever. */
export async function tryWriteTuples(tuples: Tuple[]): Promise<void> {
  try {
    if (!resolveFgaClient()) return;
    await writeTuples(tuples);
  } catch (error) {
    console.error(
      `[guardian] Ghi tuple OpenFGA lúc tạo resource thất bại (fail-open, resource vẫn tạo được, nhưng có thể chưa check được qua OpenFGA cho tới khi vá): ${error instanceof Error ? error.message : error}`
    );
  }
}

/** Idempotent by design (onMissingDeletes: "ignore") — deleting a tuple that's already gone (or
 * never existed, e.g. a user being added to their first team) is not an error. */
export async function deleteTuples(tuples: Tuple[]): Promise<void> {
  await requireFgaClient().deleteTuples(tuples, {
    conflict: { onMissingDeletes: ClientWriteRequestOnMissingDeletes.Ignore },
  });
}

/** T-23: best-effort tuple delete, mirrors tryWriteTuples() — used when moving a demo user between
 * teams (delete the old team-relation tuple). Never throws: same fail-open reasoning as
 * tryWriteTuples, moving a user must still succeed via the teamId field even if OpenFGA is
 * unconfigured or briefly unreachable. */
export async function tryDeleteTuples(tuples: Tuple[]): Promise<void> {
  try {
    if (!resolveFgaClient()) return;
    await deleteTuples(tuples);
  } catch (error) {
    console.error(
      `[guardian] Xoá tuple OpenFGA lúc chuyển/xoá thành viên team thất bại (fail-open, việc chuyển team vẫn áp dụng, nhưng có thể chưa check được qua OpenFGA cho tới khi vá): ${error instanceof Error ? error.message : error}`
    );
  }
}

/** T-22: list-endpoint filtering — OpenFGA's single-object check() has no "give me every object I
 * can view" verb built into this small wrapper, so for the handful of records this app deals with
 * (audits, bypass requests, policies), checking each item is simple, correct, and plenty fast at
 * this scale. Runs checks in parallel. */
export async function filterAllowed<T>(
  items: T[],
  userId: string,
  relation: string,
  objectFor: (item: T) => string
): Promise<T[]> {
  const decisions = await Promise.all(items.map((item) => checkRelation(userId, relation, objectFor(item))));
  return items.filter((_, index) => decisions[index]);
}
