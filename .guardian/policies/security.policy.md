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
tags: [security, secrets, input-validation, cryptography, sso]
---

# Security Policy

## 1. Executive Summary & Compliance Standards

Policy này bảo vệ chống lộ thông tin đăng nhập, chiếm quyền phiên đăng nhập (session hijack), và
khai thác lỗ hổng injection/redirect ở các dịch vụ xác thực/định danh (SSO, OAuth) — hậu quả trực
tiếp nếu vi phạm: kẻ tấn công đăng nhập được vào tài khoản người khác, đánh cắp dữ liệu người dùng,
hoặc chiếm quyền quản trị hệ thống mà không cần biết mật khẩu thật.

- **OWASP Top 10 (2021):** `A02:2021 – Cryptographic Failures` (secret, hash, mã hoá, mã hoá token
  khi lưu trữ), `A03:2021 – Injection` (SQL/command/XSS), `A07:2021 – Identification and
  Authentication Failures` (JWT verify-vs-decode, redirect callback, rate limit đăng nhập).
- **ISO/IEC 27001 Annex A:** `A.9 Access Control`, `A.10 Cryptography`, `A.12 Operations Security`
  (logging/rate limiting).

Chỉ đánh giá dựa trên HÀNH VI THỰC TẾ của code trong diff. Việc code/comment/tài liệu chỉ NHẮC TỚI
hoặc GIẢI THÍCH một khái niệm bảo mật (ví dụ: mô tả rule "không hardcode secret") không phải là vi
phạm — chỉ vi phạm khi code thực sự làm điều bị cấm.

## 2. Normative Directives

### 2.1 Không hardcode secret thật

Không hardcode secret thật (API key, token, mật khẩu, connection string, private key) có giá trị
trông giống thông tin đăng nhập thật vào source code — dùng biến môi trường hoặc secret manager.

❌ **Non-Compliant:**

```ts
const apiKey = "sk_live_EXAMPLE1234567890";
```

✅ **Compliant:**

```ts
const apiKey = process.env.PAYMENT_API_KEY;
```

### 2.2 Không log giá trị nhạy cảm

Không log giá trị nhạy cảm (mật khẩu, token, PII, số thẻ...) ra console hoặc file log. Xem thêm quy
tắc về đầy đủ/đúng mức của audit log tại `logging.policy.md`.

❌ **Non-Compliant:**

```ts
console.log("Login attempt", { username, password, token });
```

✅ **Compliant:**

```ts
console.log("Login attempt", { username });
```

Log một KẾT QUẢ/TRẠNG THÁI không chứa credential vẫn compliant, kể cả khi biến có tên nghe "nhạy
cảm" (`report`, `result`...) — chỉ đánh giá GIÁ TRỊ thực sự được log, không theo tên biến:

```ts
console.log("[guardian] Kiểm tra hoàn tất, verdict:", report.verdict); // report.verdict là "PASS"/"BLOCK", không phải credential
```

### 2.3 Validate/sanitize input trước khi dùng trong query/command/HTML

Input từ người dùng hoặc hệ thống bên ngoài phải được validate/sanitize trước khi dùng trong query,
command, hoặc render ra HTML (tránh SQL injection, command injection, XSS). Bao gồm cả trường hợp
gián tiếp qua biến trung gian hoặc hàm format string (`fmt.Sprintf`, template literal nối chuỗi
nhiều bước) — không chỉ nối chuỗi trực tiếp một dòng.

❌ **Non-Compliant:**

```ts
const clause = `status = '${req.query.status}'`;
const sql = `SELECT * FROM orders WHERE ${clause}`;
```

✅ **Compliant:**

```ts
const sql = "SELECT * FROM orders WHERE status = $1";
await db.query(sql, [req.query.status]);
```

### 2.4 Không tắt/bỏ qua cơ chế xác thực, phân quyền đã tồn tại

Không tắt hoặc bỏ qua cơ chế xác thực (authentication) hay phân quyền (authorization) đã tồn tại
trong code chỉ để "tiện test" hay "sửa nhanh" — ví dụ thêm điều kiện `if (true) return next();`
phía trước, hoặc xoá hẳn lời gọi middleware.

Riêng trường hợp cơ chế đó bị **comment-out** (để lại dưới dạng comment thay vì xoá) là một policy
RIÊNG — xem `disabled-security-control.policy.md` — vì việc grounding bằng chứng cho trường hợp đó
cần đọc cả dòng comment (mặc định Guardian loại comment khỏi bằng chứng để tránh nhầm lẫn, xem mục
4), nên được tách thành policy có bật rõ ràng `allowCommentEvidence: true`.

