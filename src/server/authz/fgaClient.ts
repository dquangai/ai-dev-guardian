import { OpenFgaClient } from "@openfga/sdk";

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

export async function checkRelation(userId: string, relation: string, object: string): Promise<boolean> {
  const fga = resolveFgaClient();
  if (!fga) {
    throw new Error(
      "OpenFGA client not configured — set FGA_API_URL and FGA_STORE_ID (see authz/README.md)."
    );
  }
  const response = await fga.check({ user: `user:${userId}`, relation, object });
  return response.allowed ?? false;
}
