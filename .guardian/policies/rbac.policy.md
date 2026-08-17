---
category: Authorization (RBAC)
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
severity: high
tags: [authz, rbac, permission]
---

# Authorization (RBAC)

## 1. Executive Summary & Compliance Standards

Policy này bảo vệ chống leo thang đặc quyền (privilege escalation) và truy cập trái phép dữ liệu
của người dùng/team khác — hậu quả nếu vi phạm: một tài khoản thường có thể tự cấp cho mình quyền
quản trị, hoặc xem/sửa dữ liệu của team không thuộc về mình, chỉ bằng cách gửi request với giá trị
tự chọn (header, query param, hoặc token chưa xác thực lại).

- **OWASP Top 10 (2021):** `A01:2021 – Broken Access Control`.
- **ISO/IEC 27001 Annex A:** `A.9 Access Control` (đặc biệt A.9.2 quản lý quyền truy cập,
  A.9.4 kiểm soát truy cập hệ thống/ứng dụng).

`severity: high` (không phải `critical`) có chủ đích: vẫn chặn push, nhưng dành `critical` cho các
lớp vi phạm chắc chắn tuyệt đối không cần suy luận thêm (secret hardcode thật, xác thực bị tắt hẳn
hoàn toàn) — phân quyền bằng logic tự chế vẫn luôn nghiêm trọng nhưng việc nhận diện "đây có đúng là
điều kiện tự chế thay vì middleware hợp lệ hay không" đòi hỏi suy luận ngữ cảnh nhiều hơn, nên xếp
`high` để không bị yêu cầu double-confirm quá khắt khe làm sót vi phạm thật (xem
`security.policy.md` mục Normative Directives để biết ranh giới critical/high cụ thể).

Chỉ đánh giá dựa trên HÀNH VI THỰC TẾ của code trong diff — một route/handler xử lý dữ liệu công
khai, không nhạy cảm (ví dụ health-check, danh sách sản phẩm public) không bắt buộc phải qua lớp
phân quyền. Chỉ áp dụng các quy tắc dưới đây cho hành động/dữ liệu thực sự nhạy cảm (dữ liệu của
người dùng khác, hành động quản trị, thay đổi trạng thái hệ thống).

## 2. Normative Directives

### 2.1 Không tự viết điều kiện phân quyền rời rạc — phải qua lớp kiểm tra tập trung

Mọi route/handler xử lý dữ liệu hoặc hành động nhạy cảm phải đi qua lớp kiểm tra phân quyền tập
trung của dự án (middleware/authz gate đã có sẵn) — không tự viết điều kiện phân quyền rời rạc,
ngay trong handler, dựa trên giá trị tự đọc từ request hoặc so sánh cứng (hardcode) role/email.

❌ **Non-Compliant:**

```ts
if (req.user.role === "admin") {
  await userService.deleteUser(req.params.userId);
}
```

```ts
if (req.headers["x-admin-secret"] === "letmein-2024") {
  await userService.deleteUser(req.params.userId);
}
```

Áp dụng y hệt ở mọi ngôn ngữ, không chỉ TypeScript/Express — ví dụ Python/Flask:

```python
@app.route("/admin/users/<user_id>", methods=["DELETE"])
def delete_user(user_id):
    if request.headers.get("X-Admin-Secret") == "letmein-2024":
        user_service.delete_user(user_id)
        return "", 204
    return "Forbidden", 403
```

✅ **Compliant:**

```ts
router.delete(
  "/users/:userId",
  requireRole("admin"), // middleware phân quyền tập trung của dự án
  async (req, res) => {
    await userService.deleteUser(req.params.userId);
  }
);
```

### 2.2 Không tin role/permission do client tự gửi lên

Không tin dữ liệu role/permission/teamId/userId do client tự gửi lên (header, query string, body)
để quyết định quyền truy cập mà không xác thực lại qua token đã được server verify hoặc qua hệ
thống authz tập trung — giá trị role hiệu lực luôn phải do server tự tra cứu/derive từ danh tính đã
xác thực, không nhận thẳng từ input phía client.

❌ **Non-Compliant:**

```ts
const role = req.query.role as string;
if (role === "admin") return res.json(invoiceService.getAllInvoicesAcrossTeams());
```

✅ **Compliant:**

```ts
const role = await authz.resolveRole(req.session.userId);
if (role === "admin") return res.json(invoiceService.getAllInvoicesAcrossTeams());
```

**Phân biệt quan trọng:** quy tắc này chỉ áp dụng khi role/teamId do client gửi được dùng để
**quyết định quyền truy cập** (authorization decision). Khi `role`/`teamId` chỉ là 1 trường DỮ LIỆU
trong body của request TẠO MỚI 1 tài nguyên (ví dụ tạo user mới, gán role cho user đó) — và chính
route đó tự xác thực người GỌI API qua middleware tập trung (`req.role` đã được `requireAuth()` xác
thực từ token, không phải client tự khai) + validate lại giá trị role/teamId gửi lên (whitelist role
hợp lệ, kiểm tra team có tồn tại) trước khi ghi — đây KHÔNG vi phạm 2.2, vẫn là REST bình thường.
Ví dụ KHÔNG vi phạm:

