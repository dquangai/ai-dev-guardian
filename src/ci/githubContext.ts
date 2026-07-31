export interface GitHubContext {
  owner: string;
  repo: string;
  prNumber: number;
  token: string;
}

/**
 * Reads the env vars a GitHub Actions `pull_request` job always sets:
 * GITHUB_REPOSITORY ("owner/repo"), GITHUB_REF ("refs/pull/<n>/merge"), plus
 * GITHUB_TOKEN which the workflow must forward explicitly (Actions does not
 * export it as an env var on its own — see .github/workflows/guardian.yml).
 */
export function readGitHubContext(env: NodeJS.ProcessEnv = process.env): GitHubContext {
  const repository = env.GITHUB_REPOSITORY;
  const owner = repository?.split("/")[0];
  const repo = repository?.split("/")[1];
  if (!owner || !repo) {
    throw new Error(
      `GITHUB_REPOSITORY không hợp lệ: "${repository ?? "undefined"}" — --ci chỉ chạy được trong GitHub Actions.`
    );
  }

  const token = env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("Thiếu GITHUB_TOKEN — truyền qua `env:` trong workflow để Guardian post được comment lên PR.");
  }

  const prMatch = env.GITHUB_REF?.match(/^refs\/pull\/(\d+)\/merge$/);
  if (!prMatch) {
    throw new Error(
      `GITHUB_REF ("${env.GITHUB_REF ?? "undefined"}") không phải dạng pull request — --ci hiện chỉ hỗ trợ event pull_request.`
    );
  }

  return { owner, repo, prNumber: Number(prMatch[1]), token };
}
