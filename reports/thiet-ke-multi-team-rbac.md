# Thiết kế Multi-Team Authorization cho AI Dev Guardian (OpenFGA / ReBAC)

**Ngày:** 06/08/2026
**Trạng thái:** Draft v2 — thay thế hoàn toàn hướng "thêm cột `teamId` lọc thủ công" ở bản v1 bằng
kiến trúc **ReBAC (Relationship-Based Access Control)** theo mô hình Google Zanzibar, dùng
**OpenFGA** (open-source, do Okta/Auth0 xây, CNCF Sandbox) làm authorization engine.

**Vì sao đổi hướng:** RBAC phẳng + cột `teamId` filter thủ công ở từng route là cách làm cũ, dễ sai
sót (quên filter 1 chỗ là lộ dữ liệu chéo team), khó mở rộng khi phân cấp phức tạp hơn (Super Admin
kế thừa quyền admin ở mọi team, v.v.). ReBAC tách hẳn "ai được làm gì" ra khỏi code nghiệp vụ,
biểu diễn qua **quan hệ** (`user`, `relation`, `object`) và để engine tự suy luận — đúng cách
Google (Zanzibar), Slack, GitHub, Canva, Grab... đang làm ở quy mô lớn.

---

## 1. Khái niệm cốt lõi của OpenFGA

- **Authorization Model** — định nghĩa các `type` (user, team, policy...) và `relation` giữa
  chúng, viết bằng FGA DSL. Đây là "schema" của toàn bộ hệ phân quyền, sống độc lập với code.
- **Tuple** — 1 sự thật về quan hệ, dạng `object#relation@user`. Ví dụ:
  `team:platform#admin@user:alice` nghĩa là "alice có relation `admin` trên team `platform`".
  Tuple được ghi/xoá khi nghiệp vụ thay đổi (thêm user vào team, đổi role...).
- **Check API** — câu hỏi duy nhất ứng dụng cần hỏi: *"user X có relation Y trên object Z không?"*
  Gọi `fgaClient.check({ user, relation, object })` → `true/false`. Toàn bộ logic phân cấp
  (Super Admin kế thừa quyền team, v.v.) engine tự suy luận từ Authorization Model, code không cần
  biết.

## 2. Authorization Model cho AI Dev Guardian

Map trực tiếp từ bảng permission hiện tại (`src/server/rbac.ts`) sang quan hệ, cộng thêm
`organization`/`team`/`super_admin` mới.

```
model
  schema 1.1

type user

type organization
  relations
    define super_admin: [user]

type team
  relations
    define org: [organization]
    define admin: [user] or super_admin from org
    define senior_dev: [user]
    define developer: [user]
    define auditor: [user]
    define member: admin or senior_dev or developer or auditor

type policy
  relations
    define team: [team]
    define can_view: member from team
    define can_edit_direct: admin from team
    define can_propose: senior_dev from team
    define can_approve: admin from team or senior_dev from team

type audit_record
  relations
    define team: [team]
    define owner: [user]
    # T-09: dev chỉ thấy audit của chính mình, trừ khi cũng là admin/senior-dev/auditor
    define can_view: owner or admin from team or senior_dev from team or auditor from team

type bypass_request
  relations
    define team: [team]
    define requester: [user]
    define can_request: developer from team
    define can_view: requester or admin from team or senior_dev from team or auditor from team
    define can_approve: admin from team or senior_dev from team

type engine_config
  relations
    define org: [organization]
    # engine-config:view = admin + auditor (không phải senior-dev/dev) — khai báo tường minh,
    # không suy ra từ team vì đây là permission bất đối xứng so với các role khác
    define can_view: [user] or super_admin from org
    define can_edit: [user] or super_admin from org
```

**Điểm hay của model này so với code `if` rải rác:**
- Super Admin **tự động** có quyền `admin` trên MỌI team (`admin: [user] or super_admin from org`)
  — không cần code nào lặp qua từng team để gán quyền, engine tự suy luận theo Authorization Model
- T-09 (dev chỉ xem audit của mình) vẫn giữ nguyên đúng ngữ nghĩa, biểu diễn tự nhiên qua quan hệ
  `owner`, không cần code lọc `WHERE triggeredBy = userId` nữa
- Thêm 1 role/quan hệ mới sau này = sửa Authorization Model + ghi thêm tuple, **không sửa code
  route handler nào cả**

## 3. Tuple thực tế sẽ được ghi khi nào

| Sự kiện nghiệp vụ | Tuple ghi/xoá |
|---|---|
| Super Admin tạo Team mới | `team:<id>#org@organization:acme` |
| Super Admin thêm user vào Team với role X | `team:<id>#<role>@user:<userId>` (vd `team:platform#developer@user:sam`) |
| User bị đổi role trong Team | Xoá tuple role cũ, ghi tuple role mới |
| User rời Team | Xoá tuple |
| Tạo policy mới thuộc Team | `policy:<id>#team@team:<teamId>` |
| Chạy audit, ghi `AuditRecord` mới | `audit_record:<id>#team@team:<teamId>` +
  `audit_record:<id>#owner@user:<userId>` |
| Gán Super Admin cho user (IT/Security) | `organization:acme#super_admin@user:<userId>` |

## 4. Tích hợp vào code hiện tại

**Trước (RBAC phẳng, `src/server/authMiddleware.ts`):**
```ts
export function requirePermission(permission: Permission) {
  return (req, res, next) => {
    if (!hasPermission(req.role, permission)) return res.status(403)...;
    next();
  };
}
```

