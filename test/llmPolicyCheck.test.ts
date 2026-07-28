import path from "node:path";
import { describe, it, expect, vi } from "vitest";
import { checkPoliciesWithLLM } from "../src/checks/llmPolicyCheck";
import type { DiffResult } from "../src/git/diff";
import type { Policy } from "../src/policy/types";
import type { LLMClient, RawViolation } from "../src/checks/llm/types";

const FIXTURES_CWD = path.join(__dirname, "fixtures", "llm");

function makePolicy(overrides: Partial<Policy>): Policy {
  return {
    id: "test.policy.md",
    category: "Test",
    scope: [],
    severity: "medium",
    tags: [],
    body: "body",
    ...overrides,
  };
}

interface RecordedCall {
  prompt: string;
  policyIds: string[];
}

function fakeResolver(client: LLMClient) {
  return () => ({ provider: "openai" as const, client });
}

function recordingClient(responses: (calls: RecordedCall[]) => RawViolation[]): {
  client: LLMClient;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  const client: LLMClient = {
    async reportViolations(prompt, policyIds) {
      calls.push({ prompt, policyIds });
      return responses(calls);
    },
  };
  return { client, calls };
}

function twoFileDiff(fileA: string, fileB: string, opts: { binaryA?: boolean } = {}): DiffResult {
  const segmentA = opts.binaryA
    ? [`diff --git a/${fileA} b/${fileA}`, `Binary files a/${fileA} and b/${fileA} differ`]
    : [
        `diff --git a/${fileA} b/${fileA}`,
        `--- a/${fileA}`,
        `+++ b/${fileA}`,
        "@@ -1,1 +1,1 @@",
        "-old",
        "+new-a",
      ];
  const segmentB = [
    `diff --git a/${fileB} b/${fileB}`,
    `--- a/${fileB}`,
    `+++ b/${fileB}`,
    "@@ -1,1 +1,1 @@",
    "-old",
    "+new-b",
  ];
  return {
    diffText: [...segmentA, ...segmentB].join("\n"),
    changedFiles: [fileA, fileB],
  };
}

describe("checkPoliciesWithLLM", () => {
  it("gọi 1 lần cho mỗi file, chỉ với policy khớp scope của đúng file đó (không leak chéo file)", async () => {
    const policyGlobal = makePolicy({ id: "global.md", scope: [] });
    const policyA = makePolicy({ id: "a-only.md", scope: ["a.ts"] });
    const policyB = makePolicy({ id: "b-only.md", scope: ["b.ts"] });

    const { client, calls } = recordingClient(() => []);
    const diff = twoFileDiff("a.ts", "b.ts");

    await checkPoliciesWithLLM(diff, [policyGlobal, policyA, policyB], {
      resolveLLMClient: fakeResolver(client),
      cwd: FIXTURES_CWD,
    });

    expect(calls).toHaveLength(2);
    const callByFile = new Map(calls.map((c) => [c.prompt.includes('"a.ts"') ? "a.ts" : "b.ts", c]));

    expect(callByFile.get("a.ts")?.policyIds.sort()).toEqual(["a-only.md", "global.md"]);
    expect(callByFile.get("b.ts")?.policyIds.sort()).toEqual(["b-only.md", "global.md"]);
  });

  it("ground policyViolated từ policy thật đã load, không tin text tự do của model", async () => {
    const policy = makePolicy({ id: "conv.md", category: "Coding Convention", scope: [] });
    const { client } = recordingClient(() => [
      {
        errorWhat: "dùng any",
        policyId: "conv.md",
        riskLevel: "low",
        why: "kém an toàn",
        howToFix: "đổi type",
        promptToFix:
          'Xin chào, trong file "x.ts", tôi đã vi phạm luật Coding Convention do dùng any. ' +
          "Hãy giúp tôi sửa đoạn code này theo hướng đổi type mà không làm ảnh hưởng đến logic hiện tại.",
      },
    ]);
    const diff: DiffResult = {
      diffText: "diff --git a/x.ts b/x.ts\n--- a/x.ts\n+++ b/x.ts\n@@ -1,1 +1,1 @@\n-a\n+b",
      changedFiles: ["x.ts"],
    };

    const violations = await checkPoliciesWithLLM(diff, [policy], {
      resolveLLMClient: fakeResolver(client),
      cwd: FIXTURES_CWD,
    });

    expect(violations).toHaveLength(1);
    expect(violations[0].policyViolated).toBe("Coding Convention (conv.md)");
    expect(violations[0].source).toBe("llm-policy-check");
    expect(violations[0].promptToFix).toContain('trong file "x.ts"');
  });

  it("loại bỏ violation nếu model trả về policyId không nằm trong danh sách đã cho", async () => {
    const policy = makePolicy({ id: "real.md", scope: [] });
    const { client } = recordingClient(() => [
      {
        errorWhat: "lỗi bịa",
        policyId: "khong-ton-tai.md",
        riskLevel: "high",
        why: "vì",
        howToFix: "sửa",
        promptToFix: "prompt bất kỳ",
      },
    ]);
    const diff: DiffResult = {
      diffText: "diff --git a/x.ts b/x.ts\n--- a/x.ts\n+++ b/x.ts\n@@ -1,1 +1,1 @@\n-a\n+b",
      changedFiles: ["x.ts"],
    };

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const violations = await checkPoliciesWithLLM(diff, [policy], {
      resolveLLMClient: fakeResolver(client),
      cwd: FIXTURES_CWD,
    });

    expect(violations).toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("bỏ qua file binary, không gọi LLM cho file đó", async () => {
    const policy = makePolicy({ id: "global.md", scope: [] });
    const { client, calls } = recordingClient(() => []);
    const diff = twoFileDiff("image.png", "code.ts", { binaryA: true });

    await checkPoliciesWithLLM(diff, [policy], {
      resolveLLMClient: fakeResolver(client),
      cwd: FIXTURES_CWD,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].prompt).toContain('"code.ts"');
  });

  it("đính kèm nội dung file hiện tại khi đọc được, bỏ qua (không crash) khi file đã bị xoá", async () => {
    const policy = makePolicy({ id: "global.md", scope: [] });
    const { client, calls } = recordingClient(() => []);
    const diff = twoFileDiff("sample.ts", "deleted.ts");

    await expect(
      checkPoliciesWithLLM(diff, [policy], {
        resolveLLMClient: fakeResolver(client),
        cwd: FIXTURES_CWD,
      })
    ).resolves.toEqual([]);

    const sampleCall = calls.find((c) => c.prompt.includes('"sample.ts"'));
    const deletedCall = calls.find((c) => c.prompt.includes('"deleted.ts"'));

    expect(sampleCall?.prompt).toContain("Nội dung hiện tại của file");
    expect(sampleCall?.prompt).toContain("export const sample = 1;");
    expect(deletedCall?.prompt).not.toContain("Nội dung hiện tại của file");
  });

  it("trả về [] mà không gọi LLM nếu không có policy nào", async () => {
    const { client, calls } = recordingClient(() => []);
    const diff = twoFileDiff("a.ts", "b.ts");

    const violations = await checkPoliciesWithLLM(diff, [], {
      resolveLLMClient: fakeResolver(client),
      cwd: FIXTURES_CWD,
    });

    expect(violations).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it("trả về [] và log cảnh báo nếu không resolve được LLM client", async () => {
    const policy = makePolicy({ id: "global.md", scope: [] });
    const diff = twoFileDiff("a.ts", "b.ts");
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const violations = await checkPoliciesWithLLM(diff, [policy], {
      resolveLLMClient: () => null,
      cwd: FIXTURES_CWD,
    });

    expect(violations).toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
