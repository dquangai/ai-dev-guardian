import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("../src/server/authMiddleware", () => ({
  requirePermission: vi.fn((permission: string) => `requirePermission(${permission})`),
}));
vi.mock("../src/server/authz/requireRelation", () => ({
  requireRelation: vi.fn(
    (objectType: string, relation: string) => `requireRelation(${objectType}, ${relation})`
  ),
}));

import { requirePermission } from "../src/server/authMiddleware";
import { requireRelation } from "../src/server/authz/requireRelation";
import { authzGate } from "../src/server/authz/authzGate";

const FGA_ARGS = { objectType: "policy", relation: "can_view", objectIdFrom: () => "x" };

describe("authzGate (T-20 feature flag)", () => {
  const originalEnv = process.env.GUARDIAN_AUTHZ_MODE;

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.GUARDIAN_AUTHZ_MODE;
    else process.env.GUARDIAN_AUTHZ_MODE = originalEnv;
    vi.mocked(requirePermission).mockClear();
    vi.mocked(requireRelation).mockClear();
  });

  it("mặc định (không set env) dùng requirePermission() cũ — không phá vỡ T-11", () => {
    delete process.env.GUARDIAN_AUTHZ_MODE;
    authzGate("policy:view", FGA_ARGS);
    expect(requirePermission).toHaveBeenCalledWith("policy:view");
    expect(requireRelation).not.toHaveBeenCalled();
  });

  it('GUARDIAN_AUTHZ_MODE="fga" chuyển sang requireRelation() OpenFGA', () => {
    process.env.GUARDIAN_AUTHZ_MODE = "fga";
    authzGate("policy:view", FGA_ARGS);
    expect(requireRelation).toHaveBeenCalledWith("policy", "can_view", FGA_ARGS.objectIdFrom);
    expect(requirePermission).not.toHaveBeenCalled();
  });

  it("giá trị env khác 'fga' vẫn rơi về requirePermission() cũ (fail-safe)", () => {
    process.env.GUARDIAN_AUTHZ_MODE = "something-else";
    authzGate("policy:view", FGA_ARGS);
    expect(requirePermission).toHaveBeenCalledWith("policy:view");
    expect(requireRelation).not.toHaveBeenCalled();
  });
});
