---
category: Architecture
scope: ["src/**/*.ts", "src/**/*.tsx", "src/**/*.js", "src/**/*.jsx"]
severity: high
tags: [architecture, layering, dependency]
rules:
  - from: "src/policy/**"
    forbid: "src/checks/**"
    description: "Lớp policy (load/route file .policy.md) là tầng thấp nhất; checks mới là bên đọc và dùng policy, không phải ngược lại — import ngược sẽ tạo circular dependency giữa hai tầng."
  - from: "src/git/**"
    forbid: "src/cli.ts"
    description: "Tiện ích đọc git diff là tầng thấp, dùng chung cho mọi entrypoint (CLI, test); phụ thuộc vào cli.ts sẽ khiến nó không thể tái sử dụng hay test độc lập ngoài CLI."
---

# Architecture Policy

Guardian tổ chức code theo layer: `git/` (đọc diff) → `policy/` (đọc & route policy) →
`checks/` (áp policy lên diff) → `orchestrator.ts` / `cli.ts` / `src/server/**` (điều phối,
entrypoint). Một layer chỉ được phụ thuộc vào layer cùng cấp hoặc thấp hơn, không bao giờ phụ
thuộc ngược lên layer cao hơn nó. Các cặp import bị cấm tường minh được kiểm tra tự động qua `rules`
ở trên (`architectureRulesCheck.ts`).

- Không tạo circular dependency giữa các module (kiểm tra tự động qua `architectureCheck.ts`).
- Không để logic nghiệp vụ (business logic) nằm trong `cli.ts` — file này chỉ được phép parse
  argument, gọi hàm ở layer thấp hơn, và in/ghi kết quả ra ngoài.
- Một module ở layer thấp (`git/`, `policy/`) không được import bất cứ thứ gì từ layer cao hơn nó
  (`checks/`, `orchestrator.ts`, `cli.ts`).
- `src/server/**` (Express API cho web dashboard) là một entrypoint ngang hàng với `cli.ts` — CẢ HAI
  cùng là "điều phối, entrypoint" trong sơ đồ layer ở trên, không phải business logic. Một route
  handler trong `src/server/routes/**` gọi thẳng `runGuardianCheck` từ `orchestrator.ts`, hoặc
  `cli.ts` gọi `startServer()` từ `src/server/index.ts`, đều là "gọi hàm ở layer thấp hơn/ngang
  hàng" — hợp lệ, KHÔNG tính là vi phạm, y hệt cách `cli.ts` vốn đã gọi thẳng `runGuardianCheck` từ
  lâu mà không bị coi là vi phạm.
