import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockCheck = vi.fn();
const mockWriteTuples = vi.fn();
vi.mock("@openfga/sdk", () => ({
  OpenFgaClient: vi.fn().mockImplementation(() => ({ check: mockCheck, writeTuples: mockWriteTuples })),
  ClientWriteRequestOnDuplicateWrites: { Error: "error", Ignore: "ignore" },
}));

import { OpenFgaClient } from "@openfga/sdk";
import {
  checkRelation,
  filterAllowed,
  tryWriteTuples,
  writeTuples,
  _resetFgaClientForTests,
} from "../src/server/authz/fgaClient";

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

describe("filterAllowed (T-22)", () => {
  beforeEach(() => {
    _resetFgaClientForTests();
    mockCheck.mockReset();
    process.env.FGA_API_URL = "http://localhost:8080";
    process.env.FGA_STORE_ID = "store-1";
  });

  afterEach(() => {
    delete process.env.FGA_API_URL;
    delete process.env.FGA_STORE_ID;
  });

  it("chỉ giữ lại item mà checkRelation() trả về true, gọi song song cho mọi item", async () => {
    const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
    mockCheck.mockImplementation(({ object }: { object: string }) =>
      Promise.resolve({ allowed: object === "policy:a" || object === "policy:c" })
    );

    const result = await filterAllowed(items, "dev-1", "can_view", (item) => `policy:${item.id}`);

    expect(result).toEqual([{ id: "a" }, { id: "c" }]);
    expect(mockCheck).toHaveBeenCalledTimes(3);
  });

  it("trả về [] nếu không item nào được phép", async () => {
    mockCheck.mockResolvedValue({ allowed: false });
    const result = await filterAllowed([{ id: "a" }], "dev-1", "can_view", (item) => `policy:${item.id}`);
    expect(result).toEqual([]);
  });
});

describe("tryWriteTuples (T-22) — best-effort, không bao giờ throw", () => {
  beforeEach(() => {
    _resetFgaClientForTests();
    mockWriteTuples.mockReset();
  });

  afterEach(() => {
    delete process.env.FGA_API_URL;
    delete process.env.FGA_STORE_ID;
  });

  it("bỏ qua êm (không throw, không gọi client) khi OpenFGA chưa cấu hình", async () => {
    delete process.env.FGA_API_URL;
    delete process.env.FGA_STORE_ID;
    await expect(
      tryWriteTuples([{ user: "user:x", relation: "owner", object: "audit_record:1" }])
    ).resolves.toBeUndefined();
    expect(mockWriteTuples).not.toHaveBeenCalled();
  });

  it("gọi writeTuples() thật khi đã cấu hình", async () => {
    process.env.FGA_API_URL = "http://localhost:8080";
    process.env.FGA_STORE_ID = "store-1";
    mockWriteTuples.mockResolvedValue(undefined);
    const tuples = [{ user: "user:x", relation: "owner", object: "audit_record:1" }];

    await tryWriteTuples(tuples);

    expect(mockWriteTuples).toHaveBeenCalledWith(tuples, expect.any(Object));
  });

  it("nuốt lỗi (không throw ra ngoài) nếu OpenFGA cấu hình rồi nhưng write thật sự lỗi (vd mạng gián đoạn)", async () => {
    process.env.FGA_API_URL = "http://localhost:8080";
    process.env.FGA_STORE_ID = "store-1";
    mockWriteTuples.mockRejectedValue(new Error("connect ECONNREFUSED"));
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      tryWriteTuples([{ user: "user:x", relation: "owner", object: "audit_record:1" }])
    ).resolves.toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});

describe("writeTuples (dùng bởi migration script) — throw thật nếu chưa cấu hình", () => {
  beforeEach(() => {
    _resetFgaClientForTests();
    delete process.env.FGA_API_URL;
    delete process.env.FGA_STORE_ID;
  });

  it("throw (không nuốt lỗi êm như tryWriteTuples) khi chưa cấu hình — script migration cần biết ngay nếu lỗi", async () => {
    await expect(writeTuples([{ user: "user:x", relation: "owner", object: "audit_record:1" }])).rejects.toThrow(
      /OpenFGA client not configured/
    );
  });
});
