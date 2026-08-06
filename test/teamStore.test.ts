import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTeam, getTeam, listTeams } from "../src/server/store/teamStore";

describe("teamStore", () => {
  let originalCwd: string;
  let tmpDir: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "guardian-teamstore-test-"));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("listTeams() trả về mảng rỗng khi chưa có team nào", () => {
    expect(listTeams()).toEqual([]);
  });

  it("createTeam() rồi getTeam() đọc lại đúng team vừa tạo", () => {
    const team = createTeam({ id: "team-default", name: "Default Team", createdBy: "super-admin-1" });
    expect(team.id).toBe("team-default");
    expect(typeof team.createdAt).toBe("string");

    const fetched = getTeam("team-default");
    expect(fetched).toEqual(team);
  });

  it("getTeam() trả về null nếu không tồn tại", () => {
    expect(getTeam("khong-ton-tai")).toBeNull();
  });

  it("createTeam() throw nếu id đã tồn tại (không cho tạo trùng)", () => {
    createTeam({ id: "team-default", name: "Default Team", createdBy: "super-admin-1" });
    expect(() => createTeam({ id: "team-default", name: "Khác", createdBy: "x" })).toThrow(/already exists/);
  });

  it("listTeams() liệt kê đủ nhiều team đã tạo", () => {
    createTeam({ id: "team-a", name: "A", createdBy: "super-admin-1" });
    createTeam({ id: "team-b", name: "B", createdBy: "super-admin-1" });
    expect(listTeams().map((t) => t.id).sort()).toEqual(["team-a", "team-b"]);
  });
});
