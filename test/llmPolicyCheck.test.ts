import path from "node:path";
import { describe, it, expect, vi } from "vitest";
import { checkPoliciesWithLLM } from "../src/checks/llmPolicyCheck";
import type { DiffResult } from "../src/git/diff";
import type { Policy } from "../src/policy/types";
import type { JudgeVerdict, LLMClient, RawViolation } from "../src/checks/llm/types";

const FIXTURES_CWD = path.join(__dirname, "fixtures", "llm");

function makePolicy(overrides: Partial<Policy>): Policy {
  return {
    id: "test.policy.md",
    category: "Test",
    scope: [],
    severity: "medium",
    tags: [],
    body: "body",
    rules: [],
    dependencyAllowlist: [],
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
    async judgeClaims() {
      throw new Error("the main LLM client's judgeClaims should never be called — only the judge client's");
    },
  };
  return { client, calls };
}

interface RecordedJudgeCall {
  prompt: string;
  claimCount: number;
}

function recordingJudgeClient(verdicts: (calls: RecordedJudgeCall[]) => JudgeVerdict[]): {
  client: LLMClient;
  calls: RecordedJudgeCall[];
} {
  const calls: RecordedJudgeCall[] = [];
  const client: LLMClient = {
    async reportViolations() {
      throw new Error("the judge client's reportViolations should never be called — only judgeClaims");
    },
    async judgeClaims(prompt, claimCount) {
      calls.push({ prompt, claimCount });
      return verdicts(calls);
    },
  };
  return { client, calls };
}

