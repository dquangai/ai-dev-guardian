---
category: Security Policy
scope: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"]
severity: critical
tags: [security, secrets, input-validation]
---

# Security Policy

Chỉ đánh giá dựa trên HÀNH VI THỰC TẾ của code trong diff. Việc code/comment/tài liệu chỉ NHẮC TỚI
hoặc GIẢI THÍCH một khái niệm bảo mật (ví dụ: mô tả rule "không hardcode secret") không phải là vi
phạm — chỉ vi phạm khi code thực sự làm điều bị cấm.

Ví dụ KHÔNG vi phạm: một chuỗi string trong code là văn bản giải thích/thông báo lỗi bằng tiếng
Việt hoặc tiếng Anh (ví dụ nội dung gán cho biến `why`, `errorWhat`, `promptToFix` trong chính
source code của Guardian, hoặc bất kỳ message hiển thị cho người dùng nào) — đây là dữ liệu tĩnh
mô tả một khái niệm, không phải là báo cáo về trạng thái thật của codebase. Không được coi nội
dung của một string như vậy là bằng chứng cho một vi phạm khác đang tồn tại.

- Không hardcode secret thật (API key, token, mật khẩu, connection string, private key) có giá trị
  trông giống thông tin đăng nhập thật vào source code — dùng biến môi trường hoặc secret manager.
  KHÔNG tính là vi phạm: hằng số kỹ thuật không phải credential (git SHA cố định, tên model, tên
  field/property, magic string, enum value, hoặc placeholder ví dụ dạng `sk-ant-...`/`xxx` trong
  tài liệu/comment).
- Không log giá trị nhạy cảm (mật khẩu, token, PII, số thẻ...) ra console hoặc file log. Log
  thông báo lỗi hoặc kết quả kiểm tra (không chứa credential thật) không tính là vi phạm.
- Input từ người dùng hoặc hệ thống bên ngoài phải được validate/sanitize trước khi dùng trong
  query, command, hoặc render ra HTML (tránh SQL injection, command injection, XSS). Chỉ áp dụng
  khi code thực sự nhận input từ nguồn không tin cậy (network request, form, file upload...).
- Không tắt, comment-out, hoặc bỏ qua cơ chế xác thực (authentication) hay phân quyền
  (authorization) đã tồn tại trong code chỉ để "tiện test" hay "sửa nhanh". KHÔNG áp dụng cho code
  vốn dĩ không cần xác thực (ví dụ: CLI tool chạy local, không expose network service).
- Không tự ý hạ cấp thuật toán mã hoá/hash (ví dụ dùng MD5/SHA1 cho mật khẩu) hoặc tắt xác thực
  TLS/certificate.
