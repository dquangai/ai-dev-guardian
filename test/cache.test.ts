import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { hashDiffText, readCache, writeCache } from "../src/cache";

describe("hashDiffText", () => {
  it("cùng nội dung luôn cho cùng một hash", () => {
    expect(hashDiffText("abc")).toBe(hashDiffText("abc"));
  });

  it("nội dung khác nhau cho hash khác nhau", () => {
    expect(hashDiffText("abc")).not.toBe(hashDiffText("abcd"));
  });

  it("trả về chuỗi hex SHA-256 (64 ký tự)", () => {
    expect(hashDiffText("")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("readCache / writeCache", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "guardian-cache-test-"));
    fs.mkdirSync(path.join(tmpDir, ".git"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("trả về null khi chưa có file cache", () => {
    expect(readCache(tmpDir)).toBeNull();
  });

  it("writeCache rồi readCache đọc lại đúng hash vừa ghi", () => {
    writeCache("deadbeef", tmpDir);
    expect(readCache(tmpDir)).toEqual({ passedDiffHashes: ["deadbeef"] });
  });

  it("giữ lại cả hash cũ khi writeCache gọi lại với hash mới (LRU, mới nhất lên đầu)", () => {
    writeCache("hash-1", tmpDir);
    writeCache("hash-2", tmpDir);
    expect(readCache(tmpDir)).toEqual({ passedDiffHashes: ["hash-2", "hash-1"] });
  });

  it("đưa hash đã tồn tại lên đầu danh sách thay vì lưu trùng lặp", () => {
    writeCache("hash-1", tmpDir);
    writeCache("hash-2", tmpDir);
    writeCache("hash-1", tmpDir);
    expect(readCache(tmpDir)).toEqual({ passedDiffHashes: ["hash-1", "hash-2"] });
  });

  it("giới hạn tối đa 20 hash, loại bỏ hash cũ nhất khi vượt quá", () => {
    for (let i = 0; i < 25; i++) writeCache(`hash-${i}`, tmpDir);
    const cache = readCache(tmpDir);
    expect(cache?.passedDiffHashes).toHaveLength(20);
    expect(cache?.passedDiffHashes[0]).toBe("hash-24");
    expect(cache?.passedDiffHashes).not.toContain("hash-4");
  });

  it("trả về null (không throw) nếu file cache là JSON hỏng", () => {
    fs.writeFileSync(path.join(tmpDir, ".git", "guardian_cache.json"), "{not valid json");
    expect(readCache(tmpDir)).toBeNull();
  });

  it("trả về null (không throw) nếu file cache thiếu field passedDiffHashes", () => {
    fs.writeFileSync(path.join(tmpDir, ".git", "guardian_cache.json"), JSON.stringify({ foo: "bar" }));
    expect(readCache(tmpDir)).toBeNull();
  });

  it("trả về null nếu passedDiffHashes không phải mảng string", () => {
    fs.writeFileSync(
      path.join(tmpDir, ".git", "guardian_cache.json"),
      JSON.stringify({ passedDiffHashes: [1, 2, 3] })
    );
    expect(readCache(tmpDir)).toBeNull();
  });

  it("writeCache không throw khi .git không tồn tại (best-effort)", () => {
    const noGitDir = fs.mkdtempSync(path.join(os.tmpdir(), "guardian-cache-nogit-"));
    expect(() => writeCache("abc", noGitDir)).not.toThrow();
    expect(readCache(noGitDir)).toBeNull();
    fs.rmSync(noGitDir, { recursive: true, force: true });
  });
});
