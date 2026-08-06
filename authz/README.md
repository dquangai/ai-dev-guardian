# OpenFGA Authorization Model (T-19)

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
