---
category: Naming Convention
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
tags: [naming, readability, security]
---

# Naming Convention

## 1. Executive Summary & Compliance Standards

Policy này bảo vệ khả năng đọc hiểu đúng ý nghĩa/mức độ an toàn của code chỉ qua tên định danh —
tên gây hiểu lầm về hành vi bảo mật thực sự (ví dụ một hàm tên `verifyToken` nhưng thực chất không
verify) là một dạng lỗi tiềm ẩn nghiêm trọng: reviewer/dev khác tin vào tên hàm thay vì đọc kỹ thân
hàm, dẫn tới dùng sai chỗ cần xác thực thật.

- **OWASP Top 10 (2021):** liên quan `A07:2021 – Identification and Authentication Failures` khi
  tên hàm gây hiểu lầm về việc xác thực token đã thực sự xảy ra hay chưa.
- **ISO/IEC 27001 Annex A:** `A.14 System Acquisition, Development and Maintenance`.

## 2. Normative Directives

### 2.1 Quy ước case chuẩn

Đặt tên biến, hàm theo camelCase; tên class/type/interface theo PascalCase; hằng số toàn cục theo
UPPER_SNAKE_CASE (Python/Go dùng đúng convention chuẩn của ngôn ngữ đó thay vì áp camelCase máy móc
— ví dụ Go export dùng PascalCase, Python biến/hàm dùng snake_case).

❌ **Non-Compliant:**

```ts
export function get_user_data(userId: string) {
  return db.users.findById(userId);
}
```

✅ **Compliant:**

```ts
export function getUserData(userId: string) {
  return db.users.findById(userId);
}
```

### 2.2 Không dùng tên biến mập mờ cho các loại token khác nhau

Không dùng tên biến mập mờ dùng chung cho nhiều loại token khác nhau (access token, id token,
refresh token, session cookie) — dễ gây nhầm lẫn dùng sai loại token ở sai chỗ.

❌ **Non-Compliant:**

Lỗi này thường KHÔNG nằm gọn trong 1 dòng — phải lần theo biến `token` được gán lại rồi truyền qua
lời gọi hàm khác mới thấy rõ nó thực chất là `idToken` bị dùng nhầm chỗ cần `accessToken`:

```ts
async function fetchUserProfile(token: string, apiClient: ApiClient) {
  // `token` ở đây thực chất cần là accessToken để gọi API /profile
  return apiClient.get("/profile", { headers: { Authorization: `Bearer ${token}` } });
}

function loginWithSso(idToken: string, accessToken: string, apiClient: ApiClient) {
  const token = idToken; // gán lại từ idToken — mất luôn thông tin loại token ban đầu
  return fetchUserProfile(token, apiClient); // fetchUserProfile cần accessToken, không phải idToken
}
```

✅ **Compliant:**

```ts
async function fetchUserProfile(accessToken: string, apiClient: ApiClient) {
  return apiClient.get("/profile", { headers: { Authorization: `Bearer ${accessToken}` } });
}

function loginWithSso(idToken: string, accessToken: string, apiClient: ApiClient) {
  return fetchUserProfile(accessToken, apiClient);
}
```

Áp dụng y hệt ở mọi ngôn ngữ — ví dụ Go, `idToken` bị gán lại thành tên chung `token` rồi truyền
vào hàm cần `refreshToken`:

```go
func RefreshAccessToken(idToken string, refreshToken string) (string, error) {
  token := idToken // gán lại, mất thông tin loại token ban đầu
  return callTokenExchangeAPI(token) // callTokenExchangeAPI cần refreshToken, không phải idToken
}
```

### 2.3 Tên hàm phải phản ánh đúng hành vi bảo mật thực sự

Phải phân biệt rõ hàm chỉ "đọc/giải mã, không xác thực" (ví dụ `decodeToken`, `parseJwt`,
`decodeTokenUnsafe`) với hàm "xác thực chữ ký thật sự" (ví dụ `verifyToken`, `verifySignedSession`).
Không được đặt tên như `verifyToken` hay `validateSession` cho một hàm mà bên trong thực chất chỉ
gọi `jwt.decode()`/tương đương.

❌ **Non-Compliant:**

```ts
function verifyToken(token: string) {
  return jwt.decode(token);
}
```

✅ **Compliant:**

```ts
function decodeTokenUnsafe(token: string) {
  return jwt.decode(token);
}
```

