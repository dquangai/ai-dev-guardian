---
category: Git Workflow
scope: []
severity: low
tags: [git-workflow, commit-convention, branch-naming]
gitWorkflow:
  - commitPattern: "^(feat|fix|docs|chore|refactor|test|style|perf|build|ci|merge)(\\([a-z0-9._-]+\\))?: .+"
    branchPattern: "^(feature|fix|chore|docs|refactor)/[a-z0-9._-]+$"
    exemptBranches: ["master", "main"]
    description: "Repo này đã dùng nhất quán kiểu \"type(scope): mô tả\" (feat/fix/docs/chore/refactor/test/style/perf/build/ci/merge) trong lịch sử commit thật — xem `git log --oneline`."
---

# Git Workflow Policy

## 1. Executive Summary & Compliance Standards

Policy này bảo vệ khả năng tra cứu lịch sử thay đổi và tự động hoá (changelog, phân loại PR) —
commit message tuỳ tiện khiến `git log`/`git blame` (chính cơ chế component-ownership của Guardian,
xem `git/blame.ts`) trở nên vô nghĩa khi cần tra "ai đã đổi gì, vì sao" nhiều tháng sau. Đây là rule
duy nhất trong repo kiểm tra **git metadata** (tên branch, commit message) thay vì nội dung file.

- **ISO/IEC 27001 Annex A:** `A.12 Operations Security` (thay đổi được ghi nhận, truy vết được).

## 2. Normative Directives

### 2.1 Commit message phải theo format `type(scope): mô tả`

Subject line của commit HEAD phải khớp 1 trong các type: `feat`, `fix`, `docs`, `chore`,
`refactor`, `test`, `style`, `perf`, `build`, `ci`, `merge` — `scope` trong ngoặc là tuỳ chọn.

❌ **Non-Compliant:**

```
update stuff
```

✅ **Compliant:**

```
fix(auth): timing-safe compare cho checkPassword
```

### 2.2 Tên branch phải theo format `type/mô-tả-ngắn`

Chỉ áp dụng khi branch hiện tại KHÔNG nằm trong `exemptBranches` (branch trunk như `master`/`main`
được miễn — push trực tiếp lên trunk không theo quy ước đặt tên feature-branch).

❌ **Non-Compliant:** `quang-fix-2`

✅ **Compliant:** `fix/checkpassword-timing-safe`

## 3. Approved Exceptions & Carve-outs

- Branch nằm trong `exemptBranches` của rule (mặc định `master`/`main`) không bị kiểm tra
  `branchPattern` — trunk branch không theo quy ước đặt tên feature-branch.
- Chỉ kiểm tra commit **HEAD** (commit mới nhất) — Guardian là tool pre-push/pre-staged, không phải
  `commit-msg` hook có visibility từng commit riêng lẻ trong 1 lần push nhiều commit (xem
  `GitWorkflowRule.commitPattern` trong `src/policy/types.ts`).
- Không có branch (detached HEAD) hoặc không có commit nào (repo mới `git init`) → bỏ qua, không
  tính là vi phạm — không đủ dữ liệu để đánh giá, không phải lỗi thật.

## 4. Automated Enforcement

- **Deterministic check** — `checkGitWorkflowRules` (`src/checks/gitWorkflowCheck.ts`), đọc
  `gitWorkflow: [{ branchPattern, exemptBranches, commitPattern }]` ở frontmatter trên, so khớp
  bằng `RegExp` thật với tên branch (`git rev-parse --abbrev-ref HEAD`) và subject line commit HEAD
  (`git log -1`) — không qua LLM, không tốn API call.

## 5. Remediation & Escalation Guide

- **Tự sửa commit message:** `git commit --amend -m "type(scope): mô tả đúng format"` rồi push lại
  (`git push --force-with-lease` nếu đã push nhánh riêng — không amend commit đã có người khác pull).
- **Tự sửa tên branch:** `git branch -m <tên-mới-khớp-pattern>`.
- **Không đồng ý với verdict:** severity mặc định là `low` (không chặn push, chỉ cảnh báo) — cân
  nhắc nâng lên `medium`+ chỉ khi team thực sự muốn chặn cứng.
