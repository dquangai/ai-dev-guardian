import simpleGit, { type SimpleGit } from "simple-git";

export interface DiffResult {
  diffText: string;
  changedFiles: string[];
}

const NULL_SHA = "0".repeat(40);
// Git's well-known hash for an empty tree — diffing against it yields "everything added".
const EMPTY_TREE_SHA = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

function git(cwd: string): SimpleGit {
  return simpleGit(cwd);
}

async function diffBetween(g: SimpleGit, range: string): Promise<DiffResult> {
  const [diffText, nameOnly] = await Promise.all([
    g.diff([range]),
    g.diff([range, "--name-only"]),
  ]);
  const changedFiles = nameOnly.split("\n").map((line) => line.trim()).filter(Boolean);
  return { diffText, changedFiles };
}

/** Diff of the index against HEAD — what `--staged` sees before a commit. */
export async function getStagedDiff(cwd: string = process.cwd()): Promise<DiffResult> {
  return diffBetween(git(cwd), "--cached");
}

/**
 * Diff for the commit(s) about to be pushed, given git's pre-push hook stdin
 * contract: lines of "<local-ref> <local-sha> <remote-ref> <remote-sha>".
 * Only the first non-deletion line is used (MVP: single ref per push).
 */
export async function getPushRangeDiff(
  stdinInput: string,
  cwd: string = process.cwd()
): Promise<DiffResult> {
  const g = git(cwd);

  const line = stdinInput
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .find((l) => l.split(/\s+/)[1] && l.split(/\s+/)[1] !== NULL_SHA);

  const fields = line?.split(/\s+/) ?? [];
  const localSha = fields[1];
  const remoteSha = fields[3];

  if (localSha && remoteSha && remoteSha !== NULL_SHA) {
    return diffBetween(g, `${remoteSha}..${localSha}`);
  }

  // New branch with no remote history yet: diff the latest commit, or the
  // full tree against the empty-tree if this is the repo's very first commit.
  const log = await g.log({ maxCount: 2 }).catch(() => ({ all: [] as unknown[] }));
  if (log.all.length >= 2) {
    return diffBetween(g, "HEAD~1..HEAD");
  }
  return diffBetween(g, `${EMPTY_TREE_SHA}..HEAD`);
}

/**
 * Diff for a pull request: everything on `headRef` since it diverged from
 * `baseRef`, using triple-dot (merge-base) semantics so commits landed on
 * base after the branch point don't show up as PR changes. Requires the
 * caller's checkout to have both refs reachable (CI: `fetch-depth: 0`).
 */
export async function getPullRequestDiff(
  baseRef: string,
  headRef: string = "HEAD",
  cwd: string = process.cwd()
): Promise<DiffResult> {
  return diffBetween(git(cwd), `${baseRef}...${headRef}`);
}
