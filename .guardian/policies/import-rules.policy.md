---
category: Import Rules
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
tags: [imports, dependency-hygiene]
---

# Import Rules

## 1. Executive Summary & Compliance Standards

Policy này bảo vệ tính nhất quán của các thao tác mã hoá/xác thực nhạy cảm và ngăn code test lẫn
vào production — import rải rác trực tiếp thư viện mã hoá/JWT cấp thấp ở nhiều nơi khiến mỗi chỗ có
thể tự chọn cấu hình khác nhau (thuật toán, key), tạo lỗ hổng không nhất quán khó phát hiện. Quy tắc
layer/circular-dependency dựa trên cấu trúc thư mục thật của dự án (kiểm tra tự động qua madge) nằm
ở `architecture.policy.md` — policy này tập trung vào việc CHỌN import gì, không phải import từ thư
mục nào.

- **OWASP Top 10 (2021):** liên quan `A02:2021 – Cryptographic Failures` (cấu hình mã hoá không
  nhất quán do import rải rác) và `A06:2021 – Vulnerable and Outdated Components` (SDK bên thứ ba
  không được kiểm soát tập trung).
- **ISO/IEC 27001 Annex A:** `A.14 System Acquisition, Development and Maintenance`.

## 2. Normative Directives

### 2.1 Không import trực tiếp thư viện mã hoá/JWT cấp thấp rải rác nhiều nơi

Tập trung việc xác thực/ký token qua một module wrapper duy nhất đã được review, để đảm bảo mọi nơi
xác thực token dùng đúng một cấu hình nhất quán (algorithm, key, audience/issuer check).

❌ **Non-Compliant:**

```ts
import jwt from "jsonwebtoken";

export function verifyPartnerWebhookToken(token: string) {
  return jwt.verify(token, process.env.PARTNER_WEBHOOK_SECRET as string, { algorithms: ["HS256"] });
}
```

✅ **Compliant:**

```ts
import { verifySessionToken } from "../auth/tokenVerifier";

export function verifyPartnerWebhookToken(token: string) {
  return verifySessionToken(token);
}
```

### 2.2 Không import module test/mock/fixture vào production path

❌ **Non-Compliant:**

```ts
import { fakePaymentGateway } from "../test/fixtures/paymentGateway.mock";

export function checkoutRoute(req: Request, res: Response) {
  return fakePaymentGateway.charge(req.body.amount);
}
```

✅ **Compliant:**

```ts
import { paymentGateway } from "../payments/paymentGateway";

export function checkoutRoute(req: Request, res: Response) {
  return paymentGateway.charge(req.body.amount);
}
```

### 2.3 Không import thẳng SDK định danh/thanh toán bên thứ ba rải rác trong code nghiệp vụ

Nên bọc qua một lớp adapter/client riêng của dự án để dễ audit, dễ thay thế provider, và kiểm soát
version tập trung tại một chỗ.

❌ **Non-Compliant:**

```ts
import { OAuthClient } from "some-sso-provider-sdk";

export async function handleSsoCallback(code: string) {
  const client = new OAuthClient({ clientId: process.env.SSO_CLIENT_ID });
  const tokenSet = await client.exchangeCode(code);
  await db.sessions.insert({ accessToken: tokenSet.access_token });
  return tokenSet;
}
```

✅ **Compliant:**

```ts
import { SsoAdapter } from "../auth/ssoAdapter";

export async function handleSsoCallback(code: string, sso: SsoAdapter) {
  const tokenSet = await sso.exchangeCode(code);
  await db.sessions.insert({ accessToken: tokenSet.access_token });
  return tokenSet;
}
```

## 3. Approved Exceptions & Carve-outs

**Lưu ý quan trọng khi áp dụng 2.1/2.3:** Guardian kiểm tra từng file MỘT, không có toàn cảnh của cả
dự án — không thể xác nhận một module có phải là "nơi DUY NHẤT được chỉ định trong toàn dự án" hay
không, vì điều đó đòi hỏi biết mọi file khác. Vì vậy, đánh giá 2.1/2.3 dựa trên BẰNG CHỨNG QUAN SÁT
ĐƯỢC trong chính file đang xét, không phải một khẳng định không thể kiểm chứng: nếu file có tên/
đường dẫn thể hiện rõ vai trò wrapper/adapter (chứa `Adapter`, `Verifier`, `Client`, hoặc nằm trong
thư mục `auth/`, `client/`) VÀ import thư viện cấp thấp/SDK CHỈ để bọc lại thành một API nội bộ đơn
giản (không trộn lẫn logic nghiệp vụ khác như ghi DB, gửi email ngay trong cùng hàm) — coi đó là
compliant mặc định, không tính là vi phạm 2.1/2.3.

