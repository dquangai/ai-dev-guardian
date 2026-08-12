import { GUARDIAN_REPORT_MARKER } from "../report/markdownReporter";
import type { GitHubContext } from "./githubContext";

const GITHUB_API = "https://api.github.com";

interface GitHubIssueComment {
  id: number;
  body: string;
}

function authHeaders(ctx: GitHubContext): Record<string, string> {
  return {
    Authorization: `Bearer ${ctx.token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function findExistingComment(
  ctx: GitHubContext,
  fetchImpl: typeof fetch,
  marker: string
): Promise<GitHubIssueComment | undefined> {
  const url = `${GITHUB_API}/repos/${ctx.owner}/${ctx.repo}/issues/${ctx.prNumber}/comments`;
  const res = await fetchImpl(url, { headers: authHeaders(ctx) });
  if (!res.ok) {
    throw new Error(`Không đọc được danh sách comment của PR #${ctx.prNumber}: ${res.status} ${res.statusText}`);
  }
  const comments = (await res.json()) as GitHubIssueComment[];
  return comments.find((c) => c.body.startsWith(marker));
}

/**
 * Posts `body` as a PR comment, or edits the run's own previous comment
 * (found via `marker`, which `body` must itself start with) in place — so
 * pushing new commits updates one comment instead of stacking a fresh one
 * every time. `marker` defaults to GUARDIAN_REPORT_MARKER (the `guardian
 * check --ci` report comment); callers that post a different kind of
 * report (e.g. eval/report.ts) pass their own marker so the two never
 * collide or overwrite each other.
 *
 * `fetchImpl` defaults to the global fetch (Node >=18); overridable in tests.
 */
export async function postOrUpdateComment(
  ctx: GitHubContext,
  body: string,
  fetchImpl: typeof fetch = fetch,
  marker: string = GUARDIAN_REPORT_MARKER
): Promise<void> {
  const existing = await findExistingComment(ctx, fetchImpl, marker);

  const url = existing
    ? `${GITHUB_API}/repos/${ctx.owner}/${ctx.repo}/issues/comments/${existing.id}`
    : `${GITHUB_API}/repos/${ctx.owner}/${ctx.repo}/issues/${ctx.prNumber}/comments`;

  const res = await fetchImpl(url, {
    method: existing ? "PATCH" : "POST",
    headers: authHeaders(ctx),
    body: JSON.stringify({ body }),
  });
  if (!res.ok) {
    const action = existing ? "cập nhật" : "tạo";
    throw new Error(`Không thể ${action} comment trên PR #${ctx.prNumber}: ${res.status} ${res.statusText}`);
  }
}
