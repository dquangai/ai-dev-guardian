---
category: Logging & Audit
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
severity: medium
tags: [logging, audit, observability]
---

# Logging & Audit

## 1. Executive Summary & Compliance Standards

Policy này bảo vệ khả năng điều tra sự cố bảo mật sau khi xảy ra (forensics/incident response) —
thiếu audit log cho sự kiện xác thực/phân quyền khiến tổ chức không thể trả lời câu hỏi "ai đã làm
gì, khi nào" sau một sự cố, kéo dài thời gian phát hiện và khắc phục xâm nhập. Quy tắc "không log
giá trị nhạy cảm" chi tiết đã có ở `security.policy.md` — policy này tập trung vào tính ĐẦY ĐỦ và
ĐÚNG MỨC của logging/audit, không lặp lại quy tắc redaction.

- **ISO/IEC 27001 Annex A:** `A.12.4 Logging and Monitoring`.
- **OWASP Top 10 (2021):** `A09:2021 – Security Logging and Monitoring Failures`.

## 2. Normative Directives

### 2.1 Sự kiện bảo mật phải log đủ actor/action/target/timestamp

Sự kiện liên quan bảo mật (đăng nhập thành công/thất bại, bị từ chối quyền 401/403, tạo/sửa/xoá
policy hoặc user, cấp/thu hồi token, đổi mật khẩu) phải được ghi audit log kèm tối thiểu: actor (ai
thực hiện), action (hành động gì), target (trên đối tượng nào), timestamp.

❌ **Non-Compliant:**

```ts
if (!hasPermission(req.userId, req.requiredScope)) {
  console.log("Error");
  return res.status(403).send("Forbidden");
}
```

✅ **Compliant:**

```ts
if (!hasPermission(req.userId, req.requiredScope)) {
  console.warn("[audit] permission_denied", {
    actor: req.userId,
    action: req.requiredScope,
    target: req.path,
    timestamp: new Date().toISOString(),
  });
  return res.status(403).send("Forbidden");
}
```

Áp dụng y hệt ở mọi ngôn ngữ, không chỉ TypeScript/Express — ví dụ Go, thu hồi token là một sự kiện
bảo mật cần audit log dù request thành công (không chỉ khi lỗi):

❌ **Non-Compliant:**

```go
func RevokeToken(w http.ResponseWriter, r *http.Request, tokenID string) {
  if err := revokeTokenByID(tokenID); err != nil {
    log.Println("revoke failed")
    http.Error(w, "error", http.StatusInternalServerError)
    return
  }
  w.WriteHeader(http.StatusNoContent) // thu hồi thành công nhưng không log gì — mất dấu vết audit
}
```

✅ **Compliant:**

```go
func RevokeToken(w http.ResponseWriter, r *http.Request, tokenID string, actorID string) {
  if err := revokeTokenByID(tokenID); err != nil {
    log.Println("revoke failed")
    http.Error(w, "error", http.StatusInternalServerError)
    return
  }
  log.Printf("[audit] token_revoked actor=%s target=%s timestamp=%s", actorID, tokenID, time.Now().Format(time.RFC3339))
  w.WriteHeader(http.StatusNoContent)
}
```

### 2.2 Log lỗi xác thực/phân quyền ở mức warn/error

Log lỗi xác thực/phân quyền nên dùng mức `warn`/`error`, không dùng `debug`/`info`/`trace` — log ở
mức thấp thường bị lọc mất khi giảm log level ở production, khiến sự cố bảo mật không được ghi lại.

### 2.3 Không dùng log thay thế cho việc chặn hành vi trái phép

Không dùng logging làm cơ chế phát hiện/chặn xâm nhập duy nhất — log phục vụ điều tra sau sự cố,
không thay thế cho việc middleware/authz chặn hành vi trái phép ngay tại thời điểm xảy ra.

❌ **Non-Compliant:**

```ts
if (req.body.amount > 1_000_000_000) {
  console.warn("Suspicious large transfer detected", req.body.amount);
}
return transferService.execute(req.body.fromAccount, req.body.toAccount, req.body.amount);
```

✅ **Compliant:**

```ts
if (req.body.amount > 1_000_000_000) {
  console.warn("[audit] suspicious_large_transfer", { actor: req.userId, amount: req.body.amount });
  return res.status(400).send("Giao dịch vượt hạn mức, vui lòng liên hệ hỗ trợ.");
}
return transferService.execute(req.body.fromAccount, req.body.toAccount, req.body.amount);
```

### 2.4 Không log toàn bộ request/response body thô ở endpoint auth

Không log toàn bộ request/response body thô của endpoint xử lý xác thực hoặc dữ liệu cá nhân — nếu
cần log để debug, phải lọc/redact các trường nhạy cảm trước khi log.

❌ **Non-Compliant:**

```ts
export function loginHandler(req: Request, res: Response, authService: AuthService) {
  console.log("Incoming login request:", req.body); // req.body chứa username + password thô
  return authService.login(req.body.username, req.body.password);
}
```

✅ **Compliant:**

```ts
export function loginHandler(req: Request, res: Response, authService: AuthService) {
  console.log("Incoming login request:", { username: req.body.username }); // chỉ field không nhạy cảm
  return authService.login(req.body.username, req.body.password);
}
```

## 3. Approved Exceptions & Carve-outs

- Log không phải sự kiện bảo mật (tiến độ build, log debug UI thuần tuý, log tiến trình xử lý dữ
  liệu công khai, gọi API bên ngoài không liên quan xác thực như tỷ giá/thời tiết) không bị ràng
  buộc bởi BẤT KỲ rule nào trong policy này (2.1 actor/action/target, 2.2 mức log warn/error, 2.4
  không log body thô) — toàn bộ policy này chỉ áp dụng cho sự kiện thực sự liên quan xác
  thực/phân quyền/thay đổi dữ liệu nhạy cảm. Ví dụ KHÔNG vi phạm (log mức `debug` cho việc gọi API
  tỷ giá — không phải sự kiện bảo mật, mức log thấp hoàn toàn hợp lệ):
  ```ts
  console.debug("Fetching exchange rate for", currency);
  ```
- Nếu code log một hành vi đáng ngờ RỒI CHẶN LẠI ngay sau đó (return lỗi/throw, không tiếp tục thực
  thi hành động), đây là compliant — 2.3 chỉ vi phạm khi log xong vẫn tiếp tục thực thi bình thường.

## 4. Automated Enforcement

- **LLM Policy Check** (`checkPoliciesWithLLM`) — cần hiểu ngữ cảnh để phân biệt sự kiện bảo mật với
  log thông thường, và để xác nhận log có đi kèm hành động chặn hay không.

## 5. Remediation & Escalation Guide

- **Tự sửa:** bổ sung actor/action/target/timestamp vào log sự kiện bảo mật; nâng log level lên
  warn/error; dùng prompt gợi ý sửa lỗi kèm mỗi vi phạm.
- **Nghi ngờ false positive:** dùng luồng "yêu cầu bypass" trên dashboard.
- **Leo thang:** nếu phát hiện một sự kiện bảo mật thật đã xảy ra mà KHÔNG có audit log nào (đã lỡ
  merge trước khi có policy này), báo Security Lead để đánh giá phạm vi ảnh hưởng do thiếu dữ liệu
  điều tra.
