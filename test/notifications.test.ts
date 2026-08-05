import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

vi.mock("../src/server/store/policyStore", () => ({
  listPolicies: vi.fn(),
  getPolicy: vi.fn(),
}));
vi.mock("../src/server/store/notificationStore", () => ({
  getReadVersion: vi.fn(),
  markPolicyRead: vi.fn(),
}));

import { listPolicies, getPolicy } from "../src/server/store/policyStore";
import { getReadVersion, markPolicyRead } from "../src/server/store/notificationStore";
import { notificationsRouter } from "../src/server/routes/notifications";

interface RouteLayer {
  route?: { path: string; methods: Record<string, boolean>; stack: { handle: (req: Request, res: Response) => void }[] };
}

function getHandler(method: string, path: string) {
  const layer = (notificationsRouter.stack as RouteLayer[]).find((l) => l.route?.path === path && l.route.methods[method]);
  if (!layer?.route) throw new Error(`route ${method} ${path} not found`);
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

function mockReq(overrides: Partial<Request>): Request {
  return { params: {}, ...overrides } as Request;
}

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.json = vi.fn().mockReturnValue(res) as Response["json"];
  res.status = vi.fn().mockReturnValue(res) as Response["status"];
  return res as Response;
}

describe("GET /api/notifications/policies", () => {
  const handler = getHandler("get", "/policies");

  beforeEach(() => {
    vi.mocked(listPolicies).mockReset();
    vi.mocked(getReadVersion).mockReset();
  });

  it("đánh dấu unread=true khi version hiện tại cao hơn readVersion", () => {
    vi.mocked(listPolicies).mockReturnValue([
      { id: "a.policy.md", version: 3, lastUpdated: "t", updatedBy: "admin-1", changeSummary: "x" } as ReturnType<
        typeof listPolicies
      >[number],
    ]);
    vi.mocked(getReadVersion).mockReturnValue(1);
    const res = mockRes();
    handler(mockReq({ userId: "dev-1" } as Partial<Request>), res);
    expect(res.json).toHaveBeenCalledWith([
      { id: "a.policy.md", version: 3, lastUpdated: "t", updatedBy: "admin-1", changeSummary: "x", unread: true },
    ]);
  });

  it("unread=false khi đã đọc bằng đúng version hiện tại", () => {
    vi.mocked(listPolicies).mockReturnValue([{ id: "a.policy.md", version: 2 } as ReturnType<typeof listPolicies>[number]]);
    vi.mocked(getReadVersion).mockReturnValue(2);
    const res = mockRes();
    handler(mockReq({ userId: "dev-1" } as Partial<Request>), res);
    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body[0].unread).toBe(false);
  });

  it("policy chưa từng qua writePolicyFile (không có version) mặc định coi là version=1", () => {
    vi.mocked(listPolicies).mockReturnValue([{ id: "legacy.policy.md" } as ReturnType<typeof listPolicies>[number]]);
    vi.mocked(getReadVersion).mockReturnValue(0);
    const res = mockRes();
    handler(mockReq({ userId: "dev-1" } as Partial<Request>), res);
    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body[0]).toMatchObject({ version: 1, unread: true });
  });
});

describe("POST /api/notifications/policies/:id/read", () => {
  const handler = getHandler("post", "/policies/:id/read");

  beforeEach(() => {
    vi.mocked(getPolicy).mockReset();
    vi.mocked(markPolicyRead).mockReset();
  });

  it("400 khi policy id không hợp lệ", () => {
    const res = mockRes();
    handler(mockReq({ params: { id: "../evil" }, userId: "dev-1" } as Partial<Request>), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(markPolicyRead).not.toHaveBeenCalled();
  });

  it("404 khi policy không tồn tại", () => {
    vi.mocked(getPolicy).mockReturnValue(null);
    const res = mockRes();
    handler(mockReq({ params: { id: "gone.policy.md" }, userId: "dev-1" } as Partial<Request>), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("gọi markPolicyRead với đúng userId + version hiện tại của policy", () => {
    vi.mocked(getPolicy).mockReturnValue({ id: "a.policy.md", version: 4 } as ReturnType<typeof getPolicy>);
    const res = mockRes();
    handler(mockReq({ params: { id: "a.policy.md" }, userId: "dev-1" } as Partial<Request>), res);
    expect(markPolicyRead).toHaveBeenCalledWith("dev-1", "a.policy.md", 4);
    expect(res.json).toHaveBeenCalledWith({ status: "ok" });
  });
});
