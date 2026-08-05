# Báo cáo tiến độ — AI Dev Guardian

**Ngày:** 29/07/2026
**Người thực hiện:** Đoàn Minh Quang
**Gửi:** Mentor

---

## 1. Tổng quan

Hôm nay tập trung vào 2 mảng chính: (1) mở rộng năng lực kiểm tra deterministic của Guardian bằng
cách tích hợp thêm 3 công cụ ngoài (madge, ast-grep, Semgrep), và (2) phát hiện + xử lý một vấn đề
thực tế nghiêm trọng — **LLM policy check bị "semantic hallucination" có hệ thống**, tức là model
trích dẫn đúng đoạn code/comment có thật (nên vượt qua được các lớp kiểm chứng đã có) nhưng diễn
giải sai ý nghĩa của nó, dẫn tới báo vi phạm giả. Vấn đề này đã **chặn thật một lần push** trong
lúc làm việc — được dùng làm ca kiểm thử thực tế xuyên suốt cả ngày để đo hiệu quả từng bước fix.

Tổng cộng: **7 commit**, test suite tăng từ 79 → 123 test (đều pass), build TypeScript sạch sau mỗi
bước.

## 2. Nghiên cứu & định hướng

- Nghiên cứu repo `arcade-agent` (dự án phân tích kiến trúc phần mềm dùng Python/MCP) để tìm ý
  tưởng áp dụng cho Guardian — dù mục tiêu 2 dự án khác nhau (Guardian là gate diff theo policy,
  arcade-agent là công cụ phân tích kiến trúc toàn repo).
- Rút ra và áp dụng 2 ý tưởng có giá trị thực: cache nhớ nhiều kết quả (không chỉ 1) và mở rộng
  RAG-lite ra đa ngôn ngữ.
- Viết lại `README.md` 2 lần theo hướng ngày càng kỹ thuật hơn — lần cuối theo phong cách
  reference/technical (tham chiếu trực tiếp tên hàm, file, hằng số cấu hình thật) thay vì văn phong
  marketing.

## 3. Các tính năng đã hoàn thành trong ngày

### 3.1. Nền tảng cache & RAG-lite
- Cache PASS chuyển từ nhớ 1 hash sang **LRU 20 hash gần nhất** (`src/cache.ts`) — không mất cache
  khi chuyển qua lại giữa các nhánh git.
- RAG-lite (đọc file liên quan để bổ sung ngữ cảnh cho LLM) mở rộng từ chỉ TS/JS sang thêm
  **Python, C/C++, Go** (`src/checks/llm/fileContext.ts`), mỗi ngôn ngữ có thuật toán resolve import
  riêng phù hợp cú pháp.

