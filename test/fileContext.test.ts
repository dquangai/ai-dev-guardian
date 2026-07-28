import path from "node:path";
import { describe, it, expect } from "vitest";
import { readFileContextSafe, readSatelliteFiles } from "../src/checks/llm/fileContext";

const CWD = path.join(__dirname, "fixtures", "rag");

describe("readSatelliteFiles", () => {
  it("chỉ lấy tối đa 3 file vệ tinh, bỏ qua import node_modules và import không resolve được", () => {
    const mainContent = readFileContextSafe("main.ts", CWD);
    expect(mainContent).not.toBeNull();

    const satellites = readSatelliteFiles("main.ts", mainContent, CWD);

    expect(satellites).toHaveLength(3);
    expect(satellites.map((s) => s.importPath)).toEqual(["./a", "./b", "./c"]);
    // "./d" bị loại vì đã đủ 3; "./missing" (không resolve được) và
    // "node:fs" / "some-package" (không phải local import) không được tính.
    expect(satellites.some((s) => s.importPath === "./d")).toBe(false);
  });

  it("nội dung file vệ tinh đúng với file thật, resolvedPath có đuôi .ts", () => {
    const mainContent = readFileContextSafe("main.ts", CWD);
    const satellites = readSatelliteFiles("main.ts", mainContent, CWD);

    const a = satellites.find((s) => s.importPath === "./a");
    expect(a?.resolvedPath).toBe("a.ts");
    expect(a?.content).toContain('export const A = "a"');
  });

  it("resolve được import trỏ tới thư mục có index.ts", () => {
    const content = readFileContextSafe("importsNested.ts", CWD);
    const satellites = readSatelliteFiles("importsNested.ts", content, CWD);

    expect(satellites).toHaveLength(1);
    expect(satellites[0].resolvedPath).toBe("nested/index.ts");
    expect(satellites[0].content).toContain("export const nested = true;");
  });

  it("bỏ qua file vệ tinh vượt quá 10KB (cap riêng cho satellite, không phải cap của file chính)", () => {
    const content = readFileContextSafe("importsLarge.ts", CWD);
    const satellites = readSatelliteFiles("importsLarge.ts", content, CWD);

    expect(satellites).toEqual([]);
  });

  it("trả về [] nếu fileContent là null (file chính không đọc được)", () => {
    expect(readSatelliteFiles("does-not-exist.ts", null, CWD)).toEqual([]);
  });

  it("trả về [] nếu file không có import local nào", () => {
    const content = readFileContextSafe("a.ts", CWD);
    expect(readSatelliteFiles("a.ts", content, CWD)).toEqual([]);
  });

  it("không throw ngay cả khi cwd không hợp lệ", () => {
    expect(() =>
      readSatelliteFiles("main.ts", 'import { X } from "./x";', "/duong-dan-khong-ton-tai")
    ).not.toThrow();
  });
});