- Import thư viện mã hoá/JWT cấp thấp trong một file có tên/vai trò rõ ràng là wrapper (xem lưu ý
  trên) — không tính là vi phạm 2.1. Điều kiện là "tên/vai trò wrapper" HOẶC "nằm trong thư mục
  auth/client" — MỘT TRONG HAI đã đủ, không bắt buộc phải thoả cả hai cùng lúc. Ví dụ KHÔNG vi phạm
  (tên file hoàn toàn chung chung, không chứa "Verifier"/"Adapter", nhưng nằm trong `auth/` và chỉ
  bọc lại `jwt.sign` — vẫn compliant vì đã thoả điều kiện thư mục):
  ```ts
  // auth/session.ts — tên file chung chung, nhưng nằm trong auth/ và chỉ bọc lại jsonwebtoken
  import jwt from "jsonwebtoken";
  export function issueSessionToken(payload: object) {
    return jwt.sign(payload, process.env.SESSION_SECRET as string, { expiresIn: "1h" });
  }
  ```
  Ví dụ khác (tên file có "Verifier" + nằm trong auth/ — thoả cả hai, càng chắc chắn compliant):
  ```ts
  // auth/tokenVerifier.ts — tên file (chứa "Verifier") + nằm trong auth/ + duy nhất bọc lại jwt.verify
  import jwt from "jsonwebtoken";
  export function verifySessionToken(token: string) {
    return jwt.verify(token, process.env.SESSION_PUBLIC_KEY as string, { algorithms: ["RS256"] });
  }
  ```
- Đường dẫn/tên chứa chữ "mock" nhưng là một tính năng nghiệp vụ thật (ví dụ tính năng "thi thử" —
  `features/mockExam/`), không phải test double — không tính là vi phạm 2.2. Chỉ vi phạm khi import
  thực sự trỏ tới thư mục/file test (`test/`, `tests/`, `__mocks__/`, `*.mock.ts`, `*.fixture.ts`)
  dùng để giả lập cho unit test.
- Import SDK bên thứ ba trong một file có tên/vai trò rõ ràng là adapter, HOẶC chỉ đơn giản nằm
  trong thư mục `client/`/`adapter/` (không bắt buộc cả tên file lẫn thư mục cùng lúc), ví dụ SDK
  thanh toán (không chỉ SSO) bọc trong `client/`:
  ```ts
  // client/stripeClient.ts — nằm trong client/, chỉ bọc lại Stripe SDK thành API nội bộ
  import Stripe from "stripe";
  export class StripeClient {
    private stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
    async charge(amount: number, customerId: string) {
      return this.stripe.charges.create({ amount, customer: customerId });
    }
  }
  ```
  ```ts
  // auth/ssoAdapter.ts — tên file + duy nhất bọc lại SDK, không trộn business logic khác
  import { OAuthClient } from "some-sso-provider-sdk";
  export class SsoAdapter {
    private client = new OAuthClient({ clientId: process.env.SSO_CLIENT_ID });
    async exchangeCode(code: string) { return this.client.exchangeCode(code); }
  }
  ```
  — không tính là vi phạm 2.3.

## 4. Automated Enforcement

- **LLM Policy Check** (`checkPoliciesWithLLM`) — cần hiểu ngữ cảnh (tên/vai trò file có thể hiện rõ
  đây là wrapper/adapter hay không — dựa trên bằng chứng quan sát được trong 1 file, xem mục 3 — và
  "mock" trong path là tính năng thật hay test double).
- Import ngược layer / circular dependency dựa trên cấu trúc thư mục: xem **Deterministic check**
  tại `architecture.policy.md` (`architectureCheck.ts`, `architectureRulesCheck.ts`).

## 5. Remediation & Escalation Guide

- **Tự sửa:** chuyển import trực tiếp sang gọi qua wrapper/adapter đã có (hoặc tạo mới nếu dự án
  chưa có); dùng prompt gợi ý sửa lỗi kèm mỗi vi phạm.
- **Nghi ngờ false positive:** dùng luồng "yêu cầu bypass" trên dashboard.