```ts
// web/src/pages/TeamManagement.tsx — role/teamId chỉ là DỮ LIỆU cho user MỚI, không phải quyền của
// người đang gọi API.
await api.post('/teams/users', { name, email, role: newUserRole, teamId: newUserTeamId });
```

```ts
// src/server/routes/teams.ts — ĐÂY LÀ CODE THẬT ĐANG CHẠY, không phải ví dụ minh hoạ. Người gọi API
// được xác thực qua middleware ÁP DỤNG CHO CẢ ROUTER (dòng `teamsRouter.use(requireSuperAdmin)` ở
// đầu file — không phải tham số inline trên từng route), không tin role tự khai. req.body.role và
// req.body.teamId của route POST /users CHỈ LÀ DỮ LIỆU cho user MỚI được tạo, bị validate lại
// (isValidRole, loại trừ "super-admin", kiểm tra team tồn tại) trước khi ghi. KHÔNG được flag route
// này chỉ vì nhìn thấy req.body.role/req.body.teamId trong hàm, phải tra middleware `.use()` phía
// trên cùng file trước khi kết luận thiếu authorization.
teamsRouter.use(requireSuperAdmin); // áp dụng cho MỌI route bên dưới, gồm cả /users

teamsRouter.post("/users", async (req, res) => {
  const role = req.body?.role;
  const teamId = req.body?.teamId;
  if (!isValidRole(role) || role === "super-admin") return res.status(400).json({ error: "invalid_role" });
  if (teamId && !getTeam(teamId)) return res.status(404).json({ error: "team_not_found" });
  // ... tạo user mới với role/teamId đã validate
});
```

### 2.3 Route mới mặc định deny-by-default

Route/endpoint mới xử lý dữ liệu nhạy cảm mặc định phải yêu cầu xác thực + phân quyền
(deny-by-default), trừ khi được đánh dấu rõ ràng là public theo đúng quy ước của dự án. Chỉ áp dụng
cho code THỰC SỰ là một route/handler HTTP (nhận `req`/`res`, hoặc được đăng ký qua router như
`router.get(...)`) — một hàm nội bộ thuần tuý (đọc file local, biến đổi dữ liệu, không có tham số
kiểu request/response, không được đăng ký làm route) không thuộc phạm vi rule này dù xử lý dữ liệu
gì, vì nó không tự nó là một điểm truy cập mạng.

**Quan trọng:** nếu diff chỉ ĐĂNG KÝ route trỏ tới một handler được định nghĩa Ở FILE KHÁC không có
trong diff/file đang xét (ví dụ `router.get("/users/:id/pwd-reset-status", getPasswordResetStatus)`
mà không thấy định nghĩa của `getPasswordResetStatus`), KHÔNG suy diễn rằng handler đó thiếu phân
quyền — Guardian chỉ thấy đúng 1 file tại 1 thời điểm, không thấy được nội dung thật của handler đó.
Chỉ báo vi phạm khi CHÍNH diff/file đang xét cho thấy RÕ RÀNG logic xử lý dữ liệu nhạy cảm không qua
phân quyền — không phải suy diễn từ việc không nhìn thấy phân quyền ở đâu đó.

**Route tự-tham-chiếu (self-referential) không cần thêm lớp phân quyền riêng:** nếu handler CHỈ đọc
và trả về dữ liệu đã có sẵn trên chính `req` của request hiện tại (`req.user`, `req.session`,
`req.teamId`... — dữ liệu do middleware xác thực gắn vào, không phải fetch từ DB theo một ID lấy từ
input) và KHÔNG truy vấn dữ liệu của một danh tính khác, thì bản thân việc có/không có session đã
đủ quyết định handler trả về gì (có session → trả dữ liệu thật, không có → `null`/rỗng) — không cần
thêm bước phân quyền riêng, vì không có "dữ liệu người khác" nào để rò rỉ.

✅ **Compliant:**

```ts
export function diagnosticsHandler(req: Request, res: Response) {
  res.json({
    role: req.user?.role ?? null,
    teamId: req.teamId ?? null,
  });
}
```

**Mở rộng: truy vấn (không chỉ echo trực tiếp) NHƯNG scope bằng danh tính đã xác thực đúng cách
theo 2.2 cũng đủ, không bắt buộc thêm một lớp `requireRole()` riêng.** Nếu ID dùng để truy vấn
KHÔNG đến từ input của client (param/query/body/header) mà đến từ `req.session`/`req.user` (đã qua
xác thực, đúng theo mẫu compliant của 2.2), và dữ liệu trả về CHỈ thuộc phạm vi của chính danh tính
đó (team của chính caller, không phải team bất kỳ) — bản thân việc scope theo danh tính đã xác thực
ĐÃ LÀ một hình thức phân quyền hợp lệ (không phải "không phân quyền gì cả"), không cần thêm
middleware riêng chỉ vì không thấy `requireRole(...)` tường minh. Chỉ thực sự vi phạm 2.3 khi hành
động là quản trị (xoá, sửa quyền người khác) hoặc phạm vi KHÔNG bị giới hạn theo danh tính caller.

