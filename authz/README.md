# OpenFGA Authorization Model (T-19, T-20, T-21)

Authorization Model + tuple demo cho Sprint 3 (Multi-Team Authorization). Thiết kế đầy đủ ở
[`reports/thiet-ke-multi-team-rbac.md`](../reports/thiet-ke-multi-team-rbac.md).

## Chạy thử (yêu cầu Docker + `fga` CLI)

Cài `fga` CLI (chưa có sẵn trong PATH thì tải bản build từ
[github.com/openfga/cli/releases](https://github.com/openfga/cli/releases), giải nén, hoặc set
biến `FGA_BIN` trỏ tới binary đã tải):

```bash
./authz/setup.sh
```

Script tự động:
1. Khởi động OpenFGA qua Docker (nếu chưa chạy)
2. Validate + ghi `model.fga` vào 1 store mới
3. Ghi tuple demo (`tuples.demo.json`) — 1 team (`team-default`), 4 role cũ + 1 `super_admin`
4. Chạy 7 `check()` thật, dừng ngay nếu bất kỳ case nào sai kỳ vọng

## File trong thư mục này

- `model.fga` — Authorization Model (FGA DSL), đã validate hợp lệ bằng `fga model validate`
- `tuples.demo.json` — tuple mẫu để test, không phải dữ liệu thật
- `setup.sh` — dựng + verify toàn bộ, chạy lại được nhiều lần

## Đã verify (2026-08-06)

Chạy `check()` thật qua CLI, không chỉ đọc code — 11 case, tất cả đúng kỳ vọng:

| # | Check | Kết quả |
|---|---|---|
| 1 | `admin-1` (admin trực tiếp) `can_edit_direct` policy | ✅ true |
| 2 | `developer-1` `can_edit_direct` policy | ✅ false |
| 3 | **`super_admin` (chưa từng gán tuple trực tiếp cho team) `can_edit_direct` policy** | ✅ **true** — kế thừa qua `org` |
| 4 | `developer-1` (owner) `can_view` audit_record của chính mình | ✅ true |
| 5 | Developer khác (không phải owner) `can_view` audit_record đó | ✅ false — đúng ngữ nghĩa T-09 |
| 6 | `senior-dev-1` (không phải owner, cùng team) `can_view` audit_record | ✅ true |
| 7 | `auditor-1` `can_view` audit_record (không phải owner) | ✅ true |
| 8 | User không liên quan `can_view` policy | ✅ false |
| 9 | Admin Team A `can_edit_direct` policy của Team B | ✅ false — cách ly chéo team |
| 10 | Admin đúng Team B `can_edit_direct` policy Team B | ✅ true |
| 11 | Super Admin `can_edit_direct` policy Team B (sau khi gán team-b thuộc org) | ✅ true |

## ⚠️ Điểm cần nhớ khi code route quản lý Team (T-23)

Phát hiện lúc test: **mọi Team mới tạo PHẢI được ghi tuple `organization:vsf#org@team:<id>` ngay
lập tức** — nếu quên, Super Admin sẽ **không** thấy được Team đó (thiếu tuple này làm hỏng chuỗi kế
thừa `admin: [user] or super_admin from org`). Route `POST /api/teams` (T-23) bắt buộc phải ghi cả
2 tuple trong cùng 1 transaction: tuple tạo Team + tuple gán Team vào Organization.

## Playground UI

`--playground-enabled` có bật port 3000, nhưng OpenFGA đã đánh dấu **deprecated**, khuyến nghị dùng
CLI `fga query check` (như trên) hoặc `@openfga/sdk` để verify thay vì Playground.

## T-20 — Middleware `requireRelation()` + migrate route mẫu

Code ở `src/server/authz/`:
- `fgaClient.ts` — wrap `@openfga/sdk`, đọc cấu hình từ `FGA_API_URL`/`FGA_STORE_ID`/`FGA_MODEL_ID`
- `requireRelation(objectType, relation, objectIdFrom)` — middleware Express gọi `check()` thật
- `authzGate(permission, fgaArgs)` — feature flag: `GUARDIAN_AUTHZ_MODE=fga` mới dùng
  `requireRelation()`, mặc định (không set) vẫn `requirePermission()` cũ — T-11 (57 test RBAC) không
  bị ảnh hưởng cho tới khi chủ động migrate hết ở T-22

Đã migrate 2 route trong `policies.ts` làm mẫu: `GET /:id` (`can_view`) và
`POST /requests/:id/approve` (`can_approve`, resolve object qua `policyId` của change request).

**Đã verify sống trên dashboard thật** (bật server với `GUARDIAN_AUTHZ_MODE=fga` trỏ vào store T-19,
thêm tuple cho 4 policy thật vào `team-default`): tạo 1 change request thật, developer-1 approve →
403 đúng, admin-1 approve cùng request → 200 đúng và ghi file thật (đã revert lại sau test).

**Lưu ý dependency**: `@openfga/sdk` kéo theo axios 1.16 dính nhiều CVE — đã thêm
`"overrides": { "axios": "^1.19.0" }` vào `package.json` gốc để ép bản vá, không hạ cấp SDK.

## T-21 — Team entity + script migration thật

Code mới:
- `src/server/store/teamStore.ts` — `Team { id, name, createdAt, createdBy }`, lưu ở
  `.guardian/teams.json` (gitignore, giống các store runtime khác — không phải config commit)
- `src/server/authz/migrateTeamDefault.ts` — chạy qua `npm run authz:migrate`
  (`FGA_API_URL`/`FGA_STORE_ID`/`FGA_MODEL_ID`): tạo `team-default`, gán 4 demo user cũ đúng role,
  thêm `super-admin-1` mới, và **tự động link mọi policy file thật hiện có** vào `team-default`
- Thêm role `super-admin` vào `rbac.ts`/`users.ts` — superset quyền của `admin` trong RBAC cũ (để
  không bị 403 ở các route chưa migrate sang OpenFGA, xem T-20's `authzGate`)

**Phát hiện lúc verify sống (không phải chỉ đọc code)**: bản đầu của script chỉ gán role cho user,
**quên link policy file thật vào team** — khiến `can_view`/`can_edit_direct` không ai thoả được vì
thiếu tupleset `team` trên chính policy đó. Đã vá ngay: script giờ đọc `listPolicies()` thật và tự
tạo tuple `team → policy` cho từng file đang có trong `.guardian/policies/`.

**Đã verify sống 2 lần** (không chỉ unit test): chạy script thật trên store OpenFGA sạch, xác nhận
idempotent (chạy 2 lần liên tiếp không lỗi, không tạo trùng), rồi `check()` thật trên đúng 4 policy
file có sẵn trong repo — 8/8 case đúng, gồm case cốt lõi: `super-admin-1` `can_edit_direct` được cả
4 policy thật dù chưa từng gán tuple trực tiếp. RBAC cũ: `rbacIntegration.test.ts` tự tăng từ 57 lên
68 test (11 route × role `super-admin` mới) — cả 68 đều pass, không sửa gì thêm ở test đó.

11 unit test mới (`teamStore.test.ts`, `migrateTeamDefault.test.ts`). 33 file/282 test toàn repo
pass, typecheck sạch, `npm audit` không phát sinh CVE mới.
