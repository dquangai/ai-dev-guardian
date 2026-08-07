# OpenFGA Authorization Model (T-19, T-20, T-21, T-22, T-23, T-24, T-25, T-26)

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

## T-22 — Migrate toàn bộ route còn lại sang OpenFGA

**Phase 1 (BA/SA) — quyết định giữ nguyên `rbac.ts`**: không xoá `rbac.ts`/`rbacIntegration.test.ts`
(68 test) ở task này như dự kiến ban đầu trong sprint-plan — xoá ngay bây giờ sẽ để lại khoảng
trống không có bộ test route-level nào bảo vệ nhánh `GUARDIAN_AUTHZ_MODE` chưa set (mặc định, vẫn
là hành vi production hiện tại). Việc thay thế bộ test này bằng bản dùng tuple thật dời sang **T-25**
— khi đó `rbac.ts` mới bị xoá hẳn. Đây là quyết định SA có chủ đích, không phải trì hoãn quên.

Code mới/sửa:
- **`teamId` xuyên suốt JWT**: `TokenPayload`, `Express.Request`, `signToken()` ở `routes/auth.ts`
  đều mang `teamId` — middleware `requireAuth()` gán `req.teamId` mỗi request.
- **`fgaClient.ts`**: thêm `tryWriteTuples()` (nuốt lỗi, dùng lúc tạo resource — không phá vỡ chế độ
  RBAC cũ nếu OpenFGA sập) và `filterAllowed()` (check song song từng item — cách duy nhất để lọc
  list vì wrapper OpenFGA mỏng của dự án chưa có `ListObjects`).
- **`authzGate.ts`**: thêm `listGate()`/`listRouteGate()` (cặp đôi cho route GET danh sách — flag
  tắt trả nguyên mảng cũ, flag bật lọc qua `filterAllowed`) và `hasRelationOrPermission()` (check
  boolean inline cho handler có nhiều nhánh, vd approve/reject dùng chung 1 route).
- **Tuple-write-at-creation**: mọi resource mới (policy, audit_record, bypass_request) được gắn
  tuple `team` (và `owner` với audit_record, `requester` với bypass_request) ngay lúc tạo qua
  `tryWriteTuples()` — nếu không, tài nguyên mới sẽ không ai `can_view` được vì thiếu tupleset.
- Migrate toàn bộ route còn lại: `policies.ts` (create/edit-direct/delete/approve/reject),
  `audit.ts` (run/history/cache), `bypass.ts` (request/approve/reject/list), `engineConfig.ts`
  (view/edit qua `ENGINE_CONFIG_ID` singleton), `notifications.ts` (list + mark-read), và
  `system.ts` (`/diagnostics`, dùng quan hệ `member` — mọi role cũ đều có `audit:view`).
- `migrateTeamDefault.ts` mở rộng: thêm tuple `engine_config` (org-link + admin can_view/can_edit +
  auditor can_view) vào `buildMigrationTuples()`.

**19 unit test mới** (`authzGate.test.ts` +5 → 9, `fgaClient.test.ts` +6 → 10), cập nhật kỳ vọng
`migrateTeamDefault.test.ts` (6→10 tuple gốc, 8→12 khi có 2 policyId). Bắt và sửa 3 test cũ trong
`notifications.test.ts` bị fail vì handler `GET /policies` chuyển thành `async` (thiếu `await`).

**Kết quả bộ test cuối cùng**: 33 file / **295 test pass**, `tsc --noEmit` sạch.

**Đã verify sống trên dashboard thật** (store OpenFGA mới `t22-live-verify`, chạy
`npm run authz:migrate` thật ghi 14 tuple, server thật với `GUARDIAN_AUTHZ_MODE=fga`, login thật lấy
JWT cho cả 5 role):

