---
category: Coding Convention
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
severity: low
tags: [style, readability, maintainability]
allowCommentEvidence: true
---

# Dead Code & Unresolved TODOs

## 1. Executive Summary & Compliance Standards

Tách riêng khỏi `coding-convention.policy.md` có chủ đích: bằng chứng hợp lệ cho code đã comment-out
hoặc TODO bỏ ngỏ chính là dòng comment đó — nếu dùng chung policy với rule "không dùng `any` mà
không giải thích" (nơi mặc định loại comment khỏi bằng chứng để tránh nhầm câu mô tả khái niệm với
code thật), vi phạm hợp lệ duy nhất ở đây sẽ luôn bị loại vì "thiếu bằng chứng". Policy này bật
riêng `allowCommentEvidence: true`.

- **ISO/IEC 27001 Annex A:** `A.14 System Acquisition, Development and Maintenance`.

## 2. Normative Directives

### 2.1 Không để lại code đã comment-out

❌ **Non-Compliant:**

```ts
function formatInvoice(invoice: Invoice): string {
  // const legacyFormat = invoice.items.map(i => `${i.name} x${i.qty}`).join('\n');
  // return `Invoice #${invoice.id}\n${legacyFormat}`;
  return `Invoice #${invoice.id} — Total: ${invoice.total}`;
}
```

✅ **Compliant:**

```ts
function formatInvoice(invoice: Invoice): string {
  return `Invoice #${invoice.id} — Total: ${invoice.total}`;
}
```

### 2.2 Không để lại TODO không có ngữ cảnh

Một `TODO` chấp nhận được nếu có ngữ cảnh cụ thể (link issue, lý do, ai chịu trách nhiệm); không
chấp nhận nếu chỉ là `// TODO` hoặc `// TODO: fix this` không nói rõ gì thêm.

❌ **Non-Compliant:**

```ts
// TODO: fix this
function calculateDiscount(order: Order): number { ... }
```

✅ **Compliant:**

```ts
// TODO(#482): áp dụng đúng công thức giảm giá theo tier khách hàng mới — chờ BA chốt bảng giá
function calculateDiscount(order: Order): number { ... }
```

## 3. Approved Exceptions & Carve-outs

- Comment giải thích một quyết định thiết kế (WHY), không phải code cũ bị vô hiệu hoá — không tính
  là vi phạm 2.1 (đây là comment hợp lệ, không phải dead code).
- Code trong file test đang debug tạm — không thuộc "code chuẩn bị merge" theo nghĩa code path sản
  phẩm. Nhận diện "đây là file test" qua nội dung (`describe`/`it`/`test(` kiểu Vitest/Jest,
  `def test_...` kiểu pytest), không chỉ qua đường dẫn thư mục. Ví dụ KHÔNG vi phạm:
  ```ts
  describe("formatInvoice", () => {
    // const legacyExpected = "Invoice #1 - Total: 100"; // để tạm khi debug snapshot cũ
    it("format đúng chuỗi hoá đơn", () => {
      expect(formatInvoice({ id: 1, total: 100 })).toBe("Invoice #1 — Total: 100");
    });
  });
  ```

## 4. Automated Enforcement

- **LLM Policy Check** (`checkPoliciesWithLLM`) — `allowCommentEvidence: true` cho phép
  `evidenceSnippet` là chính dòng code đã comment-out hoặc dòng TODO.

## 5. Remediation & Escalation Guide

- **Tự sửa:** xoá hẳn code đã comment-out; bổ sung ngữ cảnh cụ thể cho TODO hoặc tạo issue theo dõi.
- `severity: low` — không chặn push, sửa trước lần merge tiếp theo.