Một hàm tên `VerifyXxx` mà bên trong THẬT SỰ xác thực chữ ký (không chỉ parse) là compliant, kể cả
khi cú pháp thư viện không giống `jwt.verify()` một-hàm-là-xong như Node — ví dụ Go dùng
`ParseWithClaims` kèm keyfunc trả về public key rồi kiểm tra `token.Valid` VẪN là xác thực chữ ký
thật, không phải chỉ decode:

```go
func VerifySessionToken(tokenString string, publicKey *rsa.PublicKey) (*Claims, error) {
  token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(t *jwt.Token) (interface{}, error) {
    return publicKey, nil // cung cấp key để thư viện tự xác thực chữ ký bên trong ParseWithClaims
  })
  if err != nil || !token.Valid {
    return nil, errors.New("invalid token")
  }
  return token.Claims.(*Claims), nil
}
```

### 2.4 Không viết tắt khó hiểu cho trường dữ liệu nhạy cảm

Không dùng tên viết tắt khó hiểu cho trường dữ liệu NHẠY CẢM trong code mới (ví dụ `pwd`, `ssn`,
`tok`, `sec`) — ưu tiên tên đầy đủ, rõ nghĩa (`password`, `socialSecurityNumber`, `token`,
`secretKey`) để review/audit dễ nhận diện đúng loại dữ liệu đang xử lý. Rule này CHỈ nhắm vào viết
tắt của DỮ LIỆU NHẠY CẢM — không áp dụng cho các viết tắt kỹ thuật phổ biến, chuẩn ngành, không giữ
dữ liệu nhạy cảm (`req`, `res`, `db`, `ctx`, `err`, `id`, `cfg`...). Ví dụ KHÔNG vi phạm:
```ts
function getUserById(req: Request, res: Response, db: Database) {
  return res.json(db.users.findById(req.params.id));
}
```

❌ **Non-Compliant:**

```ts
function storeApiCredential(userId: string, tok: string, store: CredentialStore) {
  store.save(userId, tok);
}
```

✅ **Compliant:**

```ts
function storeApiCredential(userId: string, token: string, store: CredentialStore) {
  store.save(userId, token);
}
```

## 3. Approved Exceptions & Carve-outs

- Trong một hàm/scope nhỏ chỉ tồn tại DUY NHẤT một loại token (không có nguy cơ nhầm giữa nhiều
  loại), tên biến ngắn gọn `token` chấp nhận được — quy tắc 2.2 chỉ nhắm vào tình huống thực sự có
  nhiều loại token cùng tồn tại và dễ dùng nhầm. Ví dụ KHÔNG vi phạm — cả hàm chỉ xử lý một loại
  token duy nhất, không có token thứ hai nào trong cùng scope để nhầm lẫn:
  ```ts
  function useRefreshableToken(refreshEndpoint: string) {
    const [token, setToken] = useState<string | null>(null);
    // ...chỉ 1 loại token trong toàn bộ hook, không có idToken/accessToken khác để nhầm...
    return token;
  }
  ```
- Tên viết tắt (`pwd`, `tok`...) xuất hiện như một phần của URL path/route string (ví dụ
  `"/users/:id/pwd-reset-status"`), không phải tên biến/tham số giữ giá trị thật — không tính là vi
  phạm 2.4, vì đây là định danh endpoint, không phải biến chứa dữ liệu. Ví dụ KHÔNG vi phạm:
  ```ts
  router.get("/users/:id/pwd-reset-status", getPasswordResetStatus); // "pwd" là 1 phần của URL, không phải biến
  ```
- Một hàm tên trung thực đúng bản chất (ví dụ `decodeTokenUnsafe`) được dùng cho mục đích KHÔNG liên
  quan xác thực (hiển thị UI, debug) — hoàn toàn hợp lệ, đây chính là cách đặt tên ĐÚNG theo 2.3.

## 4. Automated Enforcement

- **LLM Policy Check** (`checkPoliciesWithLLM`) — đánh giá tên có phản ánh đúng hành vi thật của
  thân hàm hay không đòi hỏi đọc hiểu logic, không thể kiểm tra bằng regex/AST match đơn thuần.

## 5. Remediation & Escalation Guide

- **Tự sửa:** đổi tên biến/hàm cho khớp đúng hành vi thật; `severity: low`, không chặn push, sửa
  trước lần merge tiếp theo.
- **Trường hợp 2.3 (tên gây hiểu lầm về bảo mật):** ưu tiên sửa sớm dù severity thấp — đây là loại
  lỗi dễ dẫn tới bug bảo mật thật ở nơi khác gọi nhầm hàm.
