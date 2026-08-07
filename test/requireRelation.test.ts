import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

vi.mock("../src/server/authz/fgaClient", () => ({
  checkRelation: vi.fn(),
}));

import { checkRelation } from "../src/server/authz/fgaClient";
import { requireRelation } from "../src/server/authz/requireRelation";

function mockReq(userId: string, params: Record<string, string> = {}): Request {
  return { userId, params } as unknown as Request;
}

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res) as Response["status"];
  res.json = vi.fn().mockReturnValue(res) as Response["json"];
  return res as Response;
}

describe("requireRelation", () => {
  beforeEach(() => {
    vi.mocked(checkRelation).mockReset();
  });

  it("gọi next() khi checkRelation trả về true", async () => {
    vi.mocked(checkRelation).mockResolvedValue(true);
    const middleware = requireRelation("policy", "can_view", (req) => req.params.id);
    const req = mockReq("admin-1", { id: "sso-redirect.policy.md" });
    const res = mockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(checkRelation).toHaveBeenCalledWith("admin-1", "can_view", "policy:sso-redirect.policy.md");
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("403 khi checkRelation trả về false, không gọi next()", async () => {
    vi.mocked(checkRelation).mockResolvedValue(false);
    const middleware = requireRelation("policy", "can_edit_direct", (req) => req.params.id);
    const req = mockReq("developer-1", { id: "security.policy.md" });
    const res = mockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("500 (không throw ra ngoài) khi checkRelation lỗi (vd OpenFGA không kết nối được)", async () => {
    vi.mocked(checkRelation).mockRejectedValue(new Error("connect ECONNREFUSED"));
    const middleware = requireRelation("policy", "can_view", (req) => req.params.id);
    const req = mockReq("admin-1", { id: "x.policy.md" });
    const res = mockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });

  it("T-26: objectIdFrom trả về rỗng (vd Super Admin chưa chọn team) -> 403 thẳng, không gọi checkRelation", async () => {
    const middleware = requireRelation("team", "member", () => "");
    const req = mockReq("super-admin-1");
    const res = mockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(checkRelation).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("build đúng object string từ objectIdFrom tuỳ biến (vd resolve qua change request)", async () => {
    vi.mocked(checkRelation).mockResolvedValue(true);
    const middleware = requireRelation("policy", "can_approve", () => "resolved-policy-id.policy.md");
    const req = mockReq("senior-dev-1", { id: "req-123" });
    const res = mockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(checkRelation).toHaveBeenCalledWith(
      "senior-dev-1",
      "can_approve",
      "policy:resolved-policy-id.policy.md"
    );
  });
});