| Luồng | Kết quả |
|---|---|
| `engine-config` GET/PUT × 5 role | ✅ 6/6 đúng (admin 200/200, auditor 200/403, developer 403, super-admin 200 qua org) |
| `audit:run` × 3 role | ✅ 3/3 đúng (developer 200, admin 403, senior-dev 403) |
| `GET /audit/history` — ngữ nghĩa T-09 | ✅ developer chỉ thấy record của chính mình (owner), admin/senior-dev/auditor thấy toàn team |
| Bypass request → approve | ✅ developer tạo request 200, tự approve 403, senior-dev approve 200 (`status: approved`) |
| `GET /api/notifications/policies` | ✅ 200 |
| Chế độ cũ (`GUARDIAN_AUTHZ_MODE` unset) sau khi migrate | ✅ developer audit:run 200, admin audit:run 403, admin engine-config 200 — không đổi hành vi |

**Giới hạn đã biết (không phải regression)**: Super Admin không có `teamId` nên không thoả được các
quan hệ "operational" gắn theo team cụ thể (vd `developer` cho `audit:run`, `admin`-qua-team cho
`cache:manage`) khi không có ngữ cảnh team — nhưng RBAC cũ cũng vậy hệt (super-admin cũ là superset
của admin, và admin cũ chưa từng có quyền `audit:run`). Ghi nhận để không gây hiểu nhầm khi demo.

`npm audit`: vẫn 6 vulnerability cũ (vite/vitest/esbuild dev-only, đã biết từ trước T-22) — không
phát sinh CVE mới từ thay đổi task này (không thêm dependency mới ở T-22).

## T-23 — Route + UI quản lý Team

**Phase 1 (BA) — giới hạn quan trọng phát hiện trước khi code**: `users.ts` chỉ có **5 demo user cố
định** (1 user/role), không phải user directory thật — không có luồng tạo user mới. Đã hỏi lại
user hướng xử lý "gán/xoá thành viên" thay vì tự chọn: chốt phương án **di chuyển 1 trong 5 demo
user cố định giữa các Team** (không tạo user mới), khớp đúng kiến trúc Mock Role Switcher hiện tại.

**Phase 1 (SA) — 2 quyết định kiến trúc đáng chú ý**:
1. Gate `requireSuperAdmin` dùng **role check trực tiếp** (`req.role === "super-admin"`) thay vì
   `checkRelation()` OpenFGA — với đúng 1 user super-admin cố định, "role=super-admin" và "là
   super_admin của org:vsf" là tương đương tuyệt đối; giữ role-based để route test được không cần
   OpenFGA sống, và vì team management là tính năng hoàn toàn mới (không có hành vi RBAC cũ cần
   giữ), không cần chế độ dual-mode `GUARDIAN_AUTHZ_MODE` như các route khác.
2. "Di chuyển" user giữa team = xoá tuple ở team cũ (`tryDeleteTuples()` — hàm mới, mirror
   `tryWriteTuples()`) + ghi tuple ở team mới + cập nhật `teamId` trong bộ nhớ (`setUserTeam()`,
   hàm mới trong `users.ts`) để `req.teamId` (JWT, đọc lúc *login kế tiếp*) khớp với tuple thật.
   **Giới hạn đã biết**: một session đã đăng nhập từ trước vẫn giữ `teamId` cũ trong token hiện có
   cho tới khi họ đăng nhập lại — chấp nhận được vì đây là demo/dev tool, không phải hệ thống có SSO
   session refresh.

Code mới:
- `src/server/authz/fgaClient.ts`: thêm `deleteTuples()`/`tryDeleteTuples()` (idempotent qua
  `onMissingDeletes: Ignore` — xoá tuple không tồn tại không phải lỗi)
- `src/server/authz/migrateTeamDefault.ts`: export `TEAM_SCOPED_ROLES` (role → relation) để
  `routes/teams.ts` dùng lại, không lặp mapping
- `src/server/users.ts`: thêm `setUserTeam(role, teamId)` — mutator in-memory cho `DEMO_USERS`
- `src/server/routes/teams.ts` (mới): `GET /api/teams` (list team + members + toàn bộ 4 demo user
  team-scoped kèm teamId hiện tại — để UI dựng dropdown không cần endpoint `/api/users` riêng),
  `POST /api/teams` (tạo team, tự ghi tuple `org` ngay — tránh đúng cái bẫy T-19/T-21 đã ghi nhận),
  `POST /api/teams/:id/members` (gán/di chuyển — 400 nếu role org-wide như super-admin, 404 nếu
  team/user không tồn tại), `DELETE /api/teams/:id/members/:userId` (xoá khỏi team, 404 nếu không
  phải thành viên hiện tại — không cho xoá 2 lần)
