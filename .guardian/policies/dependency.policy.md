---
category: Dependency
scope: ["package.json"]
severity: medium
tags: [dependency, supply-chain]
dependencyAllowlist:
  - "@anthropic-ai/*"
  - "@ast-grep/*"
  - "@types/*"
  - chalk
  - commander
  - concurrently
  - cors
  - dotenv
  - express
  - gray-matter
  - madge
  - micromatch
  - openai
  - simple-git
  - tsx
  - typescript
  - vitest
---

# Dependency Policy

Mọi dependency mới thêm vào `package.json` phải nằm trong danh sách `dependencyAllowlist` ở trên
(kiểm tra tự động, xem `dependencyRulesCheck.ts`) — nâng cấp version của dependency đã có sẵn không
bị ảnh hưởng bởi rule này.

- Không thêm dependency mới chỉ để dùng 1 hàm tiện ích nhỏ có thể tự viết trong vài dòng.
- Dependency mới phải có lịch sử bảo trì tốt (còn cập nhật, không có lỗ hổng bảo mật đã biết công
  khai) trước khi được thêm vào allowlist.
- Nếu thực sự cần một dependency mới, thêm tên (hoặc glob pattern, ví dụ `@scope/*`) của nó vào
  `dependencyAllowlist` trong policy này như một phần của PR, không thêm âm thầm.
