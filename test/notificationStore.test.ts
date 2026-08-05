import { describe, it, expect, vi } from "vitest";

vi.mock("../src/server/store/jsonStore", () => {
  class FakeJsonArrayStore<T> {
    private items: T[] = [];
    readAll(): T[] {
      return this.items;
    }
    writeAll(items: T[]): void {
      this.items = items;
    }
  }
  return { JsonArrayStore: FakeJsonArrayStore };
});

import { getReadVersion, markPolicyRead } from "../src/server/store/notificationStore";

describe("notificationStore", () => {
  it("trả về 0 khi user chưa đọc policy này bao giờ", () => {
    expect(getReadVersion("dev-1", "never-read.policy.md")).toBe(0);
  });

  it("markPolicyRead rồi getReadVersion trả về đúng version vừa ghi", () => {
    markPolicyRead("dev-1", "a.policy.md", 3);
    expect(getReadVersion("dev-1", "a.policy.md")).toBe(3);
  });

  it("không hạ readVersion khi mark lại với version thấp hơn version đã lưu", () => {
    markPolicyRead("dev-1", "b.policy.md", 5);
    markPolicyRead("dev-1", "b.policy.md", 2);
    expect(getReadVersion("dev-1", "b.policy.md")).toBe(5);
  });

  it("nâng readVersion khi mark lại với version cao hơn", () => {
    markPolicyRead("dev-1", "d.policy.md", 1);
    markPolicyRead("dev-1", "d.policy.md", 4);
    expect(getReadVersion("dev-1", "d.policy.md")).toBe(4);
  });

  it("mỗi user có read-state độc lập nhau trên cùng 1 policy", () => {
    markPolicyRead("dev-1", "c.policy.md", 4);
    expect(getReadVersion("dev-2", "c.policy.md")).toBe(0);
  });
});