✅ **Compliant:**

```ts
export function teamReportsHandler(req: Request, res: Response) {
  const callerTeamId = req.session.teamId; // từ session đã xác thực, không phải input client
  return res.json(getReportsForTeam(callerTeamId)); // chỉ trả dữ liệu của chính team caller
}
```

Phân biệt với vi phạm THẬT — fetch dữ liệu của một danh tính KHÁC theo ID từ input, không phải đọc
từ `req.user`/`req.session` của chính request:

```ts
// Vi phạm — lấy userId từ param (có thể là người dùng bất kỳ), không phải req.user của chính actor
export function getUserRole(req: Request, res: Response, db: Database) {
  return res.json({ role: await db.users.findById(req.params.userId).role });
}
```

### 2.4 Không tạo cửa sau bỏ qua phân quyền

Không tạo "cửa sau" tạm thời để bỏ qua kiểm tra phân quyền (ví dụ query param `?debug=true`,
`?skipAuth=1`, biến môi trường bật/tắt auth cho "dễ test") nếu đoạn code đó có khả năng lẫn vào
nhánh/build production.

❌ **Non-Compliant:**

```ts
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.query.skipAuth === "1") return next();
  if (!req.session?.userId) return res.status(401).send("Unauthorized");
  return next();
}
```

## 3. Approved Exceptions & Carve-outs

- Route xử lý dữ liệu công khai, không nhạy cảm (health-check, danh sách công khai) không bắt buộc
  qua lớp phân quyền. Ví dụ cụ thể: 1 route `GET` liệt kê danh mục tài khoản DEMO (tên/email/role,
  không phải user thật, không chứa password) để phục vụ màn hình đăng nhập demo hiển thị "chọn 1 tài
  khoản để thử" — bắt buộc phải public vì đây đúng là dữ liệu cần thấy TRƯỚC khi đăng nhập, không
  phải rò rỉ dữ liệu người dùng thật. KHÔNG vi phạm miễn route không bao giờ trả về password/token.
- Comment/code review note CẢNH BÁO hoặc HƯỚNG DẪN dev tránh một anti-pattern (ví dụ giải thích tại
  sao không được tự chế điều kiện phân quyền) không tính là vi phạm — đây là hướng dẫn, không phải
  hành vi thực thi.
- Chuỗi/giá trị giống role hoặc email quản trị (ví dụ `"admin@..."`) xuất hiện trong file test/fixture
  làm dữ liệu giả lập cho unit test không tính là vi phạm — chỉ vi phạm khi giá trị đó được dùng
  trong logic phân quyền thật của ứng dụng. Nhận diện "đây là test" qua NỘI DUNG file (khối
  `describe`/`it`/`test(` kiểu Vitest/Jest, `def test_...` kiểu pytest...), không chỉ qua đường dẫn
  thư mục — file test không nhất thiết nằm trong thư mục tên `test/`. Ví dụ KHÔNG vi phạm:
  ```ts
  export const SUPER_ADMIN_FIXTURE = { email: "admin@v-id.vn", role: "super-admin" };
  describe("resolveEffectiveRole", () => {
    it("trả về đúng role cho fixture admin", () => {
      expect(resolveEffectiveRole(SUPER_ADMIN_FIXTURE)).toBe("super-admin");
    });
  });
  ```
- "Cửa sau" (2.4) chấp nhận được nếu bị giới hạn rõ ràng chỉ chạy trong test/CI bằng điều kiện chặt
  chẽ (ví dụ đằng sau `process.env.NODE_ENV === "test"` kiểm tra nghiêm ngặt, không thể true ở
  production) — và chính điều kiện đó chỉ tồn tại trong file test, không tồn tại trong route thật.

## 4. Automated Enforcement

- **LLM Policy Check** (`checkPoliciesWithLLM`) — toàn bộ rule ở đây cần hiểu ngữ cảnh (phân biệt
  middleware tập trung với điều kiện tự chế, phân biệt code test với code production) nên không có
  checker tất định riêng; grounding + judge pass áp dụng như mọi vi phạm LLM khác.

## 5. Remediation & Escalation Guide

- **Tự sửa:** thay điều kiện tự chế bằng middleware/hàm phân quyền tập trung sẵn có của dự án; dùng
  prompt gợi ý sửa lỗi kèm mỗi vi phạm.
- **Nghi ngờ false positive:** dùng luồng "yêu cầu bypass" trên dashboard (`/api/bypass-requests`,
  cần Approver duyệt).
- **Leo thang:** toàn bộ policy này ở mức `high` (blocking, nhưng không phải `critical` — xem giải
  thích ở mục 1) — vi phạm không tự sửa được trong 24h phải báo
  Security Lead; nếu route đã merge vào `main`/production, coi như một sự cố bảo mật cần điều tra
  xem đã bị khai thác chưa (kiểm tra audit log — xem `logging.policy.md`).