- Frontend: `web/src/pages/TeamManagement.tsx` (mới) — bảng Team + form tạo Team + dropdown
  gán/nút xoá thành viên; thêm `'super-admin'` vào `web/src/lib/rbac.ts` (`Role`, `PERMISSIONS`,
  `ROLE_LABELS` — trước T-23 frontend hoàn toàn chưa biết role này tồn tại), route `/teams`
  (`ProtectedRoute allowedRoles={['super-admin']}`), và `NAV_BY_ROLE['super-admin']` = chỉ 1 mục
  Team Management (các trang khác đều team-scoped, không áp dụng cho vai trò org-wide) —
  `Header.tsx`/`Forbidden.tsx`'s `Record<Role,...>` cũng cập nhật theo cho hết lỗi type.

**Lưu ý bàn giao cho T-24**: hiện tại **chưa có cách đăng nhập Super Admin qua giao diện** (Org
Chart demo selector — `DemoModeSelector.tsx` — chỉ có 4 role cũ, việc thêm node Super Admin là đúng
phạm vi T-24). Vì vậy QA trình duyệt cho trang Team Management ở task này được thực hiện bằng cách
lấy JWT thật qua `POST /api/auth/demo-login {"role":"super-admin"}` (endpoint này đã hoạt động từ
T-08) rồi bơm thẳng vào `localStorage["guardian.token"]` bằng Playwright — vẫn là app thật, dữ liệu
thật, chỉ bỏ qua bước click nút đăng nhập (bước đó chưa tồn tại cho tới T-24).

