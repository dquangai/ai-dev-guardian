import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { checkGitWorkflowRules } from "../src/checks/gitWorkflowCheck";
import type { DiffResult } from "../src/git/diff";
import type { GitWorkflowRule, Policy } from "../src/policy/types";

function diffFor(changedFiles: string[]): DiffResult {
  return { diffText: "", changedFiles };
}

function policyWithRule(rule: GitWorkflowRule, overrides: Partial<Policy> = {}): Policy {
  return {
    id: "git-workflow.policy.md",
    category: "Git Workflow",
    scope: [],
    severity: "low",
    tags: [],
    body: "body",
    rules: [],
    dependencyAllowlist: [],
    gitWorkflow: [rule],
    testingStandards: [],
    ...overrides,
  };
}

/** Creates a tmp git repo checked out on `branch`, with 1 commit whose subject is `commitSubject`. */
function makeRepo(branch: string, commitSubject: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "guardian-gitworkflow-test-"));
  execFileSync("git", ["init", "-q", "-b", branch], { cwd: dir });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "test@guardian.dev"], { cwd: dir });
  fs.writeFileSync(path.join(dir, "a.txt"), "hello\n");
  execFileSync("git", ["add", "a.txt"], { cwd: dir });
  execFileSync("git", ["commit", "-q", "-m", commitSubject], { cwd: dir });
  return dir;
}

describe("checkGitWorkflowRules", () => {
  it("không có policy nào định nghĩa gitWorkflow -> []", async () => {
    const dir = makeRepo("feature/x", "feat: ok");
    try {
      const noRulePolicy: Policy = {
        id: "other.policy.md",
        category: "Other",
        scope: [],
        severity: "low",
        tags: [],
        body: "",
        rules: [],
        dependencyAllowlist: [],
        gitWorkflow: [],
        testingStandards: [],
      };
      expect(await checkGitWorkflowRules(diffFor(["x.ts"]), [noRulePolicy], dir)).toEqual([]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("không có file nào thay đổi -> [] (không có gì để push/stage)", async () => {
    const dir = makeRepo("badbranchname", "bad message");
    try {
      const policy = policyWithRule({ branchPattern: "^feature/.+$", commitPattern: "^feat: .+$" });
      expect(await checkGitWorkflowRules(diffFor([]), [policy], dir)).toEqual([]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("branch không khớp branchPattern -> 1 violation", async () => {
    const dir = makeRepo("quang-fix-2", "feat: ok");
    try {
      const policy = policyWithRule({ branchPattern: "^(feature|fix)/[a-z0-9-]+$" });
      const violations = await checkGitWorkflowRules(diffFor(["x.ts"]), [policy], dir);
      expect(violations).toHaveLength(1);
      expect(violations[0].source).toBe("git-workflow-check");
      expect(violations[0].errorWhat).toContain("quang-fix-2");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("branch nằm trong exemptBranches -> không bị kiểm tra branchPattern", async () => {
    const dir = makeRepo("master", "feat: ok");
    try {
      const policy = policyWithRule({ branchPattern: "^feature/.+$", exemptBranches: ["master"] });
      expect(await checkGitWorkflowRules(diffFor(["x.ts"]), [policy], dir)).toEqual([]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("branch khớp branchPattern -> không vi phạm", async () => {
    const dir = makeRepo("feature/checkout-flow", "feat: ok");
    try {
      const policy = policyWithRule({ branchPattern: "^(feature|fix)/[a-z0-9-]+$" });
      expect(await checkGitWorkflowRules(diffFor(["x.ts"]), [policy], dir)).toEqual([]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("commit message không khớp commitPattern -> 1 violation", async () => {
    const dir = makeRepo("feature/x", "update stuff");
    try {
      const policy = policyWithRule({ commitPattern: "^(feat|fix|docs|chore): .+$" });
      const violations = await checkGitWorkflowRules(diffFor(["x.ts"]), [policy], dir);
      expect(violations).toHaveLength(1);
      expect(violations[0].errorWhat).toContain("update stuff");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("commit message khớp commitPattern -> không vi phạm", async () => {
    const dir = makeRepo("feature/x", "fix(auth): timing-safe compare");
    try {
      const policy = policyWithRule({ commitPattern: "^(feat|fix|docs|chore)(\\([a-z]+\\))?: .+$" });
      expect(await checkGitWorkflowRules(diffFor(["x.ts"]), [policy], dir)).toEqual([]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("lấy severity từ policy sở hữu rule, không hardcode", async () => {
    const dir = makeRepo("bad", "bad");
    try {
      const policy = policyWithRule(
        { branchPattern: "^feature/.+$" },
        { severity: "critical" }
      );
      const violations = await checkGitWorkflowRules(diffFor(["x.ts"]), [policy], dir);
      expect(violations[0].riskLevel).toBe("critical");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("regex hỏng trong policy -> không throw, coi như không kiểm tra được rule đó", async () => {
    const dir = makeRepo("feature/x", "feat: ok");
    try {
      const policy = policyWithRule({ branchPattern: "(unclosed" });
      await expect(checkGitWorkflowRules(diffFor(["x.ts"]), [policy], dir)).resolves.toEqual([]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("cwd không phải git repo -> không throw, coi như không có branch/commit để kiểm tra", async () => {
    const notGitDir = fs.mkdtempSync(path.join(os.tmpdir(), "guardian-gitworkflow-nogit-"));
    try {
      const policy = policyWithRule({ branchPattern: "^feature/.+$", commitPattern: "^feat: .+$" });
      await expect(checkGitWorkflowRules(diffFor(["x.ts"]), [policy], notGitDir)).resolves.toEqual([]);
    } finally {
      fs.rmSync(notGitDir, { recursive: true, force: true });
    }
  });
});
