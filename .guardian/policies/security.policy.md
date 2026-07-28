---
category: Security Policy
scope: []
severity: critical
tags: [security, secrets, input-validation]
---

# Security Policy

- Không hardcode secret, API key, token, mật khẩu, connection string trực tiếp trong source code — luôn dùng biến môi trường hoặc secret manager.
- Không log giá trị nhạy cảm (mật khẩu, token, PII, số thẻ...) ra console hoặc file log.
- Input từ người dùng hoặc hệ thống bên ngoài phải được validate/sanitize trước khi dùng trong query, command, hoặc render ra HTML (tránh SQL injection, command injection, XSS).
- Không tắt, comment-out, hoặc bỏ qua cơ chế xác thực (authentication) hay phân quyền (authorization) chỉ để "tiện test" hoặc "sửa nhanh".
- Không tự ý hạ cấp thuật toán mã hoá/hash (ví dụ dùng MD5/SHA1 cho mật khẩu) hoặc tắt xác thực TLS/certificate.
