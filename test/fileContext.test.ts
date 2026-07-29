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

  it("trả về [] cho ngôn ngữ không được hỗ trợ (vd .rs)", () => {
    expect(readSatelliteFiles("main.rs", 'use crate::foo;', CWD)).toEqual([]);
  });

  it("resolve re-export ('export { X } from \"./a\"' và 'export type { X } from \"./b\"') — case regex tay cũ bỏ sót", () => {
    const content = readFileContextSafe("reexport.ts", CWD);
    const satellites = readSatelliteFiles("reexport.ts", content, CWD);

    expect(satellites.map((s) => s.importPath).sort()).toEqual(["./a", "./b"]);
  });
});

describe("readSatelliteFiles — Python", () => {
  const PY_CWD = path.join(__dirname, "fixtures", "rag-py");

  it("resolve 'from .a import A' tới a.py cùng thư mục", () => {
    const content = readFileContextSafe("main.py", PY_CWD);
    const satellites = readSatelliteFiles("main.py", content, PY_CWD);

    const a = satellites.find((s) => s.importPath === ".a");
    expect(a?.resolvedPath).toBe("a.py");
    expect(a?.content).toContain('A = "a"');
  });

  it("resolve 'from . import pkg' tới __init__.py của submodule pkg (không phải __init__.py của thư mục hiện tại)", () => {
    const content = readFileContextSafe("main.py", PY_CWD);
    const satellites = readSatelliteFiles("main.py", content, PY_CWD);

    const pkg = satellites.find((s) => s.importPath === ".pkg");
    expect(pkg?.resolvedPath).toBe("pkg/__init__.py");
  });

  it("bỏ qua 'import os' (không phải relative import)", () => {
    const content = readFileContextSafe("main.py", PY_CWD);
    const satellites = readSatelliteFiles("main.py", content, PY_CWD);

    expect(satellites).toHaveLength(2);
  });
});

describe("readSatelliteFiles — C/C++", () => {
  const C_CWD = path.join(__dirname, "fixtures", "rag-c");

  it("resolve #include \"util.h\" nhưng bỏ qua #include <stdio.h>", () => {
    const content = readFileContextSafe("main.c", C_CWD);
    const satellites = readSatelliteFiles("main.c", content, C_CWD);

    expect(satellites).toHaveLength(1);
    expect(satellites[0].importPath).toBe("util.h");
    expect(satellites[0].resolvedPath).toBe("util.h");
    expect(satellites[0].content).toContain("UTIL_VERSION");
  });
});

describe("readSatelliteFiles — Go", () => {
  const GO_CWD = path.join(__dirname, "fixtures", "rag-go");

  it("resolve import trong module (dùng go.mod) tới file .go đầu tiên của package, bỏ qua 'fmt'", () => {
    const content = readFileContextSafe("main.go", GO_CWD);
    const satellites = readSatelliteFiles("main.go", content, GO_CWD);

    expect(satellites).toHaveLength(1);
    expect(satellites[0].importPath).toBe("example.com/proj/util");
    expect(satellites[0].resolvedPath).toBe("util/helper.go");
    expect(satellites[0].content).toContain("func Helper()");
  });

  it("trả về [] nếu không có go.mod (không xác định được module prefix)", () => {
    const content = 'package main\n\nimport "example.com/proj/util"\n';
    expect(readSatelliteFiles("main.go", content, path.join(__dirname, "fixtures", "rag"))).toEqual([]);
  });
});
