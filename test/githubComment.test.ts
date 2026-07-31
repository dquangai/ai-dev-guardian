import { describe, it, expect, vi } from "vitest";
import { postOrUpdateComment } from "../src/ci/githubComment";
import type { GitHubContext } from "../src/ci/githubContext";
import { GUARDIAN_REPORT_MARKER } from "../src/report/markdownReporter";

const CTX: GitHubContext = { owner: "dquangai", repo: "ai-dev-guardian", prNumber: 42, token: "gh-token" };

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? "OK" : "Error",
    json: async () => body,
  } as Response;
}

describe("postOrUpdateComment", () => {
  it("POST một comment mới khi chưa có comment nào mang marker của Guardian", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([{ id: 1, body: "comment của người khác" }]))
      .mockResolvedValueOnce(jsonResponse({}));

    await postOrUpdateComment(CTX, "nội dung report", fetchImpl);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const [listUrl] = fetchImpl.mock.calls[0];
    expect(listUrl).toBe("https://api.github.com/repos/dquangai/ai-dev-guardian/issues/42/comments");

    const [postUrl, postInit] = fetchImpl.mock.calls[1];
    expect(postUrl).toBe("https://api.github.com/repos/dquangai/ai-dev-guardian/issues/42/comments");
    expect(postInit.method).toBe("POST");
    expect(JSON.parse(postInit.body)).toEqual({ body: "nội dung report" });
  });

  it("PATCH comment cũ khi tìm thấy comment mang marker của Guardian", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse([
          { id: 7, body: `${GUARDIAN_REPORT_MARKER}\nbáo cáo lần trước` },
          { id: 8, body: "comment khác" },
        ])
      )
      .mockResolvedValueOnce(jsonResponse({}));

    await postOrUpdateComment(CTX, "nội dung report mới", fetchImpl);

    const [patchUrl, patchInit] = fetchImpl.mock.calls[1];
    expect(patchUrl).toBe("https://api.github.com/repos/dquangai/ai-dev-guardian/issues/comments/7");
    expect(patchInit.method).toBe("PATCH");
    expect(JSON.parse(patchInit.body)).toEqual({ body: "nội dung report mới" });
  });

  it("ném lỗi nếu không đọc được danh sách comment", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(null, false, 404));
    await expect(postOrUpdateComment(CTX, "x", fetchImpl)).rejects.toThrow(/404/);
  });

  it("ném lỗi nếu tạo/cập nhật comment thất bại", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(null, false, 403));
    await expect(postOrUpdateComment(CTX, "x", fetchImpl)).rejects.toThrow(/403/);
  });
});
