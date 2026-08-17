import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createUser, getUser, getUserByEmail, listUsers, updateUserTeam, SEED_USER_IDS } from "../src/server/store/userStore";

let tmpDir: string;
let originalCwd: string;

beforeAll(() => {
  originalCwd = process.cwd();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "guardian-user-store-"));
  fs.mkdirSync(path.join(tmpDir, ".guardian"), { recursive: true });
  process.chdir(tmpDir);
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("listUsers — seed-if-empty", () => {
  it("seed đúng 5 tài khoản gốc khi .guardian/users.json chưa tồn tại", () => {
    const users = listUsers();
    expect(users).toHaveLength(5);
    expect(users.map((u) => u.id).sort()).toEqual(Object.values(SEED_USER_IDS).sort());
  });

  it("gọi lại lần 2 không tạo trùng (idempotent)", () => {
    expect(listUsers()).toHaveLength(5);
  });
});

describe("createUser", () => {
  it("tạo user mới thành công, id tự sinh, xuất hiện ngay trong listUsers", () => {
    const user = createUser({ name: "Test Person", email: "test.person@backend.guardian.dev", role: "developer", teamId: "team-backend", createdBy: "test" });
    expect(user.id).toBeTruthy();
    expect(getUser(user.id)?.email).toBe("test.person@backend.guardian.dev");
    expect(listUsers()).toHaveLength(6);
  });

  it("email trùng (không phân biệt hoa thường) -> throw", () => {
    expect(() =>
      createUser({ name: "Dup", email: "Test.Person@Backend.Guardian.Dev", role: "auditor", createdBy: "test" })
    ).toThrow(/already exists/);
  });
});

describe("getUserByEmail", () => {
  it("tìm case-insensitive", () => {
    expect(getUserByEmail("ADMIN@GUARDIAN.DEV")?.id).toBe(SEED_USER_IDS.admin);
  });

  it("email không tồn tại -> null", () => {
    expect(getUserByEmail("nobody@guardian.dev")).toBeNull();
  });
});

describe("updateUserTeam", () => {
  it("đổi teamId, persist thật qua getUser (đọc lại từ file)", () => {
    updateUserTeam(SEED_USER_IDS.auditor, "team-security");
    expect(getUser(SEED_USER_IDS.auditor)?.teamId).toBe("team-security");
  });

  it("xoá khỏi team (teamId undefined)", () => {
    updateUserTeam(SEED_USER_IDS.auditor, undefined);
    expect(getUser(SEED_USER_IDS.auditor)?.teamId).toBeUndefined();
  });
});
