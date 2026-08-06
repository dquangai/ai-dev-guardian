import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockCheck = vi.fn();
vi.mock("@openfga/sdk", () => ({
  OpenFgaClient: vi.fn().mockImplementation(() => ({ check: mockCheck })),
}));

import { OpenFgaClient } from "@openfga/sdk";
import { checkRelation, _resetFgaClientForTests } from "../src/server/authz/fgaClient";

const ENV_KEYS = ["FGA_API_URL", "FGA_STORE_ID", "FGA_MODEL_ID"] as const;

describe("checkRelation", () => {
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
    _resetFgaClientForTests();
    mockCheck.mockReset();
    vi.mocked(OpenFgaClient).mockClear();
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
  });

  it("throw rõ ràng khi chưa cấu hình FGA_API_URL/FGA_STORE_ID (không âm thầm cho qua)", async () => {
    delete process.env.FGA_API_URL;
    delete process.env.FGA_STORE_ID;

    await expect(checkRelation("admin-1", "can_view", "policy:x")).rejects.toThrow(
      /OpenFGA client not configured/
    );
    expect(OpenFgaClient).not.toHaveBeenCalled();
  });

  it("gọi client.check() với đúng user/relation/object khi đã cấu hình, trả về allowed", async () => {
    process.env.FGA_API_URL = "http://localhost:8080";
    process.env.FGA_STORE_ID = "store-1";
    mockCheck.mockResolvedValue({ allowed: true });

    const result = await checkRelation("admin-1", "can_view", "policy:x");

    expect(OpenFgaClient).toHaveBeenCalledWith(
      expect.objectContaining({ apiUrl: "http://localhost:8080", storeId: "store-1" })
    );
    expect(mockCheck).toHaveBeenCalledWith({ user: "user:admin-1", relation: "can_view", object: "policy:x" });
    expect(result).toBe(true);
  });

  it("trả về false khi response.allowed là false/undefined, không throw", async () => {
    process.env.FGA_API_URL = "http://localhost:8080";
    process.env.FGA_STORE_ID = "store-1";
    mockCheck.mockResolvedValue({ allowed: false });

    expect(await checkRelation("developer-1", "can_edit_direct", "policy:x")).toBe(false);
  });

  it("chỉ tạo OpenFgaClient 1 lần (memoized), không tạo lại mỗi lần gọi", async () => {
    process.env.FGA_API_URL = "http://localhost:8080";
    process.env.FGA_STORE_ID = "store-1";
    mockCheck.mockResolvedValue({ allowed: true });

    await checkRelation("admin-1", "can_view", "policy:x");
    await checkRelation("admin-1", "can_view", "policy:y");

    expect(OpenFgaClient).toHaveBeenCalledTimes(1);
    expect(mockCheck).toHaveBeenCalledTimes(2);
  });
});