function fakeJudgeResolver(client: LLMClient) {
  return () => ({ provider: "openai" as const, client });
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
      resolveJudgeClient: () => null,
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
        reasoning: "code thực sự dùng kiểu any",
        errorWhat: "dùng any",
        policyId: "conv.md",
        riskLevel: "low",
        why: "kém an toàn",
        howToFix: "đổi type",
        evidenceSnippet: "b",
      },
    ]);
    const diff: DiffResult = {
      diffText: "diff --git a/x.ts b/x.ts\n--- a/x.ts\n+++ b/x.ts\n@@ -1,1 +1,1 @@\n-a\n+b",
      changedFiles: ["x.ts"],
    };

    const violations = await checkPoliciesWithLLM(diff, [policy], {
      resolveLLMClient: fakeResolver(client),
      resolveJudgeClient: () => null,
      cwd: FIXTURES_CWD,
    });

    expect(violations).toHaveLength(1);
    expect(violations[0].policyViolated).toBe("Coding Convention (conv.md)");
    expect(violations[0].source).toBe("llm-policy-check");
    expect(violations[0].location).toBe("x.ts");
    expect(violations[0].promptToFix).toContain("`x.ts`");
    expect(violations[0].promptToFix).toContain("Coding Convention (conv.md)");
  });

  it("loại bỏ violation nếu model trả về policyId không nằm trong danh sách đã cho", async () => {
    const policy = makePolicy({ id: "real.md", scope: [] });
    const { client } = recordingClient(() => [
      {
        reasoning: "suy luận bất kỳ",
        errorWhat: "lỗi bịa",
        policyId: "khong-ton-tai.md",
        riskLevel: "high",
        why: "vì",
        howToFix: "sửa",
        evidenceSnippet: "b",
      },
    ]);
    const diff: DiffResult = {
      diffText: "diff --git a/x.ts b/x.ts\n--- a/x.ts\n+++ b/x.ts\n@@ -1,1 +1,1 @@\n-a\n+b",
      changedFiles: ["x.ts"],
    };

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const violations = await checkPoliciesWithLLM(diff, [policy], {
      resolveLLMClient: fakeResolver(client),
      resolveJudgeClient: () => null,
      cwd: FIXTURES_CWD,
    });

    expect(violations).toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("loại bỏ violation nếu evidenceSnippet không khớp với nội dung diff thật (grounding)", async () => {
    const policy = makePolicy({ id: "real.md", scope: [] });
    const { client } = recordingClient(() => [
      {
        reasoning: "suy luận bất kỳ",
        errorWhat: "lỗi được mô tả nhưng không trỏ vào đâu cả",
        policyId: "real.md",
        riskLevel: "medium",
        why: "vì",
        howToFix: "sửa",
        evidenceSnippet: "dòng này không hề tồn tại trong diff",
      },
    ]);
    const diff: DiffResult = {
      diffText: "diff --git a/x.ts b/x.ts\n--- a/x.ts\n+++ b/x.ts\n@@ -1,1 +1,1 @@\n-a\n+b",
      changedFiles: ["x.ts"],
    };

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const violations = await checkPoliciesWithLLM(diff, [policy], {
      resolveLLMClient: fakeResolver(client),
      resolveJudgeClient: () => null,
      cwd: FIXTURES_CWD,
    });

    expect(violations).toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("loại bỏ violation nếu evidenceSnippet chỉ khớp một dòng comment, không khớp code thật (case thật đã xảy ra: model trích chữ 'any' trong câu tiếng Anh 'Fail-safe: any madge error...' rồi hiểu nhầm là code dùng kiểu TypeScript any)", async () => {
    const policy = makePolicy({ id: "conv.md", scope: [] });
    const { client } = recordingClient(() => [
      {
        reasoning: "thấy chữ any trong dòng trích dẫn",
        errorWhat: "Sử dụng kiểu 'any' mà không có comment giải thích",
        policyId: "conv.md",
        riskLevel: "low",
        why: "vì",
        howToFix: "sửa",
        evidenceSnippet: "// Fail-safe: any madge error (missing tsconfig, unparseable project, ...)",
      },
    ]);
    const diff: DiffResult = {
      diffText: [
        "diff --git a/x.ts b/x.ts",
        "--- a/x.ts",
        "+++ b/x.ts",
        "@@ -1,1 +1,2 @@",
        "+// Fail-safe: any madge error (missing tsconfig, unparseable project, ...)",
        "+const seen = new Set<string>();",
      ].join("\n"),
      changedFiles: ["x.ts"],
    };

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const violations = await checkPoliciesWithLLM(diff, [policy], {
      resolveLLMClient: fakeResolver(client),
      resolveJudgeClient: () => null,
      cwd: FIXTURES_CWD,
    });

    expect(violations).toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("vẫn giữ violation nếu evidenceSnippet khớp dòng code thật (không phải comment)", async () => {
    const policy = makePolicy({ id: "conv.md", scope: [] });
    const { client } = recordingClient(() => [
      {
        reasoning: "code thực sự khai báo kiểu any",
        errorWhat: "dùng any thật",
        policyId: "conv.md",
        riskLevel: "low",
        why: "vì",
        howToFix: "sửa",
        evidenceSnippet: "const x: any = 1;",
      },
    ]);
    const diff: DiffResult = {
      diffText: [
        "diff --git a/x.ts b/x.ts",
        "--- a/x.ts",
        "+++ b/x.ts",
        "@@ -1,1 +1,2 @@",
        "+// some unrelated comment",
        "+const x: any = 1;",
      ].join("\n"),
      changedFiles: ["x.ts"],
    };

    const violations = await checkPoliciesWithLLM(diff, [policy], {
      resolveLLMClient: fakeResolver(client),
      resolveJudgeClient: () => null,
      cwd: FIXTURES_CWD,
    });

    expect(violations).toHaveLength(1);
  });

  it("vẫn giữ violation nếu evidenceSnippet khớp dòng code thật nhưng khác khoảng trắng (whitespace-tolerant grounding)", async () => {
    const policy = makePolicy({ id: "conv.md", scope: [] });
    const { client } = recordingClient(() => [
      {
        reasoning: "code thực sự khai báo kiểu any, model trích lại nhưng gõ lại khoảng trắng",
        errorWhat: "dùng any thật",
        policyId: "conv.md",
        riskLevel: "low",
        why: "vì",
        howToFix: "sửa",
        // Cùng token, khác cách căn khoảng trắng so với dòng thật trong diff bên dưới (2 space thay
        // vì 1, không có dấu chấm phẩy cuối dòng bị đổi vị trí do model re-wrap).
        evidenceSnippet: "const x:  any = 1;",
      },
    ]);
    const diff: DiffResult = {
      diffText: [
        "diff --git a/x.ts b/x.ts",
        "--- a/x.ts",
        "+++ b/x.ts",
        "@@ -1,1 +1,2 @@",
        "+// some unrelated comment",
        "+const x: any = 1;",
      ].join("\n"),
      changedFiles: ["x.ts"],
    };

    const violations = await checkPoliciesWithLLM(diff, [policy], {
      resolveLLMClient: fakeResolver(client),
      resolveJudgeClient: () => null,
      cwd: FIXTURES_CWD,
    });

    expect(violations).toHaveLength(1);
  });

  it("policy với allowCommentEvidence: true giữ violation dù evidenceSnippet chỉ khớp dòng comment (ví dụ code đã bị comment-out)", async () => {
    const policy = makePolicy({ id: "security.md", scope: [], allowCommentEvidence: true });
    const { client } = recordingClient(() => [
      {
        reasoning: "auth check đã bị comment out",
        errorWhat: "Tắt xác thực bằng cách comment-out",
        policyId: "security.md",
        riskLevel: "medium",
        why: "vì",
        howToFix: "sửa",
        evidenceSnippet: '// if (req.user?.role !== "admin") return res.status(403).send("Forbidden");',
      },
    ]);
    const diff: DiffResult = {
      diffText: [
        "diff --git a/x.ts b/x.ts",
        "--- a/x.ts",
        "+++ b/x.ts",
        "@@ -1,1 +1,2 @@",
        '+// if (req.user?.role !== "admin") return res.status(403).send("Forbidden");',
        "+next();",
      ].join("\n"),
      changedFiles: ["x.ts"],
    };

    const violations = await checkPoliciesWithLLM(diff, [policy], {
      resolveLLMClient: fakeResolver(client),
      resolveJudgeClient: () => null,
      cwd: FIXTURES_CWD,
    });

    expect(violations).toHaveLength(1);
  });

  describe("loại violation mà chính reasoning tự phủ nhận (case thật đã xảy ra ở --split-policies)", () => {
    const SELF_NEGATE_DIFF: DiffResult = {
      diffText: [
        "diff --git a/x.ts b/x.ts",
        "--- a/x.ts",
        "+++ b/x.ts",
        "@@ -1,1 +1,1 @@",
        '+export const FAKE_STRIPE_TEST_KEY = "sk_test_4eC39HqLyjWDarjtT1zdp7dc";',
      ].join("\n"),
      changedFiles: ["x.ts"],
    };

    it("loại bỏ violation nếu reasoning (tiếng Anh) tự kết luận 'does not violate' / 'is compliant'", async () => {
      const policy = makePolicy({ id: "conv.md", scope: [] });
      const { client } = recordingClient(() => [
        {
          reasoning:
            "This is a hardcoded test key, but this does not violate the specific policies provided, as the policies focus on other concerns. Therefore, this is not a violation of the given policies.",
          errorWhat: "Hardcoded test key found.",
          policyId: "conv.md",
          riskLevel: "low",
          why: "vì",
          howToFix: "sửa",
          evidenceSnippet: 'export const FAKE_STRIPE_TEST_KEY = "sk_test_4eC39HqLyjWDarjtT1zdp7dc";',
        },
      ]);

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const violations = await checkPoliciesWithLLM(SELF_NEGATE_DIFF, [policy], {
        resolveLLMClient: fakeResolver(client),
        resolveJudgeClient: () => null,
        cwd: FIXTURES_CWD,
      });

      expect(violations).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it("loại bỏ violation nếu reasoning (tiếng Việt) tự kết luận 'không vi phạm' / 'tuân thủ đúng'", async () => {
      const policy = makePolicy({ id: "conv.md", scope: [] });
      const { client } = recordingClient(() => [
        {
          reasoning:
            "Tên hằng số FAKE_STRIPE_TEST_KEY dùng UPPER_SNAKE_CASE, tuân thủ đúng quy ước — không vi phạm quy tắc nào.",
          errorWhat: "Đặt tên hằng số.",
          policyId: "conv.md",
          riskLevel: "low",
          why: "vì",
          howToFix: "sửa",
          evidenceSnippet: 'export const FAKE_STRIPE_TEST_KEY = "sk_test_4eC39HqLyjWDarjtT1zdp7dc";',
        },
      ]);

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const violations = await checkPoliciesWithLLM(SELF_NEGATE_DIFF, [policy], {
        resolveLLMClient: fakeResolver(client),
        resolveJudgeClient: () => null,
        cwd: FIXTURES_CWD,
      });

      expect(violations).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it("vẫn giữ violation thật có reasoning kết luận rõ ràng LÀ vi phạm (không tự phủ nhận)", async () => {
      const policy = makePolicy({ id: "conv.md", scope: [] });
      const { client } = recordingClient(() => [
        {
          reasoning:
            "The constant holds a real-looking secret key hardcoded directly in source, which violates the policy against hardcoding credentials.",
          errorWhat: "Hardcoded secret key.",
          policyId: "conv.md",
          riskLevel: "low",
          why: "vì",
          howToFix: "sửa",
          evidenceSnippet: 'export const FAKE_STRIPE_TEST_KEY = "sk_test_4eC39HqLyjWDarjtT1zdp7dc";',
        },
      ]);

      const violations = await checkPoliciesWithLLM(SELF_NEGATE_DIFF, [policy], {
        resolveLLMClient: fakeResolver(client),
        resolveJudgeClient: () => null,
        cwd: FIXTURES_CWD,
      });

      expect(violations).toHaveLength(1);
    });
  });

  describe("self-consistency cho vi phạm critical", () => {
    const CRITICAL_DIFF: DiffResult = {
      diffText: "diff --git a/x.ts b/x.ts\n--- a/x.ts\n+++ b/x.ts\n@@ -1,1 +1,1 @@\n-a\n+b",
      changedFiles: ["x.ts"],
    };

    function criticalViolation(): RawViolation {
      return {
        reasoning: "phát hiện secret hardcode",
        errorWhat: "hardcode secret",
        policyId: "sec.md",
        riskLevel: "critical",
        why: "lộ secret",
        howToFix: "dùng biến môi trường",
        evidenceSnippet: "b",
      };
    }

    it("không gọi LLM lần 2 nếu lượt đầu không có vi phạm critical nào", async () => {
      const policy = makePolicy({ id: "conv.md", severity: "low", scope: [] });
      const { client, calls } = recordingClient(() => [
        { ...criticalViolation(), policyId: "conv.md", riskLevel: "low" },
      ]);

      const violations = await checkPoliciesWithLLM(CRITICAL_DIFF, [policy], {
        resolveLLMClient: fakeResolver(client),
        resolveJudgeClient: () => null,
        cwd: FIXTURES_CWD,
      });

      expect(calls).toHaveLength(1);
      expect(violations).toHaveLength(1);
    });

    it("giữ vi phạm critical nếu lượt kiểm tra thứ 2 xác nhận lại cùng policyId", async () => {
      const policy = makePolicy({ id: "sec.md", severity: "critical", scope: [] });
      const { client, calls } = recordingClient(() => [criticalViolation()]);

      const violations = await checkPoliciesWithLLM(CRITICAL_DIFF, [policy], {
        resolveLLMClient: fakeResolver(client),
        resolveJudgeClient: () => null,
        cwd: FIXTURES_CWD,
      });

      expect(calls).toHaveLength(2);
      expect(violations).toHaveLength(1);
      expect(violations[0].riskLevel).toBe("critical");
    });

    it("bỏ qua vi phạm critical nếu lượt kiểm tra thứ 2 không xác nhận lại", async () => {
      const policy = makePolicy({ id: "sec.md", severity: "critical", scope: [] });
      const { client, calls } = recordingClient((calls) =>
        calls.length === 1 ? [criticalViolation()] : []
      );

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const violations = await checkPoliciesWithLLM(CRITICAL_DIFF, [policy], {
        resolveLLMClient: fakeResolver(client),
        resolveJudgeClient: () => null,
        cwd: FIXTURES_CWD,
      });

      expect(calls).toHaveLength(2);
      expect(violations).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe("graceful degrade khi LLM call lỗi (network/API key invalid) — không được crash", () => {
    const CRITICAL_DIFF: DiffResult = {
      diffText: "diff --git a/x.ts b/x.ts\n--- a/x.ts\n+++ b/x.ts\n@@ -1,1 +1,1 @@\n-a\n+b",
      changedFiles: ["x.ts"],
    };

    it("lỗi ở lượt gọi đầu tiên: không throw ra ngoài, trả về [] cho file đó, báo onLLMCheckError", async () => {
      const client: LLMClient = {
        async reportViolations() {
          throw new Error("401 Incorrect API key provided");
        },
        async judgeClaims() {
          throw new Error("should not be called");
        },
      };
      const policy = makePolicy({ id: "conv.md", scope: [] });
      const onLLMCheckError = vi.fn();
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const violations = await checkPoliciesWithLLM(CRITICAL_DIFF, [policy], {
        resolveLLMClient: fakeResolver(client),
        resolveJudgeClient: () => null,
        cwd: FIXTURES_CWD,
        onLLMCheckError,
      });

      expect(violations).toEqual([]);
      expect(onLLMCheckError).toHaveBeenCalledWith("x.ts", expect.any(Error));
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it("1 file lỗi không làm mất vi phạm hợp lệ của file khác trong cùng lượt chạy", async () => {
      const policyGlobal = makePolicy({ id: "global.md", scope: [] });
      const diff = twoFileDiff("a.ts", "b.ts");
      const client: LLMClient = {
        async reportViolations(prompt) {
          if (prompt.includes('"a.ts"')) throw new Error("network timeout");
          return [
            {
              reasoning: "thật",
              errorWhat: "lỗi thật ở file b",
              policyId: "global.md",
              riskLevel: "low",
              why: "vì",
              howToFix: "sửa",
              evidenceSnippet: "new-b",
            },
          ];
        },
        async judgeClaims() {
          throw new Error("should not be called");
        },
      };
      const onLLMCheckError = vi.fn();
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const violations = await checkPoliciesWithLLM(diff, [policyGlobal], {
        resolveLLMClient: fakeResolver(client),
        resolveJudgeClient: () => null,
        cwd: FIXTURES_CWD,
        onLLMCheckError,
      });

      expect(violations).toHaveLength(1);
      expect(violations[0].location).toBe("b.ts");
      expect(onLLMCheckError).toHaveBeenCalledWith("a.ts", expect.any(Error));
      consoleErrorSpy.mockRestore();
    });

    it("lỗi ở lượt xác nhận thứ 2 (critical): bỏ vi phạm chưa xác nhận được, vẫn báo onLLMCheckError, không throw", async () => {
      const policy = makePolicy({ id: "sec.md", severity: "critical", scope: [] });
      let callCount = 0;
      const client: LLMClient = {
        async reportViolations() {
          callCount += 1;
          if (callCount === 1) {
            return [
              {
                reasoning: "phát hiện secret hardcode",
                errorWhat: "hardcode secret",
                policyId: "sec.md",
                riskLevel: "critical",
                why: "lộ secret",
                howToFix: "dùng biến môi trường",
                evidenceSnippet: "b",
              },
            ];
          }
          throw new Error("rate limited on second pass");
        },
        async judgeClaims() {
          throw new Error("should not be called");
        },
      };
      const onLLMCheckError = vi.fn();
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const violations = await checkPoliciesWithLLM(CRITICAL_DIFF, [policy], {
        resolveLLMClient: fakeResolver(client),
        resolveJudgeClient: () => null,
        cwd: FIXTURES_CWD,
        onLLMCheckError,
      });

      expect(callCount).toBe(2);
      expect(violations).toEqual([]);
      expect(onLLMCheckError).toHaveBeenCalledWith("x.ts", expect.any(Error));
      consoleErrorSpy.mockRestore();
    });
  });

  describe("judge pass (LLM-as-a-judge, xác minh độc lập sau grounding)", () => {
    const JUDGE_DIFF: DiffResult = {
      diffText: "diff --git a/x.ts b/x.ts\n--- a/x.ts\n+++ b/x.ts\n@@ -1,1 +1,1 @@\n-a\n+b",
      changedFiles: ["x.ts"],
    };

    function groundedViolation(overrides: Partial<RawViolation> = {}): RawViolation {
      return {
        reasoning: "suy luận ban đầu",
        errorWhat: "claim cần judge xác minh",
        policyId: "conv.md",
        riskLevel: "low",
        why: "vì",
        howToFix: "sửa",
        evidenceSnippet: "b",
        ...overrides,
      };
    }

    it("judge bác bỏ claim (claimIsTrue: false) -> violation bị loại", async () => {
      const policy = makePolicy({ id: "conv.md", scope: [] });
      const { client } = recordingClient(() => [groundedViolation()]);
      const { client: judgeClient } = recordingJudgeClient(() => [
        { index: 0, reasoning: "kiểm tra lại thấy không đúng", claimIsTrue: false },
      ]);

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const violations = await checkPoliciesWithLLM(JUDGE_DIFF, [policy], {
        resolveLLMClient: fakeResolver(client),
        resolveJudgeClient: fakeJudgeResolver(judgeClient),
        cwd: FIXTURES_CWD,
      });

      expect(violations).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it("judge xác nhận claim (claimIsTrue: true) -> violation được giữ", async () => {
      const policy = makePolicy({ id: "conv.md", scope: [] });
      const { client } = recordingClient(() => [groundedViolation()]);
      const { client: judgeClient } = recordingJudgeClient(() => [
        { index: 0, reasoning: "kiểm tra lại thấy đúng", claimIsTrue: true },
      ]);

      const violations = await checkPoliciesWithLLM(JUDGE_DIFF, [policy], {
        resolveLLMClient: fakeResolver(client),
        resolveJudgeClient: fakeJudgeResolver(judgeClient),
        cwd: FIXTURES_CWD,
      });

      expect(violations).toHaveLength(1);
    });

    it("judge không khả dụng (resolver trả null) -> giữ nguyên violation, không throw", async () => {
      const policy = makePolicy({ id: "conv.md", scope: [] });
      const { client } = recordingClient(() => [groundedViolation()]);

      const violations = await checkPoliciesWithLLM(JUDGE_DIFF, [policy], {
        resolveLLMClient: fakeResolver(client),
        resolveJudgeClient: () => null,
        cwd: FIXTURES_CWD,
      });

      expect(violations).toHaveLength(1);
    });

    it("judge throw lỗi -> fail-open, giữ nguyên violation", async () => {
      const policy = makePolicy({ id: "conv.md", scope: [] });
      const { client } = recordingClient(() => [groundedViolation()]);
      const judgeClient: LLMClient = {
        async reportViolations() {
          throw new Error("not used");
        },
        async judgeClaims() {
          throw new Error("judge lỗi mạng");
        },
      };

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const violations = await checkPoliciesWithLLM(JUDGE_DIFF, [policy], {
        resolveLLMClient: fakeResolver(client),
        resolveJudgeClient: fakeJudgeResolver(judgeClient),
        cwd: FIXTURES_CWD,
      });

      expect(violations).toHaveLength(1);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it("không có violation nào sống sót sau grounding -> không gọi judge", async () => {
      const policy = makePolicy({ id: "conv.md", scope: [] });
      const { client } = recordingClient(() => []);
      const { client: judgeClient, calls: judgeCalls } = recordingJudgeClient(() => []);

      await checkPoliciesWithLLM(JUDGE_DIFF, [policy], {
        resolveLLMClient: fakeResolver(client),
        resolveJudgeClient: fakeJudgeResolver(judgeClient),
        cwd: FIXTURES_CWD,
      });

      expect(judgeCalls).toHaveLength(0);
    });

    it("nhiều violation trong 1 file -> đúng 1 lượt gọi judge với claimCount đúng", async () => {
      const policy = makePolicy({ id: "conv.md", scope: [] });
      const { client } = recordingClient(() => [
        groundedViolation(),
        groundedViolation({ errorWhat: "claim thứ 2" }),
      ]);
      const { client: judgeClient, calls: judgeCalls } = recordingJudgeClient(() => [
        { index: 0, reasoning: "ok", claimIsTrue: true },
        { index: 1, reasoning: "ok", claimIsTrue: true },
      ]);

      const violations = await checkPoliciesWithLLM(JUDGE_DIFF, [policy], {
        resolveLLMClient: fakeResolver(client),
        resolveJudgeClient: fakeJudgeResolver(judgeClient),
        cwd: FIXTURES_CWD,
      });

      expect(judgeCalls).toHaveLength(1);
      expect(judgeCalls[0].claimCount).toBe(2);
      expect(violations).toHaveLength(2);
    });
  });

  it("bỏ qua file binary, không gọi LLM cho file đó", async () => {
    const policy = makePolicy({ id: "global.md", scope: [] });
    const { client, calls } = recordingClient(() => []);
    const diff = twoFileDiff("image.png", "code.ts", { binaryA: true });

    await checkPoliciesWithLLM(diff, [policy], {
      resolveLLMClient: fakeResolver(client),
      resolveJudgeClient: () => null,
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
        resolveJudgeClient: () => null,
        cwd: FIXTURES_CWD,
      })
    ).resolves.toEqual([]);

    const sampleCall = calls.find((c) => c.prompt.includes('"sample.ts"'));
    const deletedCall = calls.find((c) => c.prompt.includes('"deleted.ts"'));

    expect(sampleCall?.prompt).toContain("Nội dung hiện tại của file");
    expect(sampleCall?.prompt).toContain("export const sample = 1;");
    expect(deletedCall?.prompt).not.toContain("Nội dung hiện tại của file");
  });

  it("bọc comment/string trong nội dung file bằng tag <comment>/<string> trước khi gửi cho LLM (chống semantic hallucination)", async () => {
    const policy = makePolicy({ id: "global.md", scope: [] });
    const { client, calls } = recordingClient(() => []);
    const diff: DiffResult = {
      diffText: "diff --git a/withComment.ts b/withComment.ts\n--- a/withComment.ts\n+++ b/withComment.ts\n@@ -1,1 +1,1 @@\n-old\n+new",
      changedFiles: ["withComment.ts"],
    };

    await checkPoliciesWithLLM(diff, [policy], {
      resolveLLMClient: fakeResolver(client),
      resolveJudgeClient: () => null,
      cwd: FIXTURES_CWD,
    });

    expect(calls[0].prompt).toContain("<comment>// a real comment mentioning any</comment>");
    expect(calls[0].prompt).toContain('<string>"a string value"</string>');
    expect(calls[0].prompt).toContain("<comment>...</comment>");
  });

  it("trả về [] mà không gọi LLM nếu không có policy nào", async () => {
    const { client, calls } = recordingClient(() => []);
    const diff = twoFileDiff("a.ts", "b.ts");

    const violations = await checkPoliciesWithLLM(diff, [], {
      resolveLLMClient: fakeResolver(client),
      resolveJudgeClient: () => null,
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
      resolveJudgeClient: () => null,
      cwd: FIXTURES_CWD,
    });

    expect(violations).toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  describe("splitPolicies (diagnostic-only per-policy execution, xem eval/runSuite.ts --split-policies)", () => {
    const SPLIT_DIFF: DiffResult = {
      diffText: [
        "diff --git a/x.ts b/x.ts",
        "--- a/x.ts",
        "+++ b/x.ts",
        "@@ -1,2 +1,2 @@",
        "+lineA",
        "+lineB",
      ].join("\n"),
      changedFiles: ["x.ts"],
    };

    function violationFor(policyId: string, evidenceSnippet: string): RawViolation {
      return {
        reasoning: "lý do",
        errorWhat: `vi phạm ${policyId}`,
        policyId,
        riskLevel: "low",
        why: "vì",
        howToFix: "sửa",
        evidenceSnippet,
      };
    }

    it("mặc định (splitPolicies không set) gộp mọi policy khớp file vào 1 lần gọi report_violations duy nhất", async () => {
      const policyA = makePolicy({ id: "policy-a.md", scope: [] });
      const policyB = makePolicy({ id: "policy-b.md", scope: [] });
      const { client, calls } = recordingClient(() => []);

      await checkPoliciesWithLLM(SPLIT_DIFF, [policyA, policyB], {
        resolveLLMClient: fakeResolver(client),
        resolveJudgeClient: () => null,
        cwd: FIXTURES_CWD,
      });

      expect(calls).toHaveLength(1);
      expect(calls[0].policyIds.sort()).toEqual(["policy-a.md", "policy-b.md"]);
    });

    it("splitPolicies: true gọi report_violations riêng biệt cho từng policy khớp file, không gộp chung 1 prompt", async () => {
      const policyA = makePolicy({ id: "policy-a.md", scope: [] });
      const policyB = makePolicy({ id: "policy-b.md", scope: [] });
      const { client, calls } = recordingClient((recordedCalls) => {
        const currentPolicyId = recordedCalls[recordedCalls.length - 1].policyIds[0];
        return [violationFor(currentPolicyId, currentPolicyId === "policy-a.md" ? "lineA" : "lineB")];
      });

      const violations = await checkPoliciesWithLLM(SPLIT_DIFF, [policyA, policyB], {
        resolveLLMClient: fakeResolver(client),
        resolveJudgeClient: () => null,
        cwd: FIXTURES_CWD,
        splitPolicies: true,
      });

      expect(calls).toHaveLength(2);
      expect(calls.map((c) => c.policyIds)).toEqual(
        expect.arrayContaining([["policy-a.md"], ["policy-b.md"]])
      );
      expect(violations).toHaveLength(2);
    });

    it("splitPolicies: true — judge pass vẫn chỉ chạy đúng 1 lần cho toàn bộ survivor gộp từ các call tách riêng", async () => {
      const policyA = makePolicy({ id: "policy-a.md", scope: [] });
      const policyB = makePolicy({ id: "policy-b.md", scope: [] });
      const { client } = recordingClient((recordedCalls) => {
        const currentPolicyId = recordedCalls[recordedCalls.length - 1].policyIds[0];
        return [violationFor(currentPolicyId, currentPolicyId === "policy-a.md" ? "lineA" : "lineB")];
      });
      const { client: judgeClient, calls: judgeCalls } = recordingJudgeClient(() => [
        { index: 0, reasoning: "ok", claimIsTrue: true },
        { index: 1, reasoning: "ok", claimIsTrue: true },
      ]);

      const violations = await checkPoliciesWithLLM(SPLIT_DIFF, [policyA, policyB], {
        resolveLLMClient: fakeResolver(client),
        resolveJudgeClient: fakeJudgeResolver(judgeClient),
        cwd: FIXTURES_CWD,
        splitPolicies: true,
      });

      expect(judgeCalls).toHaveLength(1);
      expect(judgeCalls[0].claimCount).toBe(2);
      expect(violations).toHaveLength(2);
    });

    it("splitPolicies: true — 1 policy call lỗi không làm mất violation của policy call khác cùng file (fail-open theo từng call)", async () => {
      const policyA = makePolicy({ id: "policy-a.md", scope: [] });
      const policyB = makePolicy({ id: "policy-b.md", scope: [] });
      const client: LLMClient = {
        async reportViolations(_prompt, policyIds) {
          if (policyIds[0] === "policy-a.md") throw new Error("lỗi mạng giả lập cho policy-a");
          return [violationFor("policy-b.md", "lineB")];
        },
        async judgeClaims() {
          throw new Error("judgeClaims không nên được gọi trong test này");
        },
      };
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const violations = await checkPoliciesWithLLM(SPLIT_DIFF, [policyA, policyB], {
        resolveLLMClient: fakeResolver(client),
        resolveJudgeClient: () => null,
        cwd: FIXTURES_CWD,
        splitPolicies: true,
      });

      expect(violations).toHaveLength(1);
      expect(violations[0].errorWhat).toContain("policy-b.md");
      consoleErrorSpy.mockRestore();
    });
  });
});
