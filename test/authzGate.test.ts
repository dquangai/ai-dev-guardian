import { describe, it, expect, vi, afterEach } from "vitest";
import type { Request, Response } from "express";

vi.mock("../src/server/authMiddleware", () => ({
  requirePermission: vi.fn((permission: string) => `requirePermission(${permission})`),
}));
vi.mock("../src/server/authz/requireRelation", () => ({
  requireRelation: vi.fn(
    (objectType: string, relation: string) => `requireRelation(${objectType}, ${relation})`
  ),
}));
vi.mock("../src/server/authz/fgaClient", () => ({
  checkRelation: vi.fn(),
  filterAllowed: vi.fn(),
}));
vi.mock("../src/server/rbac", () => ({
  hasPermission: vi.fn(),
}));

import { requirePermission } from "../src/server/authMiddleware";
import { requireRelation } from "../src/server/authz/requireRelation";
import { checkRelation, filterAllowed } from "../src/server/authz/fgaClient";
import { hasPermission } from "../src/server/rbac";
import { authzGate, hasRelationOrPermission, listGate, listRouteGate } from "../src/server/authz/authzGate";

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

describe("listGate (T-22)", () => {
  const originalEnv = process.env.GUARDIAN_AUTHZ_MODE;
  const items = [{ id: "a" }, { id: "b" }];

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.GUARDIAN_AUTHZ_MODE;
    else process.env.GUARDIAN_AUTHZ_MODE = originalEnv;
    vi.mocked(filterAllowed).mockClear();
  });

  it("flag tắt: trả nguyên items, không gọi filterAllowed (giữ đúng hành vi cũ, kể cả bug T-09 cũ đã fix riêng)", async () => {
    delete process.env.GUARDIAN_AUTHZ_MODE;
    const result = await listGate("dev-1", items, {
      objectType: "policy",
      relation: "can_view",
      objectIdFor: (i) => i.id,
    });
    expect(result).toBe(items);
    expect(filterAllowed).not.toHaveBeenCalled();
  });

  it("flag bật: lọc qua filterAllowed() thật", async () => {
    process.env.GUARDIAN_AUTHZ_MODE = "fga";
    vi.mocked(filterAllowed).mockResolvedValue([items[0]]);
    const result = await listGate("dev-1", items, {
      objectType: "policy",
      relation: "can_view",
      objectIdFor: (i) => i.id,
    });
    expect(filterAllowed).toHaveBeenCalledWith(items, "dev-1", "can_view", expect.any(Function));
    expect(result).toEqual([items[0]]);
  });
});

describe("listRouteGate (T-22)", () => {
  const originalEnv = process.env.GUARDIAN_AUTHZ_MODE;

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.GUARDIAN_AUTHZ_MODE;
    else process.env.GUARDIAN_AUTHZ_MODE = originalEnv;
    vi.mocked(requirePermission).mockClear();
  });

  it("flag tắt: dùng đúng requirePermission() cũ", () => {
    delete process.env.GUARDIAN_AUTHZ_MODE;
    listRouteGate("policy:view");
    expect(requirePermission).toHaveBeenCalledWith("policy:view");
  });

  it("flag bật: cho qua thẳng (next()) — filtering thật nằm trong listGate() phía sau", () => {
    process.env.GUARDIAN_AUTHZ_MODE = "fga";
    const middleware = listRouteGate("policy:view");
    const next = vi.fn();
    middleware({} as Request, {} as Response, next);
    expect(next).toHaveBeenCalledOnce();
    expect(requirePermission).not.toHaveBeenCalled();
  });
});

describe("hasRelationOrPermission (T-22)", () => {
  const originalEnv = process.env.GUARDIAN_AUTHZ_MODE;
  const req = { userId: "dev-1", role: "developer" } as Request;

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.GUARDIAN_AUTHZ_MODE;
    else process.env.GUARDIAN_AUTHZ_MODE = originalEnv;
    vi.mocked(hasPermission).mockClear();
    vi.mocked(checkRelation).mockClear();
  });

  it("flag tắt: dùng hasPermission() cũ", async () => {
    delete process.env.GUARDIAN_AUTHZ_MODE;
    vi.mocked(hasPermission).mockReturnValue(true);
    const result = await hasRelationOrPermission(req, "policy:edit-direct", {
      objectType: "policy",
      relation: "can_edit_direct",
      object: "x.policy.md",
    });
    expect(result).toBe(true);
    expect(hasPermission).toHaveBeenCalledWith("developer", "policy:edit-direct");
    expect(checkRelation).not.toHaveBeenCalled();
  });

  it("flag bật: dùng checkRelation() OpenFGA thật, ghép đúng object string", async () => {
    process.env.GUARDIAN_AUTHZ_MODE = "fga";
    vi.mocked(checkRelation).mockResolvedValue(true);
    const result = await hasRelationOrPermission(req, "policy:edit-direct", {
      objectType: "policy",
      relation: "can_edit_direct",
      object: "x.policy.md",
    });
    expect(result).toBe(true);
    expect(checkRelation).toHaveBeenCalledWith("dev-1", "can_edit_direct", "policy:x.policy.md");
    expect(hasPermission).not.toHaveBeenCalled();
  });
});
