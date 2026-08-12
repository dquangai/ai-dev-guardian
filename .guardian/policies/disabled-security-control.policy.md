---
category: Security Policy
scope:
  [
    "**/*.ts",
    "**/*.tsx",
    "**/*.js",
    "**/*.jsx",
    "**/*.py",
    "**/*.go",
    "**/Dockerfile",
    "**/Dockerfile.*",
    "**/*.yml",
    "**/*.yaml",
  ]
severity: critical
tags: [security, authentication, authorization]
allowCommentEvidence: true
---

# Disabled Security Control (Commented-Out)

## 1. Executive Summary & Compliance Standards

Tách riêng khỏi `security.policy.md` có chủ đích: một cơ chế xác thực/phân quyền bị **comment-out**
(để lại dưới dạng comment thay vì xoá hẳn) là dạng vi phạm mà bằng chứng hợp lệ DUY NHẤT chính là
dòng comment đó — trong khi mặc định Guardian loại bỏ mọi dòng comment khỏi tập bằng chứng hợp lệ
(để tránh nhầm một câu mô tả khái niệm bằng ngôn ngữ tự nhiên với code thực thi, xem
`security.policy.md`). Nếu áp dụng mặc định đó ở đây, vi phạm hợp lệ duy nhất sẽ luôn bị loại vì
"thiếu bằng chứng" — đây là lý do policy này bật riêng `allowCommentEvidence: true` trong
frontmatter, KHÔNG áp dụng cho các rule khác trong `security.policy.md`.

- **OWASP Top 10 (2021):** `A07:2021 – Identification and Authentication Failures`.
- **ISO/IEC 27001 Annex A:** `A.9 Access Control`.

## 2. Normative Directives

### 2.1 Không để lại cơ chế xác thực/phân quyền bị comment-out

Không comment-out (thay vì xoá hẳn hoặc sửa đúng) một lời gọi xác thực (authentication) hay kiểm
tra phân quyền (authorization) đã tồn tại — dù người viết có ý định "bật lại sau" hay không, dòng
code đang thực thi thực tế là KHÔNG có kiểm tra nào cả.

❌ **Non-Compliant:**

```ts
export function adminOnly(req: Request, res: Response, next: NextFunction) {
  // if (req.user?.role !== "admin") return res.status(403).send("Forbidden");
  // tạm comment để test nhanh, nhớ bật lại trước khi merge
  next();
}
```

✅ **Compliant:**

```ts
export function adminOnly(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") return res.status(403).send("Forbidden");
  next();
}
```

## 3. Approved Exceptions & Carve-outs

- KHÔNG áp dụng cho code vốn dĩ không cần xác thực (CLI tool chạy local, không expose network
  service).
- Comment CẢNH BÁO/HƯỚNG DẪN dev tránh làm điều gì đó (ví dụ "KHÔNG được tự chế kiểu
  `if (req.headers['x-admin-secret'] === ...)`") không tính là vi phạm — đây là hướng dẫn, không
  phải một lời gọi xác thực đã tồn tại rồi bị tắt.
- Comment-out code KHÔNG liên quan xác thực/phân quyền (ví dụ logic hiển thị cũ, thuật toán cũ) —
  xem `dead-code.policy.md`, không thuộc phạm vi policy này.

## 4. Automated Enforcement

- **LLM Policy Check** (`checkPoliciesWithLLM`) — `allowCommentEvidence: true` cho phép
  `evidenceSnippet` là chính dòng comment chứa cơ chế đã bị tắt, thay vì bị loại khỏi tập bằng
  chứng như mặc định.

## 5. Remediation & Escalation Guide

- **Tự sửa:** bỏ comment (`//`) để cơ chế xác thực chạy lại thật, hoặc xoá hẳn nếu không còn cần.
- **Leo thang:** `severity: critical` — nếu route đã merge vào `main`/production ở trạng thái tắt
  xác thực, coi như sự cố bảo mật cần điều tra ngay, không chỉ là một finding chờ sửa.