❌ **Non-Compliant:**

```ts
export function adminOnly(req: Request, res: Response, next: NextFunction) {
  if (true) return next(); // tạm bypass, TODO: bật lại sau
  if (req.user?.role !== "admin") return res.status(403).send("Forbidden");
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

**Không áp dụng cho code vốn dĩ không expose network service** — một hàm CLI/script chạy local (đọc
file trên máy, xử lý dữ liệu offline), không nhận request qua network, không có khái niệm "người
dùng khác" nào để phân biệt quyền — hoàn toàn KHÔNG cần xác thực, và việc KHÔNG có auth check ở đây
không phải là "bỏ qua cơ chế đã tồn tại" (2.4 chỉ nhắm vào việc TẮT một cơ chế đang có, không nhắm
vào việc chưa từng cần cơ chế đó). Nhận diện qua chữ ký hàm: không có tham số kiểu `Request`/`res`,
không được đăng ký qua router (`router.get(...)`, `app.post(...)`).

✅ **Compliant (CLI/script local — không vi phạm 2.4, vì vốn dĩ không cần xác thực):**

```ts
export function readLocalConfig(configPath: string): AppConfig {
  const raw = fs.readFileSync(configPath, "utf-8");
  return JSON.parse(raw) as AppConfig;
}
```

**Phân biệt quan trọng — hash để LƯU TRỮ password vs. digest để SO SÁNH constant-time:** yêu cầu
dùng thuật toán chậm có chi phí tính toán cao (bcrypt/scrypt/argon2) chỉ áp dụng khi hash được
**lưu trữ lâu dài** để sau này so khớp với password người dùng nhập vào (mục đích: làm brute-force
ngoại tuyến tốn kém). Khi 2 giá trị ĐÃ CÓ SẴN trong bộ nhớ tại cùng thời điểm (không phải so với 1
hash lưu trữ) chỉ cần so sánh **constant-time** để tránh timing attack — `crypto.createHash('sha256')`
+ `crypto.timingSafeEqual()` là pattern chuẩn được Node.js khuyến nghị cho đúng trường hợp này,
KHÔNG cần bcrypt (bcrypt chậm có chủ đích, dùng sai chỗ chỉ làm chậm request mà không thêm bảo mật
thật). Ví dụ KHÔNG vi phạm:

```ts
// So sánh 2 giá trị đã có sẵn (không phải hash lưu trữ chờ so khớp sau) — bcrypt không áp dụng ở đây.
function checkPassword(password: string): boolean {
  const expected = process.env.SHARED_DEMO_SECRET;
  if (!expected) return false;
  const digest = (v: string) => crypto.createHash("sha256").update(v).digest();
  return crypto.timingSafeEqual(digest(password), digest(expected)); // chống timing attack, không phải KDF
}
```

### 2.5 Không hạ cấp thuật toán mã hoá/hash hoặc tắt xác thực TLS

Không tự ý hạ cấp thuật toán mã hoá/hash (ví dụ dùng MD5/SHA1 cho mật khẩu) hoặc tắt xác thực
TLS/certificate.

Mức TLS tối thiểu chấp nhận được là **TLS 1.2** (`tls.VersionTLS12`, `MinVersion: "TLSv1.2"` hoặc
cao hơn) — đặt `MinVersion` ở TLS 1.2 hoặc TLS 1.3 KHÔNG tính là hạ cấp. Chỉ vi phạm khi hạ xuống
dưới TLS 1.2 (SSLv3, TLS 1.0/1.1) hoặc tắt hẳn xác thực certificate
(`InsecureSkipVerify: true` ở Go, `rejectUnauthorized: false` ở Node, `verify=False` ở Python).

❌ **Non-Compliant:**

```ts
crypto.createHash("md5").update(password).digest("hex");
new https.Agent({ rejectUnauthorized: false });
```

✅ **Compliant:**

```ts
await bcrypt.hash(password, 12);
new https.Agent({ rejectUnauthorized: true });
```

```go
server := &http.Server{TLSConfig: &tls.Config{MinVersion: tls.VersionTLS12}}
```

### 2.6 Redirect/callback URL phải validate bằng hostname, không bằng substring

Redirect/callback URL (SSO login, OAuth callback, "quay lại trang trước") phải validate bằng cách
parse hostname qua `new URL(url).hostname` rồi so khớp CHÍNH XÁC với allowlist domain — KHÔNG được
validate bằng `string.includes()`, `startsWith()`, hoặc regex lỏng lẻo trên toàn bộ URL, vì các
cách này bị bypass dễ dàng bằng domain giả dạng (`https://evil.com/?next=v-id.vn`) hoặc subdomain
giả (`https://v-id.vn.evil.com`). Áp dụng y hệt cho redirect PHÍA CLIENT
(`window.location.href = url`, React Router `navigate(url)`) — không chỉ redirect phía server
(`res.redirect`); một open redirect ở client vẫn đưa nạn nhân tới domain giả mạo y hệt.

