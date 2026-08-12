import { describe, it, expect } from "vitest";
import { checkThresholds, DEFAULT_THRESHOLDS } from "../eval/checkThresholds";
import type { EvalSummary } from "../eval/types";

function makeSummary(overrides: Partial<EvalSummary>): EvalSummary {
  return {
    results: [],
    recall: 0.9,
    precision: 0.9,
    falsePositiveRate: 0.1,
    truePositiveTotal: 10,
    truePositiveDetected: 9,
    falsePositiveTrapTotal: 10,
    falsePositiveTrapFired: 1,
    byPolicyId: [],
    ...overrides,
  };
}

describe("checkThresholds", () => {
  it("pass khi cả 3 chỉ số đều đạt ngưỡng mặc định", () => {
    const result = checkThresholds(makeSummary({ recall: 0.9, precision: 0.85, falsePositiveRate: 0.1 }));
    expect(result.passed).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it("fail khi Recall dưới ngưỡng tối thiểu, nêu rõ trong failures", () => {
    const result = checkThresholds(makeSummary({ recall: 0.8, precision: 0.9, falsePositiveRate: 0.1 }));
    expect(result.passed).toBe(false);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toMatch(/Recall/);
  });

  it("fail khi Precision dưới ngưỡng tối thiểu", () => {
    const result = checkThresholds(makeSummary({ recall: 0.9, precision: 0.7, falsePositiveRate: 0.1 }));
    expect(result.passed).toBe(false);
    expect(result.failures[0]).toMatch(/Precision/);
  });

  it("fail khi FPR vượt ngưỡng tối đa", () => {
    const result = checkThresholds(makeSummary({ recall: 0.9, precision: 0.9, falsePositiveRate: 0.3 }));
    expect(result.passed).toBe(false);
    expect(result.failures[0]).toMatch(/False Positive Rate/);
  });

  it("báo đủ nhiều failure cùng lúc nếu vi phạm nhiều ngưỡng", () => {
    const result = checkThresholds(makeSummary({ recall: 0.5, precision: 0.5, falsePositiveRate: 0.5 }));
    expect(result.passed).toBe(false);
    expect(result.failures).toHaveLength(3);
  });

  it("đúng bằng ngưỡng (không vượt/không thiếu) vẫn tính là pass", () => {
    const result = checkThresholds(
      makeSummary({
        recall: DEFAULT_THRESHOLDS.minRecall,
        precision: DEFAULT_THRESHOLDS.minPrecision,
        falsePositiveRate: DEFAULT_THRESHOLDS.maxFalsePositiveRate,
      })
    );
    expect(result.passed).toBe(true);
  });

  it("chấp nhận ngưỡng tuỳ chỉnh thay vì mặc định", () => {
    const result = checkThresholds(makeSummary({ recall: 0.6 }), { ...DEFAULT_THRESHOLDS, minRecall: 0.5 });
    expect(result.passed).toBe(true);
  });
});