### 3.2. Ba check deterministic mới (không cần LLM, miễn phí hoặc tuỳ chọn)
| Check | Công cụ | Mô tả |
|---|---|---|
| Circular dependency | [madge](https://github.com/pahen/madge) | Phát hiện phụ thuộc vòng giữa các module TS/JS, chỉ báo cáo vòng nào đụng tới file trong diff hiện tại |
| RAG-lite chính xác hơn | [ast-grep](https://ast-grep.github.io/) | Thay regex tay bằng parser thật (tree-sitter) để trích import/re-export/require cho TS/JS, có fallback về regex nếu lỗi |
| Security rule scan | [Semgrep](https://semgrep.dev/) (tuỳ chọn) | Chạy ruleset bảo mật cộng đồng nếu máy có cài binary `semgrep`, tự bỏ qua an toàn nếu không có |

Cả 3 đều wiring vào `src/orchestrator.ts`, chạy song song với secret scan và LLM check qua
`Promise.all`, theo đúng pattern dependency-injection đã có sẵn của dự án.

### 3.3. Phát hiện & xử lý Semantic Hallucination — phần trọng tâm trong ngày

**Vấn đề phát hiện:** LLM policy check nhiều lần báo vi phạm giả nhưng vẫn trích dẫn "bằng chứng"
có thật trong code — ví dụ: đọc thấy chữ tiếng Anh "any" trong 1 câu comment rồi kết luận sai là code
dùng kiểu TypeScript `any`; hoặc khẳng định 1 hàm 24 dòng "có hơn 50 dòng" — lặp lại **3 lần liên
tiếp trên cùng 1 hàm**, đủ nghiêm trọng (severity medium) để **chặn thật một lần push** trong ngày.

**4 lớp phòng vệ đã xây dựng, theo đúng thứ tự triển khai:**

1. **Evidence grounding** — bắt buộc model trích dẫn `evidenceSnippet` khớp verbatim với diff thật,
   loại bỏ claim không trỏ vào code thật.
2. **Few-shot examples trong policy** — cho phép file `.guardian/policies/*.md` chứa ví dụ
   "vi phạm / không vi phạm" ngay trong luật, tự động vào prompt mà không cần sửa code.
3. **AST annotation (comment vs. code)** — dùng ast-grep bọc mọi comment/string bằng tag
   `<comment>`/`<string>` trước khi đưa cho LLM đọc, để model không nhầm văn bản mô tả với code
   đang thực thi.
4. **Chain-of-Thought bắt buộc** — thêm field `reasoning` đứng đầu schema, ép model tự suy luận
   (code làm gì → policy yêu cầu gì → có thật sự vi phạm không) trước khi kết luận.

**Kết quả sau 4 lớp trên:** giảm rõ rệt nhưng **chưa triệt để** — hallucination về "any" và về
circular dependency tự tham chiếu vẫn tái lặp ở dạng khác (model chuyển sang trích dẫn dòng code
thật khác, không còn là comment, nên annotation không chặn được).

**Lớp thứ 5 — LLM-as-a-Judge:** thêm 1 lượt xác minh độc lập, khung câu hỏi khác hẳn, áp dụng cho
**mọi** vi phạm còn sống sót (không chỉ severity `critical` như self-consistency cũ). Judge dùng
cùng provider/API key nhưng model rẻ/nhanh hơn (`GUARDIAN_JUDGE_MODEL`, mặc định Haiku cho
Anthropic), được yêu cầu **tự đếm/đọc lại** bằng chứng trên nội dung file thật thay vì tin lại số
liệu model trước đã đưa ra. Chỉ tốn thêm đúng 1 lượt gọi/file có vi phạm, không tốn gì trên file
sạch, và **fail-open tuyệt đối** — lỗi hoặc thiếu key không bao giờ làm mất đi 1 vi phạm thật.

**Kiểm chứng cuối cùng bằng dữ liệu thật** (chạy lại đúng diff đã từng gây lỗi thật): cả 3 claim
"dùng any" từng sống sót qua grounding lần này đều bị judge bác bỏ với lý do chính xác (tự đếm lại
code, xác nhận không có `any`) — **verdict đổi từ BLOCK sang PASS**.

## 4. Số liệu

- Test: 79 → **123** (tăng 44 test mới, tất cả pass)
- File mới: `architectureCheck.ts`, `semgrepCheck.ts`, `diffLines.ts`, `annotate.ts`, `madge.d.ts` +
  test tương ứng
- Commit trong ngày: 7 (madge/ast-grep/semgrep, README kỹ thuật, evidence-grounding ban đầu,
  few-shot + annotation + CoT, LLM-as-a-Judge, README cập nhật cuối)
- `npm run build` sạch sau mọi commit

## 5. Vấn đề còn tồn đọng (chưa giải quyết, ghi nhận minh bạch)

- Model mặc định của judge cho OpenAI (`gpt-4.1-mini`) là phỏng đoán hợp lý, **chưa xác minh thực
  tế** — cần kiểm tra khi có tài khoản OpenAI thật.
- Vẫn còn 1 loại nhiễu residual: model đôi khi nhầm `Partial<T>` với `any`, hoặc đưa ra vài nhận xét
  Coding Convention vụn/pedantic ở mức `low` (không chặn push, nhưng chưa hoàn toàn sạch).
- `checkCircularDependencies` hiện gán cứng `riskLevel: "medium"`, chưa cấu hình được qua policy
  file như các check khác.
- Rủi ro prompt-injection lý thuyết qua chính nội dung diff gửi cho judge — đã có câu chặn trong
  prompt nhưng chưa có kiểm thử đối kháng (red-team) thực sự.

## 6. Kế hoạch dự kiến ngày mai

1. Theo dõi judge pass trên vài lần push thực tế tiếp theo — xác nhận không phát sinh false-negative
   (judge lỡ bỏ qua 1 vi phạm thật) và đo chi phí/latency thực tế.
2. Xác minh lại model mặc định `gpt-4.1-mini` cho nhánh OpenAI, điều chỉnh nếu sai tên.
3. Bắt đầu hạng mục tiếp theo trong roadmap — ưu tiên **CI/GitHub Action gate** (chạy Guardian trên
   PR, baseline dùng chung cho cả team) hoặc **Architecture Rules policy category** (rule
   dependency-direction do dev tự định nghĩa trong policy, tái dùng logic RAG-lite đã có, không cần
   gọi LLM) — sẽ chốt hướng cụ thể đầu giờ sáng.
4. Dọn dẹp nợ kỹ thuật nhỏ: cấu hình severity cho circular-dependency check qua policy file thay vì
   hardcode.
