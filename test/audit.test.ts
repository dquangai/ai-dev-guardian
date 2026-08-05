import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

vi.mock("../src/server/store/auditStore", () => ({
  listAuditHistory: vi.fn().mockReturnValue([]),
  recordAudit: vi.fn(),
}));

import { listAuditHistory } from "../src/server/store/auditStore";
import { auditRouter } from "../src/server/routes/audit";

interface RouteLayer {
  route?: { path: string; methods: Record<string, boolean>; stack: { handle: (req: Request, res: Response) => void }[] };
}

function getHandler(method: string, path: string) {
  const layer = (auditRouter.stack as RouteLayer[]).find((l) => l.route?.path === path && l.route.methods[method]);
  if (!layer?.route) throw new Error(`route ${method} ${path} not found`);
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

function mockReq(overrides: Partial<Request>): Request {
  return { query: {}, ...overrides } as Request;
}

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.json = vi.fn().mockReturnValue(res) as Response["json"];
  res.status = vi.fn().mockReturnValue(res) as Response["status"];
  return res as Response;
}

describe("GET /api/audit/history", () => {
  const handler = getHandler("get", "/history");

  beforeEach(() => {
    vi.mocked(listAuditHistory).mockClear();
  });

  it("không truyền triggeredBy filter cho role admin", () => {
    const req = mockReq({ role: "admin", userId: "admin-1" } as Partial<Request>);
    handler(req, mockRes());
    expect(listAuditHistory).toHaveBeenCalledWith(undefined, undefined);
  });

  it("không truyền triggeredBy filter cho role senior-dev", () => {
    const req = mockReq({ role: "senior-dev", userId: "sd-1" } as Partial<Request>);
    handler(req, mockRes());
    expect(listAuditHistory).toHaveBeenCalledWith(undefined, undefined);
  });

  it("không truyền triggeredBy filter cho role auditor", () => {
    const req = mockReq({ role: "auditor", userId: "aud-1" } as Partial<Request>);
    handler(req, mockRes());
    expect(listAuditHistory).toHaveBeenCalledWith(undefined, undefined);
  });

  it("truyền req.userId làm triggeredBy filter khi role là developer", () => {
    const req = mockReq({ role: "developer", userId: "dev-42" } as Partial<Request>);
    handler(req, mockRes());
    expect(listAuditHistory).toHaveBeenCalledWith(undefined, "dev-42");
  });

  it("vẫn giữ đúng limit query param cùng với filter developer", () => {
    const req = mockReq({ role: "developer", userId: "dev-42", query: { limit: "5" } } as Partial<Request>);
    handler(req, mockRes());
    expect(listAuditHistory).toHaveBeenCalledWith(5, "dev-42");
  });
});
