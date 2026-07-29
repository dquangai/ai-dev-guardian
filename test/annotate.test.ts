import { describe, it, expect } from "vitest";
import { annotateForLLM } from "../src/checks/llm/annotate";

describe("annotateForLLM", () => {
  it("bọc line comment và block comment bằng <comment>...</comment>", () => {
    const src = ['// line comment', 'const a = 1;', '/* block */'].join("\n");
    const result = annotateForLLM("x.ts", src);

    expect(result).toContain("<comment>// line comment</comment>");
    expect(result).toContain("<comment>/* block */</comment>");
    expect(result).toContain("const a = 1;");
    expect(result).not.toContain("<comment>const a = 1;</comment>");
  });

  it("bọc JSDoc block (nhiều dòng) trong đúng 1 cặp tag bao quanh toàn bộ block", () => {
    const src = ["/**", " * doc", " */", "const a = 1;"].join("\n");
    const result = annotateForLLM("x.ts", src);

    expect(result).toContain("<comment>/**\n * doc\n */</comment>");
  });

  it("bọc string literal (single/double quote) và template string bằng <string>...</string>", () => {
    const src = [
      'const a = "double";',
      "const b = 'single';",
      "const c = `template ${a}`;",
    ].join("\n");
    const result = annotateForLLM("x.ts", src);

    expect(result).toContain('<string>"double"</string>');
    expect(result).toContain("<string>'single'</string>");
    expect(result).toContain("<string>`template ${a}`</string>"); // template_string wraps the whole backtick literal, interpolation included
  });

  it("không đụng vào code thật (không phải comment/string)", () => {
    const src = "function f(x: any): number { return x + 1; }";
    const result = annotateForLLM("x.ts", src);
    expect(result).toBe(src);
  });

  it("trả về nguyên văn cho ngôn ngữ không phải TS/JS (vd .py)", () => {
    const src = '# a comment\nx = "a string"\n';
    expect(annotateForLLM("x.py", src)).toBe(src);
  });

  it("trả về nguyên văn nếu source rỗng hoặc không parse được mà không throw", () => {
    expect(() => annotateForLLM("x.ts", "")).not.toThrow();
    expect(annotateForLLM("x.ts", "")).toBe("");
  });

  it("case thật đã gây hallucination: chữ 'any' trong comment tiếng Anh giờ nằm trong <comment>", () => {
    const src = "// Fail-safe: any madge error (missing tsconfig, unparseable project, ...)\nconst seen = new Set<string>();";
    const result = annotateForLLM("x.ts", src);

    expect(result).toContain(
      "<comment>// Fail-safe: any madge error (missing tsconfig, unparseable project, ...)</comment>"
    );
  });
});
