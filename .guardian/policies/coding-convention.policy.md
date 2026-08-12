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
---

# Coding Convention

## 1. Executive Summary & Compliance Standards

Policy này bảo vệ khả năng bảo trì lâu dài của codebase — code khó đọc, gộp nhiều trách nhiệm trong
một hàm, hoặc dùng kiểu dữ liệu mơ hồ (`any`) làm tăng thời gian review, che giấu bug logic, và làm
chậm mọi thay đổi sau này. Quy tắc đặt tên (naming) đã tách sang policy riêng — xem
`naming-convention.policy.md` (cùng thuộc sáng kiến Coding Standards, tách để tránh trùng lặp nội
dung giữa hai policy).

- **ISO/IEC 27001 Annex A:** `A.14 System Acquisition, Development and Maintenance` (chất lượng
  code là một phần của vòng đời phát triển an toàn — secure SDLC).

## 2. Normative Directives

### 2.1 Không để lại `console.log` debug

Không để lại `console.log` debug trong code chuẩn bị merge. (Code đã comment-out hoặc TODO không
có ngữ cảnh là một policy RIÊNG — xem `dead-code.policy.md` — vì bằng chứng hợp lệ cho 2 trường hợp
đó nằm trong dòng comment, cần `allowCommentEvidence: true` mà policy này không bật.)

❌ **Non-Compliant:**

```ts
function calculateTotal(items: CartItem[]): number {
  const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  console.log("debug: total is", total);
  return total;
}
```

✅ **Compliant:**

```ts
function calculateTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.qty, 0);
}
```

### 2.2 Một hàm — một trách nhiệm (Single Responsibility)

Hàm/method nên có một trách nhiệm rõ ràng; tránh hàm gộp nhiều việc không liên quan trong cùng một
hàm (ví dụ vừa validate input, vừa ghi DB, vừa gửi email). **Dấu hiệu vi phạm là VIỆC GỘP NHIỀU
TRÁCH NHIỆM KHÔNG LIÊN QUAN, không phải số dòng** — một hàm 30-40 dòng nhưng rõ ràng làm 3 việc tách
biệt (validate + persist + notify) VẪN vi phạm, không cần chờ vượt 50 dòng mới tính. ">50 dòng" chỉ
là một tín hiệu THAM KHẢO thường đi kèm (hàm càng dài càng dễ gộp nhiều việc), không phải điều kiện
bắt buộc phải thoả trước khi đánh giá vi phạm. Vì vi phạm này trải dài trên nhiều dòng,
`evidenceSnippet` nên trích DÒNG KHAI BÁO HÀM (function signature) — một dòng code thật, đủ để định
vị vi phạm — thay vì cố ghép nhiều đoạn xa nhau thành một trích dẫn.

❌ **Non-Compliant:**

```ts
async function checkoutOrder(input: CheckoutInput, db: Database, gateway: PaymentGateway, mailer: Mailer) {
  if (!input.cartId) throw new Error("cartId is required");
  // ...nhiều bước validate khác...
  const charge = await gateway.charge({ amount: total, customerId: input.customerId });
  const order = await db.orders.insert({ cartId: input.cartId, total, paymentChargeId: charge.id });
  await mailer.send({ to: input.customerEmail, subject: "Xác nhận đơn hàng", body: "..." });
  return order;
}
```

✅ **Compliant:**

```ts
async function checkoutOrder(input: CheckoutInput, deps: CheckoutDeps) {
  validateCheckoutInput(input);
  const order = await placeOrder(input, deps.db, deps.gateway);
  await sendOrderConfirmation(order, deps.mailer);
  return order;
}
```

**Không nhầm "dài" với "đa trách nhiệm":** một hàm dài chỉ vì lặp lại MỘT thao tác duy nhất trên
nhiều trường/nhiều item (toàn bộ thân hàm là các nhánh `if` validate độc lập, hoặc toàn bộ thân hàm
chỉ là gán field-theo-field) vẫn là MỘT trách nhiệm — dài không phải là gộp việc. Chỉ tính là vi phạm
2.2 khi các đoạn trong hàm thực sự làm những LOẠI VIỆC khác nhau (validate rồi lại gọi API rồi lại
ghi DB), không phải khi cùng một loại thao tác được lặp lại nhiều lần.