❌ **Non-Compliant:**

```ts
if (redirectUrl.includes("v-id.vn")) res.redirect(redirectUrl);
```

```tsx
// Redirect phía client trong component React — cùng lỗi, khác chỗ thực thi
if (returnUrl.includes("v-id.vn")) {
  window.location.href = returnUrl;
}
```

✅ **Compliant:**

```ts
if (new URL(redirectUrl).hostname === "v-id.vn") res.redirect(redirectUrl);
```

```tsx
if (new URL(returnUrl, window.location.origin).hostname === "v-id.vn") {
  window.location.href = returnUrl;
}
```

### 2.7 Xác thực JWT/session token bắt buộc verify chữ ký, không chỉ decode

Xác thực JWT/session token dùng để định danh người dùng bắt buộc phải xác thực chữ ký (ví dụ
`jwt.verify(token, key, { algorithms: [...] })`) — KHÔNG được chỉ `jwt.decode()` (giải mã payload,
không kiểm tra chữ ký) rồi tự kiểm tra thủ công các trường như `iss`/`exp`/`sub` phía sau, vì payload
của `decode()` có thể đã bị giả mạo hoàn toàn trước khi tới bước kiểm tra thủ công đó. Áp dụng cho
mọi ngôn ngữ (`jsonwebtoken` ở Node, `ParseUnverified` ở Go, `jwt.decode()` không kèm `verify` ở
Python).

❌ **Non-Compliant:**

```ts
const claims = jwt.decode(token);
if (claims.exp < Date.now() / 1000) throw new Error("expired");
```

✅ **Compliant:**

```ts
const claims = jwt.verify(token, publicKey, { algorithms: ["RS256"] });
```

Go không có một hàm `verify()` duy nhất như Node — `ParseWithClaims` kèm keyfunc trả về public key,
sau đó kiểm tra `token.Valid`, VẪN là xác thực chữ ký thật (thư viện tự verify bên trong khi parse),
KHÔNG phải chỉ decode — chỉ vi phạm khi dùng `ParseUnverified` (bỏ qua xác thực có chủ đích):

```go
token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(t *jwt.Token) (interface{}, error) {
  return publicKey, nil
})
if err != nil || !token.Valid {
  return nil, errors.New("invalid token")
}
```

### 2.8 Rate limit / chống brute-force cho endpoint xác thực

Endpoint xác thực (login, xác minh OTP, refresh token, quên mật khẩu) phải có cơ chế giới hạn số
lần thử (rate limit, lockout tạm thời, CAPTCHA...) để chống brute-force — không được để không giới
hạn số lần gọi.

### 2.9 Token/session persist xuống DB hoặc cache phải mã hoá/hash trước khi lưu

Khi một session token, refresh token, hoặc API key cần được lưu trữ lâu dài (DB, Redis, file) để
tra cứu/thu hồi sau này, phải lưu dạng đã hash (ví dụ SHA-256 của token làm khoá tra cứu) hoặc mã
hoá — KHÔNG được lưu nguyên văn giá trị token dạng plaintext, vì lộ database đồng nghĩa lộ toàn bộ
phiên đăng nhập đang hoạt động của mọi người dùng.

❌ **Non-Compliant:**

```ts
await db.sessions.insert({ userId, refreshToken: rawRefreshToken });
```

✅ **Compliant:**

```ts
const tokenHash = crypto.createHash("sha256").update(rawRefreshToken).digest("hex");
await db.sessions.insert({ userId, refreshTokenHash: tokenHash });
```

## 3. Approved Exceptions & Carve-outs

