---
category: Architecture
scope: ["src/**/*.ts", "src/**/*.tsx", "src/**/*.js", "src/**/*.jsx"]
severity: high
tags: [architecture, layering, dependency]
rules:
  - from: "src/policy/**"
    forbid: "src/checks/**"
    description: "Lớp policy (load/route file .policy.md) là tầng thấp nhất; checks mới là bên đọc và dùng policy, không phải ngược lại — import ngược sẽ tạo circular dependency giữa hai tầng."
  - from: "src/git/**"
    forbid: "src/cli.ts"
    description: "Tiện ích đọc git diff là tầng thấp, dùng chung cho mọi entrypoint (CLI, test); phụ thuộc vào cli.ts sẽ khiến nó không thể tái sử dụng hay test độc lập ngoài CLI."
---

# Architecture Policy

## 1. Executive Summary & Compliance Standards

Policy này bảo vệ khả năng bảo trì/mở rộng dài hạn của hệ thống — vi phạm layering hoặc circular
dependency làm mỗi thay đổi nhỏ có nguy cơ gây hiệu ứng domino khó lường, và làm không thể test độc
lập từng module. Đây là rule kiến trúc riêng của repo `ai-dev-guardian`, gắn với đúng cấu trúc thư
mục thật của dự án — khác với `import-rules.policy.md` (chọn import GÌ, không phải import TỪ ĐÂU).

- **ISO/IEC 27001 Annex A:** `A.14 System Acquisition, Development and Maintenance`.

Guardian tổ chức code theo layer: `git/` (đọc diff) → `policy/` (đọc & route policy) →
`checks/` (áp policy lên diff) → `orchestrator.ts` / `cli.ts` / `src/server/**` (điều phối,
entrypoint). Một layer chỉ được phụ thuộc vào layer cùng cấp hoặc thấp hơn, không bao giờ phụ
thuộc ngược lên layer cao hơn nó.

## 2. Normative Directives

### 2.1 Không import ngược lên layer cao hơn

Một module ở layer thấp (`git/`, `policy/`) không được import bất cứ thứ gì từ layer cao hơn nó
(`checks/`, `orchestrator.ts`, `cli.ts`). Các cặp import bị cấm tường minh được kiểm tra tự động qua
`rules` ở frontmatter phía trên.

❌ **Non-Compliant:**

```ts
// src/policy/loader.ts
import { scanForSecrets } from "../checks/secretScan"; // policy (thấp) import checks (cao hơn)
```

✅ **Compliant:**

```ts
// src/checks/secretScan.ts
import { loadPolicies } from "../policy/loader"; // checks (cao) import policy (thấp hơn) — đúng chiều
```

### 2.2 Không tạo circular dependency

Không tạo circular dependency giữa các module.

### 2.3 Không đặt business logic trong `cli.ts`

Không để logic nghiệp vụ (business logic) nằm trong `cli.ts` — file này chỉ được phép parse
argument, gọi hàm ở layer thấp hơn, và in/ghi kết quả ra ngoài. "Business logic" nghĩa là: tính
toán/quyết định nghiệp vụ thật (tính tiền, validate nhiều điều kiện nghiệp vụ, gọi thẳng payment/DB
ghi dữ liệu) nằm trực tiếp trong thân action handler — không phải việc parse flag hay convert kiểu
dữ liệu đơn giản của chính argument đó.

❌ **Non-Compliant:**

```ts
program.command("charge-customer").action(async (customerId) => {
  const customer = await db.customers.findById(customerId);
  const invoice = calculateInvoiceTotal(customer.cart);
  await paymentGateway.charge(customer.paymentMethodId, invoice.total);
  await db.invoices.insert({ customerId, total: invoice.total, status: "paid" });
});
```

✅ **Compliant:**

```ts
program
  .command("dashboard")
  .option("-p, --port <number>", "Cổng chạy dashboard", (v) => parseInt(v, 10))
  .action((options) => {
    startServer(options.port); // parse flag + gọi thẳng hàm ở layer thấp hơn — không phải business logic
  });
```

## 3. Approved Exceptions & Carve-outs

`src/server/**` (Express API cho web dashboard) là một entrypoint ngang hàng với `cli.ts` — CẢ HAI
cùng là "điều phối, entrypoint" trong sơ đồ layer ở trên, không phải business logic. Một route
handler trong `src/server/routes/**` gọi thẳng `runGuardianCheck` từ `orchestrator.ts`, hoặc
`cli.ts` gọi `startServer()` từ `src/server/index.ts`, đều là "gọi hàm ở layer thấp hơn/ngang hàng"
— hợp lệ, KHÔNG tính là vi phạm 2.1/2.3.

## 4. Automated Enforcement

- **Deterministic** — `architectureCheck.ts` (madge, phát hiện circular dependency thật trong đồ
  thị import) cho 2.2; `architectureRulesCheck.ts` (đọc trực tiếp `rules:` ở frontmatter phía trên,
  so khớp cặp from/forbid) cho 2.1.
- **LLM Policy Check** (`checkPoliciesWithLLM`) — cho 2.3 (đánh giá "có phải business logic hay
  không" cần hiểu ngữ nghĩa, không thể match bằng rule tất định).

## 5. Remediation & Escalation Guide

- **Tự sửa:** với vi phạm 2.1/2.2 (deterministic), thông báo lỗi đã chỉ rõ chuỗi import gây circular
  hoặc cặp from/forbid bị vi phạm — di chuyển logic dùng chung xuống một module thấp hơn cả hai bên.
- **Thêm rule mới:** thêm entry mới vào `rules:` ở frontmatter của chính policy này khi phát hiện
  cặp import cần cấm tường minh — không cần sửa code checker.
- **Nghi ngờ false positive:** dùng luồng "yêu cầu bypass" trên dashboard.
