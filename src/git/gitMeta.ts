import simpleGit from "simple-git";

/**
 * Current checked-out branch name (e.g. "feature/x"), or null on detached HEAD, a repo with no
 * commits yet, not being inside a git repo, or any other git error — best-effort, same fail-safe
 * convention as git/blame.ts. Used by checks/gitWorkflowCheck.ts for branch-naming rules.
 */
export async function currentBranchName(cwd: string = process.cwd()): Promise<string | null> {
  try {
    const branch = (await simpleGit(cwd).revparse(["--abbrev-ref", "HEAD"])).trim();
    // "HEAD" itself is what git prints for a detached HEAD (no branch to name-check).
    return branch && branch !== "HEAD" ? branch : null;
  } catch {
    return null;
  }
}

/**
 * Subject line (first line only, no body) of HEAD's commit message, or null if there's no commit
 * yet or any git error. MVP: only the single most recent commit — see GitWorkflowRule.commitPattern
 * in policy/types.ts for why a multi-commit push range isn't checked commit-by-commit.
 */
export async function headCommitSubject(cwd: string = process.cwd()): Promise<string | null> {
  try {
    const log = await simpleGit(cwd).log({ maxCount: 1 });
    return log.latest?.message ?? null;
  } catch {
    return null;
  }
}