- Hằng số kỹ thuật không phải credential (git SHA cố định, tên model, tên field/property, magic
  string, enum value, hoặc placeholder ví dụ dạng `sk-ant-...`/`sk_test_...`/`AKIAIOSFODNN7EXAMPLE`
  trong tài liệu/comment/`.env.example`/`test/fixtures/**`) — KHÔNG tính là vi phạm 2.1. Nhận diện
  "đây là test fixture" qua ĐƯỜNG DẪN FILE có chứa đoạn `test/fixtures/` (hoặc tương đương) Ở BẤT KỲ
  ĐÂU trong path, không chỉ khi đó là 2 thư mục gốc đầu tiên — ví dụ
  `eval-samples/xyz/test/fixtures/stripeFixtures.ts` VẪN tính là test fixture. Áp dụng kể cả khi giá
  trị literal trông giống hệt định dạng key thật (đủ độ dài, đủ ký tự ngẫu nhiên) — một test key CHÍNH
  THỨC do nhà cung cấp publish công khai cho mục đích test (ví dụ Stripe test key) không có dấu hiệu
  "placeholder" rõ ràng như chữ `EXAMPLE` nhưng vẫn không phải secret thật khi nằm trong file test
  fixture. Ví dụ KHÔNG vi phạm:
  ```ts
  // File: eval-samples/xyz/test/fixtures/stripeFixtures.ts
  export const FAKE_STRIPE_TEST_KEY = "sk_test_EXAMPLE1234567890"; // Stripe test key công khai, không phải secret thật
  export function mockStripeCharge() {
    return { status: "succeeded", key: FAKE_STRIPE_TEST_KEY };
  }
  ```
- Toàn bộ nội dung của đúng 2 file `src/server/routes/playgroundScenarios.ts` và
  `web/src/lib/playgroundScenarios.ts` là DỮ LIỆU MẪU tĩnh cho tính năng Policy Playground — string
  cố tình trông giống lỗ hổng thật (regex `.includes()` cho redirect, `ParseUnverified` cho JWT...)
  nhưng KHÔNG BAO GIỜ được thực thi, chỉ dùng để tự dựng diff giả lập đưa lại vào chính check engine
  (server) hoặc hiển thị trong code panel (web). Nhận diện qua ĐƯỜNG DẪN FILE chính xác — giống hệt
  nguyên lý `test/fixtures/**` ở trên nhưng áp dụng cho đúng 2 path này (không nằm trong `test/`) —
  không cần suy luận ngữ nghĩa "đây có phải data hay code thật" mỗi lần kiểm tra. Logic THẬT dùng
  data này (`src/server/routes/playground.ts`) nằm ở file KHÁC, đã có `authzGate` riêng, không bị
  carve-out này che. Ví dụ KHÔNG vi phạm:
  ```ts
  // File: src/server/routes/playgroundScenarios.ts — toàn bộ export ở file này là dữ liệu mẫu.
  export const PLAYGROUND_SCENARIOS = {
    jwt: { file: "sso/session.go", lines: ["token, _, err := parser.ParseUnverified(tokenString, &SessionClaims{})"] },
  };
  ```
- Log thông báo lỗi hoặc kết quả kiểm tra không chứa credential thật — KHÔNG tính là vi phạm 2.2.
- Quy tắc 2.3 chỉ áp dụng khi code thực sự nhận input từ nguồn không tin cậy (network request, form,
  file upload...) — không áp dụng cho hằng số nội bộ.
- Quy tắc 2.4 KHÔNG áp dụng cho code vốn dĩ không cần xác thực (ví dụ: CLI tool chạy local, không
  expose network service).
- Một chuỗi string trong code là văn bản giải thích/thông báo lỗi bằng tiếng Việt hoặc tiếng Anh
  (ví dụ nội dung gán cho biến `why`, `errorWhat`, `promptToFix` trong chính source code của
  Guardian, hoặc bất kỳ message hiển thị cho người dùng nào, hoặc comment cảnh báo dev tránh làm
  điều gì đó) — đây là dữ liệu tĩnh mô tả một khái niệm, không phải là báo cáo về trạng thái thật
  của codebase. Không được coi nội dung của một string/comment như vậy là bằng chứng cho một vi
  phạm khác đang tồn tại.
- Một hàm tên gọi có vẻ không an toàn (ví dụ giữ tên legacy `insecureConnection`) nhưng nội dung
  thực tế đã thực thi đúng, an toàn (TLS bật, `rejectUnauthorized: true`) — đánh giá theo HÀNH VI
  thật của code, không theo tên hàm. Một log message chứa chữ "TLS"/"secure" mô tả TRẠNG THÁI hiện
  tại (ví dụ `log.Println("TLS verification: enabled")`) không phải bằng chứng cho việc TLS bị tắt —
  chỉ vi phạm khi chính CODE (không phải log message) thực sự tắt xác thực certificate.