**Test mới**: `test/teamsRouter.test.ts` (17 test, integration qua `supertest` + app thật, cùng
kiểu với T-11's `rbacIntegration.test.ts`) + 2 unit test cho `setUserTeam()` trong `test/users.test.ts`.
**34 file / 314 test pass**, `tsc --noEmit` sạch (backend lẫn `web/`), `npm run build` (frontend)
thành công.

**Đã verify sống** (server thật, `.guardian/teams.json` thật của repo — dọn sạch sau test):
- Gate: 401 (không token), 403 (admin gọi `/api/teams`), 200 (super-admin) — curl thật
- Tạo team thật (`team-qa-t23`), di chuyển `developer-1` từ `team-default` sang team mới, `GET
  /api/teams` phản ánh đúng cả 2 phía; gán `super-admin-1` vào team → 400 đúng; admin gọi POST
  members → 403 đúng; xoá thành viên → 200, xoá lần 2 → 404 đúng (không cho xoá trùng)
- **QA trình duyệt thật** (Playwright, không phải chỉ curl): đăng nhập bằng token thật, vào
  `/teams`, tạo Team qua form thật, chọn user qua dropdown thật và bấm "Thêm vào team", xác nhận
  tên xuất hiện đúng trong bảng, bấm "Xoá", xác nhận quay lại "Chưa có thành viên" — toàn bộ qua UI
  thật, không mock. Ảnh chụp màn hình xác nhận header hiển thị đúng pill "SUPER ADMIN" và sidebar
  chỉ có đúng 1 mục "Team Management" (không lẫn menu của role khác)
- Dọn sạch: xoá 2 team test (`team-qa-t23`, `team-browser-qa`) khỏi `.guardian/teams.json` sau khi
  verify xong, trả file về đúng trạng thái ban đầu (chỉ còn `team-default`)

`npm audit`: không phát sinh CVE mới (không thêm dependency ở T-23).

## T-24 — Team switcher (Header) + Super Admin trong Org Chart demo

**Phase 1 (BA)**: "Team switcher trong Header" mơ hồ về mức chức năng — đã hỏi lại user thay vì tự
chọn. Chốt: switcher **đổi ngữ cảnh thật** (không chỉ hiển thị) — Super Admin chọn 1 Team, hệ thống
cấp lại JWT với `teamId` đó, và họ dùng lại được đúng 3 trang team-scoped có sẵn (Overview, Findings,
Policies) y hệt 1 admin của team đó, cộng với Team Management luôn có sẵn.

Code mới/sửa:
- `src/server/routes/auth.ts`: `POST /api/auth/act-as-team` (yêu cầu `requireAuth`, chỉ super-admin)
  — cấp lại token với `teamId` được chọn (hoặc bỏ trống để quay về org-wide); không đụng tới
  `DEMO_USERS` (khác hẳn T-23's "di chuyển thành viên" — đây chỉ là lựa chọn **theo phiên**, không
  phải gán lại danh tính lâu dài). `respondWithToken()` đổi chữ ký nhận `teamId` tường minh từ mọi
  caller thay vì tự đọc `user.teamId`, để tránh nhập nhằng.
- `src/server/routes/me.ts`: trả thêm `teamId` — cần để hydrate lại đúng ngữ cảnh sau khi F5 trang.
- `src/server/routes/policies.ts`: **sửa lỗi phát hiện khi code T-24** — `tagPolicyTeam()` trước đó
  luôn tra `findUserById(authorUserId)?.teamId`, mà `DEMO_USERS["super-admin"]` không bao giờ có
  `teamId` (org-wide theo thiết kế) → Super Admin tạo policy trực tiếp trong lúc "act as" 1 team sẽ
  không bao giờ được gắn tuple `team` đúng. Sửa: nhánh direct-apply giờ ưu tiên `req.teamId` (từ
  token phiên hiện tại) trước khi fallback `findUserById`; nhánh approve-flow vẫn dùng
  `findUserById(request.submittedBy)?.teamId` — đúng vì đó phải là team của **người đề xuất gốc**,
  không phải người đang duyệt.
- Frontend: `web/src/lib/navigation.ts` thêm `navItemsFor(role, teamId)` (nguồn sự thật duy nhất
  cho sidebar + route access, thay `NAV_BY_ROLE[role]` tra thẳng) — Super Admin không có team chỉ
  thấy Team Management, có team thấy thêm Overview/Findings/Policies. `AuthContext.tsx` thêm
  `teamId` vào `AuthUser` + hàm `actAsTeam()`. `ProtectedRoute.tsx` thêm prop `requireTeamContext`
  (chặn Super Admin vào thẳng URL `/`, `/findings`, `/policies` khi chưa chọn team — role khác luôn
  có teamId nên prop này là no-op với họ). `TeamSwitcher.tsx` (component mới, Header) — dropdown gọi
  `actAsTeam()`, điều hướng về `/` khi chọn team hoặc `/teams` khi bỏ chọn. `DemoModeSelector.tsx`
  thêm node "CẤP 0 — TOÀN QUYỀN TỔ CHỨC" phía trên Admin — đóng khoảng trống T-23 để lại (trước đó
  không có cách đăng nhập Super Admin qua UI thật).

**8 unit/integration test mới** (`authRouter.test.ts`) cho `/act-as-team` (401/403/400/404 + luồng
thành công đổi/xoá ngữ cảnh, xác nhận qua `/me`) + regression demo-login vẫn trả đúng `teamId`.
**35 file / 322 test pass**, typecheck sạch backend lẫn `web/`, `npm run build` thành công.

**Đã verify sống thật, cả API lẫn trình duyệt thật**:
- Đăng nhập Super Admin **qua UI thật** (bấm Org Chart, không còn cần bơm token) → vào thẳng
  `/teams`, sidebar chỉ có Team Management
- Mở Team switcher, chọn "Default Team" thật → điều hướng `/`, sidebar hiện thêm Overview/Findings/
  Policies, trang Overview load dữ liệu dashboard thật (4 audit, Governance Health 100%, Live
  Architecture Graph) — ảnh chụp xác nhận
- Chọn lại "Toàn tổ chức" → điều hướng về `/teams`, sidebar rút gọn lại đúng như ban đầu
- **Verify fix `tagPolicyTeam` bằng OpenFGA thật** (store mới, `npm run authz:migrate` thật): Super
  Admin act-as-team `team-default`, tạo policy mới trực tiếp qua API thật → `fga query check` xác
  nhận `developer-1` (thành viên `team-default`) `can_view` policy đó = **true**, user không liên
  quan (`user:nobody-1`) = **false** — đúng như thiết kế, chứng minh tuple `team` được gắn đúng theo
  `req.teamId` của phiên "act as", không còn bị bỏ sót như trước khi sửa
- admin gọi `POST /api/auth/act-as-team` → 403 đúng

**Giới hạn phát hiện thêm (ghi nhận, không thuộc phạm vi T-24)**: khi `GUARDIAN_AUTHZ_MODE=fga`
thật sự bật, tạo **policy hoàn toàn mới** (cả direct-apply lẫn propose) sẽ luôn bị chặn cho MỌI role
— vì `can_edit_direct`/`can_propose` được check trên object `policy:<id>` chưa từng tồn tại (chưa có
tuple `team` nào để suy luận), không riêng gì Super Admin. Đây là khoảng trống kiến trúc có từ T-22,
phát hiện khi chuẩn bị verify sống T-24 (đã né bằng cách verify ở chế độ flag-off, đúng với hành vi
production hiện tại) — nên cân nhắc xử lý ở T-25 (vd: check quyền tạo mới dựa trên quan hệ
`senior_dev`/`admin` của `team:<req.teamId>` trực tiếp thay vì trên object chưa tồn tại).

Dọn sạch: xoá policy test (`t24-live-verify.policy.md`) khỏi `.guardian/policies/`, dừng server,
dừng + xoá container OpenFGA tạm. `npm audit`: không CVE mới.

## T-25 — Bộ test route-level dùng tuple thật (không phải chỉ JWT role)

**Phase 1 (BA/SA) — quyết định quan trọng trước khi code**: mô tả gốc của T-25 trong sprint-plan
nói "thay thế `rbacIntegration.test.ts`" — đã hỏi lại user trước khi làm theo nghĩa đen. Phát hiện:
`GUARDIAN_AUTHZ_MODE` mặc định (unset) **vẫn là chế độ chạy thật của package `ai-dev-guardian` đã
publish lên npm** — không phải toàn bộ dùng OpenFGA bắt buộc. Xoá `rbac.ts`/`rbacIntegration.test.ts`
sẽ phá vỡ sản phẩm cho mọi người dùng không tự dựng OpenFGA. **Quyết định**: giữ nguyên `rbac.ts`
vĩnh viễn; T-25 = thuần bổ sung một bộ test MỚI (`test/tupleRouteIntegration.test.ts`) chứng minh
đúng các tính chất bảo mật quan hệ (kế thừa Super Admin, cách ly cross-team) khi chạy ở chế độ
OpenFGA thật — không đụng gì tới `rbacIntegration.test.ts` (68 test) hiện có.

**Thiết kế**: chạy route-level qua `supertest` như T-11, nhưng:
- Dựng **OpenFGA thật qua Docker** trong `beforeAll` (không mock `checkRelation()` — mock lại logic
  suy luận quan hệ sẽ tự đánh lừa chính mình, không chứng minh được gì)
- Model nạp từ `authz/model.json` (file JSON mới, sinh 1 lần bằng `fga model transform --file
  model.fga --output-format json` — dùng CLI thật để transform, không đoán schema JSON của OpenFGA
  bằng tay) qua `@openfga/sdk` trực tiếp — **không cần cài `fga` CLI để CHẠY test**, chỉ Docker
- Dữ liệu 100% tuple thật: 2 team độc lập (`team-alpha`, `team-beta`) cùng 1 org, user tổng hợp
  (không dùng `DEMO_USERS` cố định) để có thể test 2 admin khác team cùng lúc — điều `rbac.ts`
  không bao giờ mô tả được (role "admin" không biết gì về team)
- Tự skip (không fail) toàn bộ file nếu không có Docker — verify bằng cách giả lập Docker daemon
  không kết nối được, xác nhận `16 skipped`, không phải lỗi

**Bug thật phát hiện lúc viết test (không phải lỗi test, lỗi hiểu sai thứ tự thực thi)**:
`authzGate()`/`listRouteGate()` đọc `GUARDIAN_AUTHZ_MODE` **một lần duy nhất lúc router được đăng
ký** (lúc `bypassRouter.post(path, authzGate(...), handler)` chạy khi module `bypass.ts` được
import) — không đọc lại mỗi request. Bản đầu của test file gọi `createApp()` ở module scope (import
tĩnh), tức là TRƯỚC khi `beforeAll` kịp set `GUARDIAN_AUTHZ_MODE=fga` — toàn bộ test vô tình chạy
trên RBAC cũ, và các case cùng-team "tình cờ" đúng (RBAC cũ và OpenFGA trùng kết quả khi không có
cross-team), che giấu sự thật cho tới khi 2 case cách ly cross-team fail rõ ràng (403 kỳ vọng nhưng
ra 200). Sửa: `createApp` import động (`await import(...)`) bên trong `beforeAll`, sau khi
`GUARDIAN_AUTHZ_MODE` đã được set — ES module import tĩnh luôn hoist lên trước mọi code khác trong
file, nên đây là cách DUY NHẤT đảm bảo đúng thứ tự. Đã re-run và xác nhận 3 case cross-team trước đó
fail sai giờ pass đúng, chứng minh bug có thật và đã sửa đúng chỗ (không phải chỉnh test cho qua).

**16 test mới**, phủ:
- Super Admin kế thừa `admin` qua org trên team **chưa từng gán tuple trực tiếp** (2 case)
- Cách ly cross-team: admin team A không đụng được resource team B, cả 2 chiều (4 case)
- `audit:run` qua quan hệ `developer` trên team, không phải chuỗi role (2 case)
- T-09 qua tuple `owner`: dev chỉ thấy audit của chính mình, kể cả đồng đội cùng team cũng không
  thấy; senior_dev thấy toàn team; admin team khác không thấy gì (4 case)
- `bypass_request`: tự duyệt bị chặn, team khác duyệt bị chặn, đúng team duyệt được (4 case)

**36 file / 338 test pass** toàn repo (thêm 16, không phá gì cũ), typecheck sạch. Chạy độc lập qua
`npm run test:tuples` (cần Docker) hoặc tự động trong `npm test` (tự skip nếu thiếu Docker).

**`npm audit`**: phát hiện **2 CVE mới không liên quan tới T-25** (không thêm dependency nào ở task
này) — `brace-expansion` (qua `madge`, high) và `js-yaml` (qua `gray-matter`, high) — đây là CVE mới
công bố giữa các lần audit trong ngày (database CVE cập nhật theo thời gian thực, không phải do thay
đổi code). Ghi nhận, không tự ý chạy `npm audit fix`/`fix --force` (có thể kéo theo breaking change
không nằm trong phạm vi T-25) — cần user xác nhận hướng xử lý riêng.

## T-26 — QA thủ công toàn bộ luồng mới qua browser thật

Dựng môi trường sống đầy đủ: OpenFGA thật qua Docker, `npm run authz:migrate` thật,
`GUARDIAN_AUTHZ_MODE=fga`, `web/dist` build thật — theo đúng pattern Playwright headless đã dùng ở
T-12. Để có 2 team **thật** với dữ liệu khác nhau cho việc QA cách ly (không chỉ 1 `team-default`
như mọi lần verify trước), đã tạo thật `team-security` qua UI Team Management và **chuyển
`auditor-1` sang đó tạm thời** — verify xong chuyển lại đúng nguyên trạng.

**Đăng nhập qua UI thật cho cả 5 role** (Org Chart demo selector, không bơm token — lần đầu tiên
Super Admin đăng nhập qua đúng luồng UI thật kể từ khi node được thêm ở T-24): cả 5 role load
không lỗi console, đúng sidebar theo `navItemsFor()`.

**Bug thật phát hiện lúc QA — 500 lỗi cho Super Admin chưa chọn team**: `GET /system/diagnostics`
(và mọi route dùng `requireRelation` với `objectIdFrom: (req) => req.teamId ?? ""`) khi
`req.teamId` rỗng sẽ tạo object OpenFGA dạng `"team:"` (id rỗng) — OpenFGA API từ chối object này
bằng lỗi validation, và middleware biến lỗi đó thành **500** thay vì 403 hợp lý. Đây là khoảng trống
có từ T-22 nhưng chưa từng lộ diện vì mọi lần verify trước hoặc chạy flag-off (T-24's UI click-through
ban đầu), hoặc Super Admin luôn đã chọn sẵn 1 team trước khi chạm trang cần diagnostics. **Sửa tận
gốc trong `requireRelation()`** (dùng chung cho cả 4 chỗ gọi kiểu này: `system.ts`, `audit.ts` × 2,
`bypass.ts`) — id rỗng thì 403 thẳng, không gọi OpenFGA. Thêm 1 unit test xác nhận không gọi
`checkRelation()` khi id rỗng.

**Polish thêm (không phải bug, nhưng ảnh hưởng độ sạch demo)**: Header/Sidebar gọi
`/system/diagnostics` vô điều kiện — với Super Admin org-wide (chưa chọn team) sẽ luôn 403 (đúng),
nhưng in ra console 2 lỗi mạng mỗi lần tải trang dù UI vẫn xuống cấp gọn gàng (text mặc định, không
vỡ layout). Thêm `enabled: !(role==='super-admin' && !teamId)` cho cả 2 nơi gọi — sạch console hoàn
toàn khi demo.

**Verify cách ly dữ liệu thật qua browser** (không chỉ curl):
- Auditor-1 sau khi chuyển sang `team-security` → trang Policies hiện **"Policies (0)"**, không thấy
  4 policy của `team-default` — ảnh chụp xác nhận
- Developer-1 (vẫn ở `team-default`) → trang Policies hiện **"Policies (4)"** với nội dung thật —
  đối chứng dương, xác nhận không phải do lỗi tải trang chung
- Super Admin qua Team switcher xem `team-default` lẫn `team-security` đều thấy sidebar badge
  "Policies 4" **giống nhau** — ban đầu tưởng là bug cách ly, nhưng xác minh lại đây là hành vi ĐÚNG
  theo thiết kế ReBAC: `can_view` (policy) chỉ phụ thuộc quan hệ `member` của người xem trên team
  sở hữu policy, và Super Admin kế thừa `admin` (nên cả `member`) trên **mọi** team qua org — không
  phụ thuộc đang "act as" team nào. Switcher chỉ scope các hành động GHI (tag team mới, audit:run,
  cache:manage), không giới hạn quyền XEM của Super Admin — ghi rõ lại để tránh hiểu nhầm khi demo.

**Kết quả**: 36 file / **339 test pass** (thêm 1 unit test mới cho fix), typecheck sạch backend lẫn
`web/`, `npm run build` (frontend) thành công, `npm audit` không phát sinh thêm CVE (đã có 2 CVE
ghi nhận từ T-25, không đổi).

Dọn sạch: chuyển `auditor-1` về lại `team-default`, xoá `team-security` khỏi
`.guardian/teams.json`, dừng server, dừng + xoá container OpenFGA. `git status` xác nhận chỉ còn
đúng các file code đã sửa (`requireRelation.ts`, `Header.tsx`, `Sidebar.tsx`, test liên quan).

## Vá 2 CVE phát hiện ở T-25 (sau Sprint 3)

Đã chạy `npm audit fix` (không `--force`, đã xác nhận trước qua `--dry-run` chỉ bump patch version,
không đụng `vitest`/`vite`): `js-yaml` 3.15.0 → 3.15.1, `brace-expansion` 5.0.8 → 5.0.9 (qua
`gray-matter` và `madge` — transitive, không đổi `package.json`, chỉ `package-lock.json`). Còn lại
5 vulnerability (chuỗi `esbuild`/`vite`/`vitest` cũ, cần `--force` và nâng `vitest` breaking) —
**cố tình chưa vá**, giữ nguyên baseline đã biết từ trước. Verify sau khi vá: `tsc --noEmit` sạch,
36 file/339 test pass, `npm run build` (frontend) thành công.