**Sau (gọi OpenFGA):**
```ts
export function requireRelation(objectType: string, relation: string, objectIdFrom: (req) => string) {
  return async (req, res, next) => {
    const { allowed } = await fgaClient.check({
      user: `user:${req.userId}`,
      relation,
      object: `${objectType}:${objectIdFrom(req)}`,
    });
    if (!allowed) return res.status(403).json({ error: "forbidden" });
    next();
  };
}

// vd route policy approve:
policiesRouter.post(
  "/requests/:id/approve",
  requireRelation("policy", "can_approve", (req) => req.params.id),
  handler
);
```

SDK Node.js chính thức: `@openfga/sdk` — đã có sẵn client cho Node/TypeScript, không cần tự viết
HTTP call.

## 5. Hạ tầng & triển khai

- **Self-host**: OpenFGA chạy dưới dạng 1 Docker container duy nhất (`openfga/openfga`), lưu dữ
  liệu (tuple + model) vào Postgres/SQLite/in-memory. Với quy mô vài team nội bộ, SQLite hoặc
  Postgres nhỏ là đủ.
- **Không muốn tự host**: có bản **OpenFGA Cloud** (Auth0 FGA) dùng miễn phí ở quy mô nhỏ, không
  cần quản lý hạ tầng — phù hợp để chứng minh khái niệm (POC) cho Mentor trước khi quyết định
  self-host lâu dài.
- Server Express hiện tại chỉ cần thêm 1 dependency (`@openfga/sdk`) + biến môi trường trỏ tới
  OpenFGA instance (`FGA_API_URL`, `FGA_STORE_ID`).

## 6. Kế hoạch migration từ RBAC hiện tại

1. Cài `@openfga/sdk`, dựng 1 OpenFGA instance (Docker local trước, để dev/test)
2. Viết Authorization Model ở mục 2 qua OpenFGA CLI/API (1 lần, giống migrate schema)
3. Tạo Team mặc định (`team-default`), ghi tuple gán cả 4 demo user hiện tại vào team này đúng
   role cũ của họ + thêm 1 demo user mới role `super_admin`
4. Thay từng `requirePermission(...)` bằng `requireRelation(...)` — làm dần từng route, có thể
   chạy song song 2 cơ chế (feature flag) trong lúc chuyển đổi để không vỡ luồng đang chạy
5. Bỏ hẳn `src/server/rbac.ts` khi mọi route đã chuyển xong

## 7. Test cần bổ sung

Thay vì seed JWT với role như `test/rbacIntegration.test.ts` hiện tại (57 test), cần seed thêm
**tuple** trước mỗi test case (vd `writeTuple("team:a#admin@user:admin-1")`), rồi gọi `check()`
thật để xác nhận. OpenFGA cung cấp SDK test-helper viết tuple hàng loạt, và có thể chạy OpenFGA
dưới dạng test-container (Testcontainers) trong CI — không cần OpenFGA instance thật khi chạy
`vitest`.

Test case quan trọng cần thêm so với bộ 57 test cũ:
- Super Admin tự động có quyền `admin` trên team chưa từng được gán tuple trực tiếp (kiểm chứng
  đúng tính năng cốt lõi của ReBAC — kế thừa qua quan hệ, không cần gán tay từng team)
- Admin Team A gọi API với `object: policy:xxx` thuộc Team B → phải bị từ chối dù cùng có relation
  `admin` (nhưng ở Team khác — quan hệ không bắc cầu sai)

## 8. Đánh đổi so với bản v1 (teamId cột thủ công)

| Tiêu chí | v1: teamId cột thủ công | v2: OpenFGA/ReBAC |
|---|---|---|
| Hạ tầng thêm | Không | 1 service OpenFGA (container hoặc cloud) |
| Độ phức tạp code | Thấp (if/filter quen thuộc) | Trung bình lúc đầu (học DSL FGA), gọn hơn về sau |
| Rủi ro quên filter 1 chỗ → lộ dữ liệu | Có (con người dễ quên) | Thấp hơn nhiều (1 nguồn sự thật, engine tự suy luận) |
| Mở rộng phân cấp phức tạp sau này | Phải sửa code nhiều nơi | Chỉ sửa Authorization Model |
| Mức độ "hiện đại", gây ấn tượng | RBAC truyền thống | Đúng xu hướng công ty lớn 2025-2026 (Zanzibar-style) |

**Khuyến nghị**: bắt đầu bằng OpenFGA chạy Docker local để dựng POC (Giai đoạn 1-2 trong lộ trình
dưới), demo được cho Mentor xem cơ chế Super Admin kế thừa quyền tự động — đây chính là điểm nhấn
kỹ thuật khác biệt so với RBAC phẳng thông thường.

## 9. Lộ trình đề xuất

| Giai đoạn | Việc | Ước lượng |
|---|---|---|
| 1 | Dựng OpenFGA local (Docker), viết Authorization Model, test bằng OpenFGA Playground/CLI | Nhỏ |
| 2 | Cài `@openfga/sdk`, viết `requireRelation()` middleware, migrate 2-3 route đầu tiên làm mẫu | Vừa |
| 3 | Migrate toàn bộ route còn lại, bỏ `rbac.ts` cũ | Vừa |
| 4 | Route + UI quản lý Team (tạo Team, gán member) — ghi tuple qua API thay vì sửa JSON tay | Vừa |
| 5 | Team switcher trong Header cho Super Admin, cập nhật Org Chart demo thêm node Super Admin | Nhỏ |
| 6 | Viết lại bộ test route-level (mở rộng pattern T-11) dùng tuple thay vì chỉ JWT role | Vừa |

**Chưa chốt**: self-host OpenFGA (Docker) hay dùng OpenFGA Cloud để làm POC trước — tài liệu này
giả định bắt đầu bằng Docker local cho nhanh, không cần tài khoản/hạ tầng ngoài.
