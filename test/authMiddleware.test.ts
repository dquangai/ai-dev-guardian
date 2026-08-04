import { describe, it, expect, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { requireAuth } from "../src/server/authMiddleware";
import { signToken } from "../src/server/token";

function mockReq(authHeader?: string): Request {
  return { header: (name: string) => (name.toLowerCase() === "authorization" ? authHeader : undefined) } as Request;
}

function mockRes(): Response & { statusCode?: number; body?: unknown } {
  const res: Partial<Response> & { statusCode?: number; body?: unknown } = {};
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res as Response;
  }) as Response["status"];
  res.json = vi.fn((body: unknown) => {
    res.body = body;
    return res as Response;
  }) as Response["json"];
  return res as Response & { statusCode?: number; body?: unknown };
}

const PAYLOAD = { sub: "senior-dev-1", role: "senior-dev" as const, name: "Jordan Lee", email: "senior.dev@guardian.dev" };

describe("requireAuth", () => {
  it("401s when there is no Authorization header", () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();
    requireAuth(req, res, next as NextFunction);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("401s on a non-Bearer scheme", () => {
    const req = mockReq("Basic dXNlcjpwYXNz");
    const res = mockRes();
    const next = vi.fn();
    requireAuth(req, res, next as NextFunction);
    expect(res.statusCode).toBe(401);
  });

  it("401s on an invalid/tampered token", () => {
    const req = mockReq("Bearer not-a-real-token");
    const res = mockRes();
    const next = vi.fn();
    requireAuth(req, res, next as NextFunction);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("attaches role/userId from a valid token and calls next()", () => {
    const token = signToken(PAYLOAD, false);
    const req = mockReq(`Bearer ${token}`);
    const res = mockRes();
    const next = vi.fn();
    requireAuth(req, res, next as NextFunction);
    expect(next).toHaveBeenCalledOnce();
    expect(req.role).toBe("senior-dev");
    expect(req.userId).toBe("senior-dev-1");
    expect(req.userName).toBe("Jordan Lee");
  });
});
