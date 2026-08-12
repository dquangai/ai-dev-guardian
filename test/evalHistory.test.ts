import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { computeDelta, loadMostRecentSnapshot, writeSnapshot } from "../eval/history";
import type { HistorySnapshot } from "../eval/types";

// Isolated temp dir, never the real eval/results/history/ — that directory holds actually
// recorded eval runs (Recall/FPR/Precision trend history); a test writing/deleting it would
// silently corrupt real historical data every time the suite runs.
let HISTORY_DIR: string;

function makeSnapshot(overrides: Partial<HistorySnapshot>): HistorySnapshot {
  return {
    timestamp: new Date().toISOString(),
    provider: "openai",
    model: "gpt-4o",
    commitSha: "abc123",
    recall: 0.9,
    precision: 0.9,
    falsePositiveRate: 0.1,
    passedCaseIds: [],
    failedCaseIds: [],
    ...overrides,
  };
}

describe("computeDelta", () => {
  it("trả về null cho mọi delta khi không có snapshot trước đó", () => {
    const delta = computeDelta(makeSnapshot({}), null);
    expect(delta.previous).toBeNull();
    expect(delta.recallDelta).toBeNull();
    expect(delta.precisionDelta).toBeNull();
    expect(delta.falsePositiveRateDelta).toBeNull();
  });

  it("tính đúng dấu +/- cho từng chỉ số so với snapshot trước", () => {
    const previous = makeSnapshot({ recall: 0.811, precision: 0.732, falsePositiveRate: 0.314 });
    const current = makeSnapshot({ recall: 0.892, precision: 0.825, falsePositiveRate: 0.2 });

    const delta = computeDelta(current, previous);

    expect(delta.previous).toBe(previous);
    expect(delta.recallDelta).toBeCloseTo(0.081);
    expect(delta.precisionDelta).toBeCloseTo(0.093);
    expect(delta.falsePositiveRateDelta).toBeCloseTo(-0.114);
  });
});

describe("writeSnapshot / loadMostRecentSnapshot", () => {
  beforeEach(() => {
    HISTORY_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "guardian-eval-history-test-"));
  });
  afterEach(() => {
    fs.rmSync(HISTORY_DIR, { recursive: true, force: true });
  });

  it("trả về null khi chưa có snapshot nào", () => {
    expect(loadMostRecentSnapshot(HISTORY_DIR)).toBeNull();
  });

  it("đọc lại đúng snapshot vừa ghi", () => {
    const snapshot = makeSnapshot({ recall: 0.75 });
    writeSnapshot(snapshot, HISTORY_DIR);

    const loaded = loadMostRecentSnapshot(HISTORY_DIR);
    expect(loaded?.recall).toBe(0.75);
  });

  it("trả về snapshot MỚI NHẤT khi có nhiều file (sắp xếp theo tên file, lấy từ field timestamp)", () => {
    writeSnapshot(makeSnapshot({ timestamp: "2026-01-01T00:00:00.000Z", recall: 0.1 }), HISTORY_DIR);
    writeSnapshot(makeSnapshot({ timestamp: "2026-06-15T12:00:00.000Z", recall: 0.9 }), HISTORY_DIR);

    const loaded = loadMostRecentSnapshot(HISTORY_DIR);
    expect(loaded?.recall).toBe(0.9);
  });
});