✅ **Compliant (dài nhưng vẫn một trách nhiệm — KHÔNG vi phạm 2.2):**

```ts
// Toàn bộ thân hàm chỉ làm MỘT việc: validate — dù có 20 dòng if, đây vẫn không phải đa trách nhiệm
export function validateOrderForm(form: OrderForm): string[] {
  const errors: string[] = [];
  if (!form.customerName) errors.push("customerName is required");
  if (!form.customerEmail) errors.push("customerEmail is required");
  if (!form.shippingAddress) errors.push("shippingAddress is required");
  // ...tiếp tục validate từng trường khác theo đúng MỘT khuôn mẫu if/push...
  return errors;
}

// Toàn bộ thân hàm chỉ làm MỘT việc: map field-theo-field — không có bước xử lý nào khác xen vào
export function mapOrderDtoToEntity(dto: OrderDto): OrderEntity {
  return {
    id: dto.id,
    customerId: dto.customer_id,
    customerEmail: dto.customer_email,
    // ...tiếp tục map từng trường khác theo đúng MỘT khuôn mẫu gán field...
  };
}
```

### 2.3 Không dùng `any` mà không giải thích

Không dùng `any` (kể cả ép kiểu `as any`, `(window as any)`) trừ khi có comment giải thích rõ lý do
vì sao không thể type chặt hơn.

❌ **Non-Compliant:**

```ts
let data: any;
data = JSON.parse(raw);

const variant = (config as any).variant;
```

✅ **Compliant:**

```ts
// dùng any vì third-party SDK v1 legacy chưa publish type definition, sẽ xoá khi nâng cấp lên v2
const response: any = legacySdk.call(payload);
```

## 3. Approved Exceptions & Carve-outs

- Một dòng comment hoặc string chỉ NHẮC TỚI chữ "any" bằng ngôn ngữ tự nhiên (ví dụ `// xử lý any
  lỗi có thể xảy ra`, `"any madge error"`) — đây không phải kiểu dữ liệu TypeScript, chỉ là một từ
  tiếng Anh trong câu văn, không tính là vi phạm 2.3.
- Một hàm dài (>50 dòng) nhưng chỉ làm MỘT việc duy nhất, lặp lại tuần tự (ví dụ validate nhiều
  trường liên tiếp, hoặc map DTO sang Entity trường-theo-trường) — KHÔNG tính là vi phạm 2.2, vì
  quy tắc nhắm vào việc GỘP NHIỀU TRÁCH NHIỆM không liên quan, không nhắm vào độ dài đơn thuần. Xem
  2 ví dụ ✅ Compliant cụ thể ("dài nhưng vẫn một trách nhiệm") ngay cuối mục 2.2.
- `console.log` nằm trong file test dùng đúng mục đích (ví dụ đang debug tạm một test) — vẫn nên
  tránh nhưng không thuộc "code chuẩn bị merge" theo nghĩa code path sản phẩm.

## 4. Automated Enforcement

- **LLM Policy Check** (`checkPoliciesWithLLM`) — mọi rule ở đây cần hiểu ngữ cảnh (phân biệt hàm
  đa trách nhiệm với hàm dài-nhưng-đơn-nhiệm, phân biệt `any` có/không giải thích) nên không có
  checker tất định riêng.

## 5. Remediation & Escalation Guide

- **Tự sửa:** dùng prompt gợi ý sửa lỗi kèm mỗi vi phạm; toàn bộ policy này ở mức `severity: low`
  (chỉ cảnh báo, không chặn push) — sửa trước lần merge tiếp theo, không cần leo thang khẩn cấp.
- **Nghi ngờ false positive:** dùng luồng "yêu cầu bypass" trên dashboard nếu cần merge gấp trước
  khi kịp sửa.
