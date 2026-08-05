import { describe, it, expect } from "vitest";
import { selectAuditHistory, type AuditRecord } from "../src/server/store/auditStore";

function record(overrides: Partial<AuditRecord> = {}): AuditRecord {
  return {
    id: "audit-1",
    timestamp: "2026-08-05T00:00:00.000Z",
    verdict: "PASS",
    violations: [],
    changedFiles: [],
    target: "staged",
    triggeredBy: "dev-1",
    ...overrides,
  };
}

describe("selectAuditHistory", () => {
  const all = [
    record({ id: "a", triggeredBy: "dev-1" }),
    record({ id: "b", triggeredBy: "dev-2" }),
    record({ id: "c", triggeredBy: "dev-1" }),
    record({ id: "d", triggeredBy: "senior-dev-1" }),
  ];

  it("trả về toàn bộ record khi không có triggeredBy filter (admin/senior-dev/auditor)", () => {
    expect(selectAuditHistory(all)).toHaveLength(4);
  });

  it("chỉ trả về record của đúng triggeredBy khi có filter (developer)", () => {
    const result = selectAuditHistory(all, undefined, "dev-1");
    expect(result.map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("trả về mảng rỗng nếu triggeredBy không khớp record nào", () => {
    expect(selectAuditHistory(all, undefined, "nobody")).toEqual([]);
  });

  it("áp dụng limit sau khi đã lọc theo triggeredBy", () => {
    const result = selectAuditHistory(all, 1, "dev-1");
    expect(result).toEqual([record({ id: "a", triggeredBy: "dev-1" })]);
  });

  it("limit vẫn hoạt động đúng khi không có triggeredBy filter", () => {
    expect(selectAuditHistory(all, 2)).toHaveLength(2);
  });
});
