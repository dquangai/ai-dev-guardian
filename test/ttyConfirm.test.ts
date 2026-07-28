import { describe, it, expect } from "vitest";
import { parseYesNoAnswer } from "../src/ttyConfirm";

describe("parseYesNoAnswer", () => {
  it("input rỗng (Enter) theo đúng defaultYes", () => {
    expect(parseYesNoAnswer("", true)).toBe(true);
    expect(parseYesNoAnswer("   ", true)).toBe(true);
    expect(parseYesNoAnswer("", false)).toBe(false);
  });

  it("'y' / 'Y' / 'yes' luôn trả về true", () => {
    expect(parseYesNoAnswer("y", false)).toBe(true);
    expect(parseYesNoAnswer("Y", false)).toBe(true);
    expect(parseYesNoAnswer("yes", false)).toBe(true);
  });

  it("'n' / 'N' / 'no' luôn trả về false", () => {
    expect(parseYesNoAnswer("n", true)).toBe(false);
    expect(parseYesNoAnswer("N", true)).toBe(false);
    expect(parseYesNoAnswer("no", true)).toBe(false);
  });

  it("input lạ (không phải n/no) fail open — coi như đồng ý chạy check", () => {
    expect(parseYesNoAnswer("maybe", true)).toBe(true);
    expect(parseYesNoAnswer("asdf", false)).toBe(true);
  });
});
