import { describe, it, expect } from "vitest";
import { isIgnoredPath } from "../src/git/ignorePaths";

describe("isIgnoredPath", () => {
  it("bỏ qua mọi file trong thư mục test/", () => {
    expect(isIgnoredPath("test/secretScan.test.ts")).toBe(true);
    expect(isIgnoredPath("test/fixtures/policies/sample-a.policy.md")).toBe(true);
  });

  it("bỏ qua file *.test.ts / *.spec.ts dù nằm ngoài thư mục test/", () => {
    expect(isIgnoredPath("src/foo.test.ts")).toBe(true);
    expect(isIgnoredPath("src/foo.spec.ts")).toBe(true);
  });

  it("không bỏ qua source code bình thường", () => {
    expect(isIgnoredPath("src/checks/secretScan.ts")).toBe(false);
    expect(isIgnoredPath("README.md")).toBe(false);
  });
});
