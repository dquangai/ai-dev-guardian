import { describe, it, expect } from "vitest";
import { readGitHubContext } from "../src/ci/githubContext";

const VALID_ENV = {
  GITHUB_REPOSITORY: "dquangai/ai-dev-guardian",
  GITHUB_REF: "refs/pull/42/merge",
  GITHUB_TOKEN: "gh-token",
} as NodeJS.ProcessEnv;

describe("readGitHubContext", () => {
  it("đọc đúng owner/repo/prNumber/token từ env hợp lệ", () => {
    expect(readGitHubContext(VALID_ENV)).toEqual({
      owner: "dquangai",
      repo: "ai-dev-guardian",
      prNumber: 42,
      token: "gh-token",
    });
  });

  it("báo lỗi khi thiếu GITHUB_REPOSITORY", () => {
    const { GITHUB_REPOSITORY, ...rest } = VALID_ENV;
    expect(() => readGitHubContext(rest as NodeJS.ProcessEnv)).toThrow(/GITHUB_REPOSITORY/);
  });

  it("báo lỗi khi thiếu GITHUB_TOKEN", () => {
    const { GITHUB_TOKEN, ...rest } = VALID_ENV;
    expect(() => readGitHubContext(rest as NodeJS.ProcessEnv)).toThrow(/GITHUB_TOKEN/);
  });

  it("báo lỗi khi GITHUB_REF không phải dạng pull request", () => {
    expect(() =>
      readGitHubContext({ ...VALID_ENV, GITHUB_REF: "refs/heads/main" } as NodeJS.ProcessEnv)
    ).toThrow(/pull request/);
  });
});