- `jwt.decode()` (không verify) chấp nhận được khi dùng cho mục đích KHÔNG liên quan xác thực danh
  tính (ví dụ chỉ đọc `exp` để hiển thị đếm ngược hết hạn phiên trên UI) — miễn là kết quả không
  được dùng để cấp quyền truy cập. Ví dụ KHÔNG vi phạm:
  ```ts
  function decodeTokenUnsafe(token: string) { return jwt.decode(token); } // tên đã nói rõ không an toàn
  function renderSessionExpiryBadge(token: string) {
    const { exp } = decodeTokenUnsafe(token); // chỉ dùng để hiển thị UI, không cấp quyền truy cập
    return `Hết hạn lúc ${new Date(exp * 1000).toLocaleTimeString()}`;
  }
  ```
- Dockerfile khai báo `ARG <TÊN_BIẾN>` (ví dụ `ARG API_KEY`) mà KHÔNG có giá trị mặc định
  (`=giá_trị`) không tính là hardcode secret (2.1) — giá trị thật được truyền vào lúc build qua
  `--build-arg`, không nằm trong file. Chỉ vi phạm nếu `ARG` có giá trị mặc định trông giống secret
  thật, hoặc dùng `ENV`/`RUN` gán thẳng giá trị secret thật vào image.
- Log một kết quả/trạng thái không chứa credential (ví dụ `console.log("[guardian] Kiểm tra hoàn
  tất, verdict:", report.verdict)`) không tính là vi phạm 2.2, kể cả khi biến log ra có tên nghe
  "nhạy cảm" (`report`, `result`...) — chỉ đánh giá GIÁ TRỊ thực sự được log, không đánh giá theo
  tên biến.
- Một hằng số dùng chung cho TOÀN BỘ tài khoản demo (không phải secret riêng của 1 user), đã được
  công khai tài liệu hoá trong chính sản phẩm (ví dụ hiển thị nguyên văn ở trang NoteBook/UI cho bất
  kỳ ai xem), và chỉ dùng để tự động điền vào form đăng nhập demo (không tự cấp quyền truy cập, xác
  thực thật vẫn luôn đi qua server) — KHÔNG tính là vi phạm 2.1, dù regex/LLM có thể nhận diện đúng
  đây là 1 giá trị dạng "password/token". Phân biệt với secret thật: giá trị demo này được THIẾT KẾ
  để công khai, đổi được qua biến môi trường phía server, và không bảo vệ dữ liệu/tài nguyên thật.
  Ví dụ KHÔNG vi phạm:
  ```ts
  // Giống hệt giá trị hiển thị công khai ở NoteBook "Tài khoản Demo" — không phải secret thật.
  const DEMO_LOGIN_VALUE = 'demo1234';
  function handleSelectDemoUser(email: string) {
    setPassword(DEMO_LOGIN_VALUE); // chỉ autofill form, server vẫn tự xác thực qua GUARDIAN_DEMO_PASSWORD
  }
  ```

## 4. Automated Enforcement

- Secret hardcode (2.1): **Deterministic** — `secretScan.ts` (regex, luôn chạy kể cả không có LLM
  key).
- Các rule còn lại (2.2 → 2.9): **LLM Policy Check** (`checkPoliciesWithLLM`) — cần hiểu ngữ cảnh
  (ví dụ phân biệt input tin cậy/không tin cậy, phân biệt decode/verify), có grounding
  (`evidenceSnippet` phải khớp diff thật, chỉ tính dòng CODE thật — không tính dòng comment, xem
  `disabled-security-control.policy.md` cho trường hợp ngược lại) + judge pass xác minh lại trước
  khi tính là vi phạm.

## 5. Remediation & Escalation Guide

- **Tự sửa:** dùng prompt gợi ý sửa lỗi kèm mỗi vi phạm (copy-paste vào Copilot/ChatGPT/Claude cá
  nhân của dev).
- **Secret đã lộ thật (không phải placeholder):** rotate/revoke secret đó ngay lập tức tại nhà cung
  cấp — sửa code chưa đủ, vì secret đã nằm trong lịch sử git.
- **Nghi ngờ false positive:** dùng luồng "yêu cầu bypass" trên dashboard (`/api/bypass-requests`,
  cần Approver duyệt) — không tự ý sửa policy để né qua.
- **Leo thang:** vi phạm `critical` (toàn bộ policy này ở mức `critical`) không tự sửa được trong
  24h — báo Security Lead của dự án.
