---
category: Coding Convention
scope: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"]
severity: low
tags: [style, naming, readability]
---

# Coding Convention

- Đặt tên biến, hàm theo camelCase; tên class/type/interface theo PascalCase; hằng số toàn cục theo UPPER_SNAKE_CASE.
- Không để lại code đã comment-out, `console.log` debug, hoặc TODO không có ngữ cảnh trong code chuẩn bị merge.
- Hàm/method nên có một trách nhiệm rõ ràng; tránh hàm quá dài (>50 dòng) gộp nhiều việc không liên quan.
- Không dùng `any` trong TypeScript trừ khi có comment giải thích rõ lý do vì sao không thể type chặt hơn.
