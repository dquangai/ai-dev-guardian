# AI Dev Guardian

AI Engineering Governance Agent — kiểm soát tuân thủ code trước khi push/merge vào codebase.

Trước khi code được push lên Git, `guardian` tự động kiểm tra diff so với **Project Policy**
của dự án (`.guardian/policies/*.md`) bằng hai cơ chế:

- **Deterministic** — regex secret scan (AWS key, generic API key/token/password, PEM private
  key block, Slack/GitHub token...), không cần gọi LLM.
- **LLM Reasoning** — Claude (Anthropic) hoặc GPT (OpenAI) đọc diff + các policy có scope khớp
  với file thay đổi, trả về danh sách vi phạm có cấu trúc (tool/function calling, không parse
  free-text). Chạy theo kiểu **map-reduce từng file**: mỗi file thay đổi được đánh giá riêng, kèm
  nội dung hiện tại của file (nếu đọc được) để có đủ ngữ cảnh ngoài vùng diff, và chỉ nhận đúng
  tập policy khớp scope của file đó — tránh việc policy của file này bị gán nhầm cho file khác.
  Model bắt buộc chọn `policyId` trong đúng danh sách policy đã đưa (JSON Schema `enum`); nội dung
  "vi phạm policy nào" trong báo cáo cuối cùng luôn được dựng lại từ policy thật đã load, không
  bao giờ lấy nguyên văn text tự do từ model (grounding — chống hallucination).

**Cache LLM check**: `guardian` lưu SHA-256 hash của diff lần chạy PASS gần nhất vào
`.git/guardian_cache.json` (không track/push, an toàn). Nếu diff push tiếp theo giống hệt hash
đã lưu, LLM check bị bỏ qua hoàn toàn (secretScan vẫn luôn chạy vì miễn phí) — tránh trả tiền
API cho cùng một đoạn diff không đổi. Kết quả `BLOCK` không bao giờ được cache, để đảm bảo mọi
lần sửa lỗi đều được quét lại từ đầu.

Mỗi vi phạm được báo cáo theo đúng 6 trường trong đề xuất sản phẩm: **lỗi gì, vi phạm policy
nào, mức độ rủi ro, tại sao sai, cách sửa, tự động tạo bản sửa** (trường cuối luôn `null` ở MVP
này — dành cho Phase 2).

## Cài đặt

```bash
npm install
npm run build
npm link   # để lệnh `guardian` gọi được toàn cục, hoặc dùng `node dist/cli.js`
```

Tạo file `.env` ở gốc project (đã có sẵn trong `.gitignore`, không bị commit) và điền API key:

```bash
# .env — chỉ cần điền MỘT trong hai key dưới đây
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Tuỳ chọn: ép provider khi cả hai key đều được set ("anthropic" | "openai")
GUARDIAN_LLM_PROVIDER=

# Tuỳ chọn: đổi model mặc định (mặc định claude-sonnet-5 / gpt-4.1)
GUARDIAN_LLM_MODEL=
```

Nếu chỉ set một key, `guardian` tự dùng đúng provider đó. Nếu set cả hai mà không có
`GUARDIAN_LLM_PROVIDER`, Anthropic được ưu tiên. Thiếu cả hai thì `guardian` vẫn chạy secret
scan bình thường, chỉ bỏ qua phần kiểm tra policy bằng LLM (có log cảnh báo).

## Sử dụng

```bash
# Kiểm tra tay các thay đổi đã staged, trước khi commit
guardian check --staged

# Cài git pre-push hook — mỗi lần `git push` sẽ tự chạy `guardian check`
guardian install-hook
```

Khi được kích hoạt qua pre-push hook (không dùng `--staged`), `guardian` hỏi xác nhận trước khi
chạy: `Bạn có muốn chạy AI Dev Guardian để kiểm tra code trước khi push không? (Y/n):`. Gõ `Y`
hoặc Enter để chạy kiểm tra như bình thường; gõ `N` để bỏ qua và cho phép push ngay (exit code 0).
Vì stdin lúc này đã bị Git chiếm dụng để truyền ref info, prompt đọc trực tiếp từ thiết bị terminal
(`/dev/tty` trên Unix, `CONIN$` trên Windows) — nếu không có terminal tương tác thật (CI, script
tự động...) hoặc không nhận được phản hồi trong 20 giây, `guardian` tự động tiếp tục chạy kiểm tra
như trước đây (fail-open), không bao giờ treo vô thời hạn.

Thoát code `1` khi verdict là `BLOCK` (có vi phạm mức `medium` trở lên), `0` khi `PASS`.

## Viết Project Policy

Mỗi file trong `.guardian/policies/*.md` là một policy: YAML frontmatter + nội dung Markdown
(nội dung được đưa thẳng cho LLM, không qua xử lý trung gian).

```markdown
---
category: Security Policy
scope: ["src/**/*.ts"]   # rỗng ([]) nghĩa là áp dụng toàn cục
severity: critical        # low | medium | high | critical
tags: [security]
---

Nội dung quy định, viết như đang giải thích cho một developer.
```

`scope` dùng glob (qua `micromatch`) để chỉ gửi policy liên quan tới các file đã thay đổi cho
LLM — tránh nhồi toàn bộ policy library vào mỗi lần gọi.

## Test

```bash
npm test
```

## Phạm vi MVP hiện tại

Đã có: secret scan + LLM policy check (Security Policy, Coding Convention), CLI local, git
pre-push hook. Chưa có (fast-follow): CI/GitHub Action gate, tích hợp Jira, sinh auto-fix, các
category còn lại (Architecture Rules, Git Workflow, Testing Standards, Dependency Rules,
Business Requirements).
