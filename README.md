<div align="center">

# AI Dev Guardian

[![npm version](https://img.shields.io/npm/v/ai-dev-guardian.svg)](https://www.npmjs.com/package/ai-dev-guardian)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-green.svg)](https://nodejs.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)
[![GitHub stars](https://img.shields.io/github/stars/dquangai/ai-dev-guardian?style=social)](https://github.com/dquangai/ai-dev-guardian/stargazers)

</div>

---

4 independent checks per push · evidence-grounded LLM reasoning · zero auto-patch · one `npm install`

AI Dev Guardian is a Node/TypeScript CLI and git pre-push hook that gates a push against a
project's own **Project Policy**. It is not a linter and not a thin LLM wrapper: every check runs
scoped to the current diff, every LLM claim is cross-checked against the real diff text before
being trusted, and the tool never writes code on your behalf — it only ever proposes a
copy-paste-ready fix prompt.

## Install

```bash
npm install
npm run build
npm link   # exposes the `guardian` command globally; or run `node dist/cli.js` directly
```

## Quick Start

```bash
# 1. Configure an LLM key — create .env at the project root (already gitignored)
echo "ANTHROPIC_API_KEY=sk-ant-..." >> .env   # or OPENAI_API_KEY=sk-...

# 2. Check staged changes by hand, before committing
guardian check --staged

# 3. Install the pre-push hook — every `git push` prompts and runs `guardian check`
guardian install-hook
```

Programmatic usage is the same entry point the CLI calls (`src/orchestrator.ts`):

```ts
import { runGuardianCheck } from "ai-dev-guardian/dist/orchestrator";
import { getStagedDiff } from "ai-dev-guardian/dist/git/diff";

const diff = await getStagedDiff();
const report = await runGuardianCheck(diff);
// report.verdict: "PASS" | "BLOCK"
// report.violations: Violation[] — see src/report/types.ts
```

No LLM key set is fine — Guardian still runs the 3 deterministic checks (secret scan,
circular-dependency check, and Semgrep if installed), logs a warning, and skips the LLM-powered
policy check. Exit code `1` on `BLOCK` (any violation at `medium` severity or above), `0` on
`PASS` — safe to wire in as a required CI check.

## Architecture

```mermaid
flowchart LR
    A["git push"] --> B{Pre-push Hook}
    B -->|Confirm Y/n| C["Guardian CLI"]
    C --> D["Get diff, drop test/"]
    D --> E["Secret Scan (regex)"]
    D --> M["Circular Dependency<br/>Check (madge)"]
    D --> S["Semgrep<br/>(optional, if installed)"]
    D --> F{Diff hash matches a<br/>recent PASS?}
    F -->|Yes| G["Skip the LLM call"]
    F -->|No| H["RAG-lite: read related files"]
    H --> I["LLM Reasoning (Claude / GPT)<br/>+ evidence grounding<br/>+ self-consistency on critical"]
    E --> J{Merge into Verdict}
    M --> J
    S --> J
    G --> J
    I --> J
    J -->|PASS| K["Allow Push + update cache"]
    J -->|BLOCK| L["Block Push + print fix prompt"]
```

`runGuardianCheck` (`src/orchestrator.ts`) runs all 4 checks concurrently via `Promise.all`, then
merges every `Violation[]` into one report. Every collaborator — `loadPolicies`,
`scanForSecrets`, `checkPoliciesWithLLM`, `checkCircularDependencies`, `checkWithSemgrep`,
`readCache`, `writeCache` — is injected through an `OrchestratorDeps` interface with
`deps.X ?? X` fallback to the real implementation, so every check is independently unit-testable
without touching the filesystem, git, or a real LLM/binary. A verdict is `BLOCK` iff at least one
violation has `riskLevel` in `{medium, high, critical}` (`BLOCKING_SEVERITIES` in
`orchestrator.ts`); `low` findings are reported but never block.

## Checks

| Check | File | Deterministic? | Scope |
|---|---|---|---|
| **Secret scan** | `src/checks/secretScan.ts` | Yes (regex) | Added (`+`) diff lines only — AWS keys, generic API key/token/password patterns, PEM private keys, Slack/GitHub tokens |
| **LLM policy check** | `src/checks/llmPolicyCheck.ts` | No (Claude/GPT) | One call per changed file, scoped to only the policies whose `scope` glob matches that file |
| **Circular dependency check** | `src/checks/architectureCheck.ts` | Yes (madge) | TS/JS/JSX/MJS/CJS only; reports a cycle only if this diff's `changedFiles` intersect it |
| **Semgrep check** | `src/checks/semgrepCheck.ts` | Yes (Semgrep CLI, optional) | Findings filtered to lines this diff actually added, via `addedLineNumbers()` |

Secret scan and the circular-dependency check always run — they're free. The LLM check is
skipped when no `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` is set, or when the diff hash matches a
recent `PASS` (see [Caching](#caching)). The Semgrep check is skipped when the `semgrep` binary
isn't found in `PATH` — in both skip cases Guardian logs a warning and continues, never blocking
the push over a missing optional dependency.

## LLM reasoning: evidence grounding & self-consistency

The LLM is never asked to freely describe a violation. It must call a `report_violations` tool
whose JSON Schema (`src/checks/llm/types.ts`) constrains every field:

- **`policyId`** is a `enum` built from exactly the policy ids loaded for that file. A response
  outside that enum is dropped before it ever reaches the report — the model cannot cite a policy
  that doesn't exist, and the final report text is always reconstructed from the real policy
  file, never trusted verbatim from the model.
- **`evidenceSnippet`** must be the exact line(s) copied from the diff that trigger the
  violation. `isEvidenceGrounded()` in `llmPolicyCheck.ts` splits it into trimmed lines and
  requires every one to occur verbatim in the file's real diff text — a claim that can't be
  traced back to actual code is dropped, the same grounding mechanism as `policyId`.
- **`riskLevel: "critical"`** — the one severity that alone blocks a push — additionally requires
  self-consistency: on any first-pass `critical` finding, `checkPoliciesWithLLM` re-runs the
  *identical* prompt against the same file a second time and keeps the finding only if the same
  `policyId` appears in both passes. A disagreement between the two independent passes is treated
  as a false positive and dropped, at the cost of exactly one extra LLM call — paid only on the
  pushes that actually contain a critical finding, not on every push.

Every file is reasoned about independently: one prompt per changed file, containing only the
policies whose `scope` glob (matched via `micromatch`) applies to that file — never a multi-file
diff crammed into a single call.

## RAG-lite: per-language context retrieval

Before the LLM call, `src/checks/llm/fileContext.ts` pulls in up to `MAX_SATELLITE_FILES = 3`
locally-imported files (each capped at `SATELLITE_MAX_BYTES = 10_000` bytes) alongside the
changed file's own full content (capped at `DEFAULT_MAX_BYTES = 20_000` bytes), so the model
reasons with the actual type/interface/function definitions the diff depends on.

Extraction is language-specific, dispatched by file extension:

| Language | Extraction | Resolution |
|---|---|---|
| TS/JS/JSX/MJS/CJS | Real parser via `@ast-grep/napi` (tree-sitter) — walks `import_statement`/`export_statement` nodes' `source` field, plus `call_expression` nodes whose callee is `require`/`import`. Falls back to a regex extractor (`TS_IMPORT_REGEX`) if parsing throws or returns 0 results. | Tries suffixes `"", .ts, .tsx, .js, .jsx, /index.ts, /index.tsx"` relative to the importing file's directory |
| Python | Regex on `from X import Y` where `X` starts with `.` (relative only). Bare `from . import pkg` folds the first imported name into the specifier (`.pkg`) since a bare dot alone can't resolve to a submodule. | Dot-count walks up parent directories; remaining dots become path separators; tries `.py` then `/__init__.py` |
| C/C++ | Regex on `#include "relative/path.h"` — angle-bracket `#include <...>` (always a system header) is never matched. | Direct relative-path resolution, no extension guessing (includes always specify the full filename) |
| Go | Regex over `import (...)` blocks and single `import "..."` statements. | Reads the module path from `go.mod`; a specifier is local only if it's prefixed by that module path, and resolves to the first non-`_test.go` file in the corresponding package directory (Go imports name a package/directory, not a file) |

Any other extension gets diff-only context, no satellite files.

## Circular dependency detection

`checkCircularDependencies()` (`src/checks/architectureCheck.ts`) short-circuits to `[]`
immediately if no changed file has a TS/JS extension — no repo walk on unrelated pushes.
Otherwise it runs [madge](https://github.com/pahen/madge) against the whole project
(`fileExtensions: ["js","jsx","ts","tsx","mjs","cjs"]`, `tsConfig` auto-detected if
`tsconfig.json` exists, `node_modules`/`dist`/`.git`/`coverage` excluded) and calls
`.circular()` to get every cycle in the codebase. Paths are normalized to POSIX and a cycle is
only *reported* if at least one file in it is also in `diff.changedFiles` — Guardian never
flags a pre-existing cycle the current push doesn't touch. Any madge failure (missing tsconfig,
unparseable project) is swallowed and treated as "no violations," never blocking a push on its
own error. Fixed `riskLevel: "medium"` — there's no policy file governing this check yet (see
[Roadmap](#roadmap)).

## Optional Semgrep integration

`checkWithSemgrep()` (`src/checks/semgrepCheck.ts`) is the one check that shells out to an
external binary rather than an npm dependency. It:

1. Filters `diff.changedFiles` to paths that actually exist on disk, and returns `[]` without
   spawning anything if none do.
2. Runs `semgrep --config <config> --json --quiet <targets>`, where `<config>` defaults to the
   Semgrep Registry ruleset `p/security-audit` and is overridable via `GUARDIAN_SEMGREP_CONFIG`
   in `.env` (same override pattern as `GUARDIAN_LLM_PROVIDER`/`GUARDIAN_LLM_MODEL`).
3. On `ENOENT` (binary not found), logs one warning and returns `[]` — never treated as a
   blocking failure.
4. Cross-references every finding's `start.line` against `addedLineNumbers(diff.diffText, path)`
   (`src/git/diffLines.ts`, which walks unified-diff hunk headers to compute post-change line
   numbers) and drops any finding that lands on a line this diff didn't actually add — Semgrep
   scans whole files, but Guardian only ever judges the diff.
5. Maps `extra.severity`: `ERROR → high`, `WARNING → medium`, `INFO → low`.

## Policy as Code

Each file under `.guardian/policies/*.md` is one policy — YAML frontmatter plus a Markdown body
handed to the LLM verbatim, no intermediate summarization:

```markdown
---
category: Security Policy
scope: ["src/**/*.ts"]   # [] means it applies globally
severity: critical        # low | medium | high | critical
tags: [security]
---

The rule itself, written like you're explaining it to a developer.
```

`loadPolicies()` (`src/policy/loader.ts`) reads every `.md` file under `.guardian/policies/`
(default via `DEFAULT_POLICY_DIR`), parsing frontmatter with `gray-matter` and defaulting
`severity` to `medium` if invalid/missing. `routePolicies()` (`src/policy/router.ts`) then
filters to only the policies relevant to the current diff — via `micromatch.isMatch` against each
policy's `scope` globs (a `scope: []` policy applies globally) — so the full policy library is
never stuffed into a single LLM call, and each file's prompt only carries the rules that could
possibly apply to it.

## Caching

`hashDiffText()` SHA-256-hashes the (test-file-excluded) diff text. `writeCache()`
(`src/cache.ts`) stores it in `.git/guardian_cache.json` as `passedDiffHashes: string[]` — an
LRU of the last `MAX_CACHED_HASHES = 20` hashes that produced a `PASS`, most-recent-first,
deduplicated. On the next run, if the current diff hash appears **anywhere** in that list — not
just the most recent entry — the LLM policy check is skipped entirely (secret scan, the
circular-dependency check, and Semgrep still run; they're free). This survives switching between
branches: a diff that passed on branch A is still cached if you check out branch B and back. A
`BLOCK` verdict is never cached, so a fixed diff is always re-checked.

## Prompt-as-a-Fix

Guardian never patches code directly — a patch that compiles but breaks logic is worse than no
patch. Every violation's `promptToFix` is instead a ready-to-paste natural-language request for
*your own* AI assistant (Copilot/ChatGPT/Claude), following a fixed template the LLM is
constrained to reproduce via the JSON Schema. The actual code change stays a human (or your own
assistant's) decision.

## Interactive git hook

`guardian install-hook` writes a pre-push hook that runs `guardian check`. In a real TTY it
prompts `Y/n` before running; in CI or any non-interactive script (`confirmOnTTY` detects
`process.stdin.isTTY`) it fails open — the check always runs, the prompt is skipped — so Guardian
never hangs a pipeline waiting on input that will never come.

```bash
npm test   # full unit test suite — no API calls, no semgrep/madge network access, no real terminal
```

## Roadmap

### Shipped

| Feature | Details |
|---|---|
| Deterministic secret scan | Regex rules for AWS keys, generic API key/token/password, PEM private keys, Slack/GitHub tokens; runs on added diff lines only, always on |
| LLM policy check | Per-file, per-policy-scope reasoning via Anthropic Claude or OpenAI GPT (auto-selected by which `.env` key is present) |
| Policy as Code | Markdown + YAML frontmatter under `.guardian/policies/`, glob-routed via `micromatch` |
| Evidence-grounded violations | `evidenceSnippet` must occur verbatim in the real diff text or the violation is dropped |
| Self-consistency on critical findings | A second independent LLM pass must reproduce the same `policyId` before a `critical` verdict is kept |
| Prompt-as-a-Fix | Model generates a templated fix-request prompt; Guardian never writes code itself |
| SHA-256 diff-hash caching | LRU of last 20 `PASS` hashes in `.git/guardian_cache.json`, survives branch switching |
| Inter-file RAG-lite context | TypeScript/JavaScript (ast-grep, regex fallback), Python, C/C++, Go — up to 3 satellite files, 10KB each |
| Circular dependency detection | madge-backed, TS/JS only, scoped to cycles the current diff's `changedFiles` actually touch |
| Optional Semgrep integration | `p/security-audit` ruleset by default (`GUARDIAN_SEMGREP_CONFIG` overridable), findings filtered to added diff lines |
| Interactive pre-push git hook | `Y/n` in a real TTY, fail-open (always runs) in CI/non-interactive scripts |

### Planned

| Feature | What it would look like |
|---|---|
| **CI / GitHub Action gate** | A `guardian-action` that runs `runGuardianCheck` against a PR's diff and posts a comment, plus a git-versioned baseline artifact (mirroring the diff-hash cache but shared across a team instead of local `.git/`) so PRs don't re-pay for a diff a teammate already got `PASS`'d elsewhere |
| **Architecture Rules policy category** | Policy-driven dependency-direction rules beyond circular-dependency detection — e.g. `forbid: ["src/core/** -> src/cli/**"]` in policy frontmatter, checked deterministically by reusing the same local-import extraction RAG-lite already does, no LLM call needed |
| **Git Workflow policy category** | Branch naming, commit message format, merge-strategy rules — deterministic, checked against `diff`/git metadata rather than file content |
| **Testing Standards policy category** | Coverage-delta and test-file-presence rules (e.g. "a new `src/**/*.ts` file must have a matching `test/**/*.test.ts`") |
| **Dependency Rules policy category** | Allowed/forbidden package policies — checked against `package.json` diff hunks, e.g. blocking a new dependency not on an approved list |
| **Business Requirements policy category** | Domain-specific rules tying code changes to product requirements (exact mechanism TBD — likely requires linking to an external requirements/issue source) |
| **Jira integration** | Link reported violations to a tracked issue automatically, rather than only printing a fix prompt |
| **Component ownership via git blame** | Attach the last author of a violated line to the violation report, so `promptToFix` can be routed to the right person, not just printed generically |
| **Policy-driven severity for circular dependency check** | Currently hardcoded `medium` in `architectureCheck.ts` — move to a `.guardian/policies/architecture.md` file so severity/scope become project-configurable like every other policy-backed check |

## Contributing

AI Dev Guardian is still at the MVP stage — feedback, bug reports, and pull requests are all welcome.

- Found a bug? Open an issue.
- Have a feature idea? Propose it, no need to ask first.
- Want to contribute code? Fork, branch, and send a PR.

If this project is useful to you, a star helps a lot — it's the biggest motivation to keep building it.

<div align="center">

Made by DoanQuang and contributors.

</div>
