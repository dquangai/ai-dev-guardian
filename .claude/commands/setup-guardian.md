---
description: Cài đặt AI Dev Guardian cho repo này — build CLI, cấu hình API key, cài pre-push hook. Dùng khi 1 dev mới clone repo ai-dev-guardian và cần setup môi trường dev.
---

Setup môi trường dev cho repo `ai-dev-guardian` (chính repo đang mở, không phải áp dụng
Guardian vào 1 project khác — nếu người dùng nói tới project khác, hỏi lại rõ trước khi làm gì).

Thực hiện theo đúng thứ tự sau, không bỏ bước:

1. Kiểm tra `.env` ở gốc repo có `ANTHROPIC_API_KEY` hoặc `OPENAI_API_KEY` đã điền chưa (đọc file
   trực tiếp, không đoán). Nếu chưa có key nào:
   - Hỏi người dùng có muốn cung cấp 1 API key (Anthropic hoặc OpenAI) ngay bây giờ không, hay bỏ
     qua để tự điền `.env` thủ công sau (thiếu key thì `guardian check` vẫn chạy được — chỉ riêng
     LLM Policy Check tự bỏ qua, 3 check còn lại vẫn hoạt động bình thường).
   - Nếu người dùng cung cấp key: nếu `.env` chưa tồn tại, copy từ `.env.example` trước; sau đó
     dùng Edit để điền đúng dòng `ANTHROPIC_API_KEY=...` hoặc `OPENAI_API_KEY=...` tương ứng. File
     `.env` đã nằm trong `.gitignore` — không commit, không in lại key ra chat sau khi ghi xong.
2. Chạy `npm run setup` qua Bash — script này (`scripts/setup.mjs`) tự làm: `npm install` (root +
   web), `npm run build:all`, `npm link` (expose lệnh `guardian` global trỏ vào dist/ repo này),
   `guardian install-hook` (cài git pre-push hook cho repo này), và verify bằng
   `guardian check --staged`. Script tự bỏ qua bước hỏi API key vì bước 1 đã lo xong (script chạy
   qua Bash không có TTY nên tự phát hiện và skip phần prompt tương tác của chính nó).
3. Đọc output thật của bước 2 — nếu `npm link` hoặc cài hook báo lỗi (thường do quyền ghi thư mục
   global npm), báo rõ lỗi thật cho người dùng kèm gợi ý trong log (sudo hoặc dùng nvm), không tự
   ý chạy `sudo` thay người dùng.
4. Tóm tắt ngắn gọn kết quả: bước nào xong, bước nào cần người dùng tự làm tiếp (nếu có), và nhắc
   từ giờ `git push` trong repo này sẽ tự chạy `guardian check`.
