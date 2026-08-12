---
category: Performance
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
tags: [performance, scalability]
---

# Performance

## 1. Executive Summary & Compliance Standards

Policy này bảo vệ khả năng chịu tải và độ trễ chấp nhận được của các endpoint xác thực/phân quyền —
đây là những endpoint bị gọi ở tần suất cao nhất (mọi request đều đi qua), nên một lỗi hiệu năng nhỏ
ở đây (query N+1, mã hoá đồng bộ chặn event loop, cache không invalidate) khuếch đại thành sự cố
diện rộng hoặc lỗ hổng bảo mật (quyền đã bị thu hồi nhưng cache vẫn cho qua).

- **ISO/IEC 27001 Annex A:** `A.12.1 Operational Procedures and Responsibilities` (quản lý năng
  lực hệ thống — capacity management).

## 2. Normative Directives

### 2.1 Không mã hoá/hash chi phí cao đồng bộ trên request path chính

Không gọi hàm mã hoá/hash chi phí cao (bcrypt cost factor lớn, RSA, PBKDF2 nhiều vòng lặp...) một
cách đồng bộ (blocking) ngay trên request path chính của endpoint có lưu lượng cao (login, xác thực
token) mà không cân nhắc worker/queue riêng — việc này chặn event loop, làm chậm mọi request đồng
thời khác.

### 2.2 Không truy vấn CSDL trong vòng lặp (N+1 query)

Không truy vấn cơ sở dữ liệu bên trong vòng lặp khi tra cứu quyền/role/thông tin cho một danh sách
người dùng hoặc danh sách team — nên gộp thành một truy vấn duy nhất hoặc dùng batch-load.

❌ **Non-Compliant:**

```ts
async function getTeamPermissionSummary(userIds: string[], db: Database) {
  const summary = [];
  for (const id of userIds) {
    summary.push(await db.permissions.findByUserId(id));
  }
  return summary;
}
```

✅ **Compliant:**

```ts
async function getTeamPermissionSummary(userIds: string[], db: Database) {
  return db.permissions.findMany({ where: { userId: { in: userIds } } });
}
```

### 2.3 Cache phân quyền phải có invalidation rõ ràng

Cache dữ liệu phân quyền (role/permission) phải có cơ chế invalidate rõ ràng khi quyền bị thu hồi
hoặc thay đổi — cache "cứng" không có TTL/invalidate hợp lý có thể khiến người dùng đã bị thu hồi
quyền vẫn còn quyền truy cập trong lúc cache chưa hết hạn.

❌ **Non-Compliant:**

```ts
const permissionCache = new Map<string, string[]>();

async function revokeRole(userId: string, role: string, db: Database) {
  await db.roles.remove(userId, role);
  // permissionCache không được xoá — user vẫn còn quyền cũ trong cache
}
```

✅ **Compliant:**

```ts
async function revokeRole(userId: string, role: string, db: Database) {
  await db.roles.remove(userId, role);
  permissionCache.delete(userId);
}
```

**Quan trọng khi đánh giá 2.3:** nếu diff có ĐỦ cả (a) một cơ chế TTL/expiry (ví dụ lưu kèm
`expiresAt` và kiểm tra trước khi dùng cache) VÀ (b) một lệnh xoá/invalidate cache khi quyền bị thu
hồi — dù (a) và (b) nằm ở HAI HÀM KHÁC NHAU trong cùng file/diff — PHẢI coi là compliant. Không được
báo vi phạm chỉ vì đọc riêng lẻ hàm đọc-cache mà chưa đối chiếu với hàm ghi/thu-hồi quyền cùng diff.

## 3. Approved Exceptions & Carve-outs

- Quy tắc 2.1 chỉ áp dụng khi có bằng chứng cụ thể trong diff (gọi hàm đồng bộ chi phí cao ngay
  trong handler xử lý request) — không suy diễn từ việc chỉ import thư viện mã hoá.
- Vòng lặp gọi DB nhưng trên một tập hợp NHỎ, CỐ ĐỊNH tại thời điểm viết code, không liên quan tới
  danh sách user/team động — không tính là vi phạm 2.2 (rủi ro N+1 thực sự chỉ xảy ra khi tập hợp
  tăng theo dữ liệu người dùng). "Cố định" đánh giá theo Ý NGHĨA (một danh sách hardcode ngắn, không
  đổi khi có thêm user/team mới), KHÔNG theo từ khoá khai báo — Go không có `const` cho slice, nên
  `var dashboardWidgetIDs = []string{"revenue", "active-users", "error-rate"}` khai báo bằng `var`
  vẫn tính là "cố định" theo nghĩa này, không phải "động" chỉ vì dùng từ khoá `var`. Ví dụ KHÔNG vi
  phạm ở TypeScript (mảng literal hardcode, không phải danh sách user/team lấy từ DB):
  ```ts
  const CRITICAL_ERROR_CODES = ["AUTH_FAILED", "RATE_LIMITED", "SERVER_ERROR"] as const;
  async function checkKnownErrorPatterns(db: Database) {
    const patterns = [];
    for (const code of CRITICAL_ERROR_CODES) {
      patterns.push(await db.errorPatterns.findByCode(code));
    }
    return patterns;
  }
  ```
  Ví dụ KHÔNG vi phạm ở Go (đầy đủ, kể cả có lời gọi DB thật bên trong loop — vẫn KHÔNG phải N+1 vì
  `dashboardWidgetIDs` là danh sách hardcode 3 phần tử cố định, không lấy từ user/team nào):
  ```go
  var dashboardWidgetIDs = []string{"revenue", "active-users", "error-rate"}

  func LoadDashboardWidgets(db *sql.DB) ([]WidgetConfig, error) {
    var widgets []WidgetConfig
    for _, id := range dashboardWidgetIDs {
      widget, err := FindWidgetConfigByID(db, id)
      if err != nil {
        return nil, err
      }
      widgets = append(widgets, widget)
    }
    return widgets, nil
  }
  ```

## 4. Automated Enforcement

- **LLM Policy Check** (`checkPoliciesWithLLM`) — nhận diện N+1 pattern, cache thiếu invalidation,
  và mã hoá đồng bộ trên hot path đều cần đọc hiểu luồng dữ liệu, không có checker tất định.

## 5. Remediation & Escalation Guide

- **Tự sửa:** gộp query thành batch/`IN (...)`; thêm lời gọi invalidate cache đi kèm mọi chỗ thay
  đổi quyền; chuyển mã hoá chi phí cao sang worker/queue nếu ảnh hưởng rõ rệt latency.
- **Nghi ngờ false positive:** dùng luồng "yêu cầu bypass" trên dashboard — `severity: medium`,
  chặn push nhưng không thuộc mức khẩn cấp `critical`.
