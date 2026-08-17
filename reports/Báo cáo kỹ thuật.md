# Báo cáo Kỹ thuật: AI Dev Guardian

### AI Engineering Governance Agent — Người gác cổng chất lượng code trước mỗi lần `git push`

*Phiên bản: v0.1.0 — Level 5 Enterprise Automation · Ngày cập nhật: 13/08/2026*

> Đã publish công khai trên npm (`ai-dev-guardian@0.1.0`) · **Recall 96.1% / Precision 94.2% / FPR
> 6.1%** đo thật trên Golden Dataset 100 case (Mục 4) · Dashboard quản trị + RBAC 4 vai trò +
> phân quyền đa Team bằng OpenFGA/ReBAC đã chạy được (Mục 8) — không còn là MVP đơn lẻ CLI.

---

## 1. Bài toán: Tam giác thất bại của các công cụ Code Review hiện nay

Hiện tại, các engineering team phải đối mặt với "tam giác đánh đổi" không thể dung hòa từ 3 lớp
bảo vệ truyền thống — nâng cấp một lớp không giải quyết được điểm yếu của 2 lớp còn lại:

**1. Human Code Review (thủ công)** — Phụ thuộc hoàn toàn vào băng thông và sự tập trung của
reviewer. Khi team mở rộng hoặc nhịp độ release tăng, review thủ công trở thành "nút thắt cổ chai"
(bottleneck) làm chậm tiến độ, hoặc bị làm qua loa dẫn đến sót lỗi nghiệp vụ nghiêm trọng.

**2. Static Analysis / Linter truyền thống (Deterministic)** — Bắt lỗi cú pháp rất tốt nhưng hoàn
toàn "mù" trước context và logic nghiệp vụ riêng của từng dự án. Bên cạnh đó, việc cấu hình luật
rất phức tạp (phải học các ngôn ngữ DSL/Rego hoặc viết file YAML rườm rà).

**3. AI Reviewer thế hệ đầu (Post-push / Pull Request Bots)** — mắc cùng lúc 3 lỗi cấu trúc:

- *Sai vị trí (Wrong Gate)* — Hầu hết chạy ở tầng CI/CD hoặc PR Bot trên GitHub/GitLab. Dev phải
  chờ push code lên mới nhận phản hồi, gây ngắt quãng luồng làm việc (context switching) và tốn
  chi phí CI/Compute không cần thiết.
- *Thảm họa Hallucination* — Ảo giác của LLM khiến nó tự tin cảnh báo sai (false positive) — ví
  dụ: đếm sai số dòng code, bắt lỗi không tồn tại. Hệ quả là dev bị kiệt sức vì cảnh báo rác (alert
  fatigue) và dần bỏ qua mọi gợi ý của AI.
- *Rủi ro Auto-fix âm thầm* — Nhiều công cụ cố tình tự động sửa code (auto-patch). Một bản patch
  sai do AI sinh ra nếu lọt qua review sẽ âm thầm đưa bug nghiêm trọng vào sản phẩm.

Đây chính là khoảng trống mà AI Dev Guardian được thiết kế để lấp đầy: chặn đúng chỗ (trước push,
không phải sau), hiểu đúng ngữ cảnh (Policy-as-Code, không phải DSL cứng), và không tự ý sửa code
thay con người.

## 2. Giải pháp

**AI Dev Guardian** là một agent quản trị kỹ thuật (Engineering Governance Agent) chạy như một
**pre-push gate**: kiểm tra diff *trước khi* code rời máy dev, không phải dọn dẹp *sau khi* đã
lên remote.

Nguyên lý thiết kế cốt lõi:

- **Deterministic + Probabilistic kết hợp** — luật kiểm tra chắc chắn (secret lộ, circular
  dependency, static analysis rule) chạy bằng công cụ xác định 100%; chỉ những gì thực sự cần
  *hiểu ngữ nghĩa* mới giao cho LLM.
- **Policy-as-Code** — luật không phải cấu hình cứng từ nhà cung cấp, mà là file Markdown do
  chính team viết (`.guardian/policies/*.md`), LLM đọc và áp dụng trực tiếp.
- **Không tự động vá code** — mọi vi phạm chỉ đi kèm một `promptToFix` sẵn sàng copy-paste vào AI
  assistant của chính dev — quyết định sửa thế nào vẫn luôn thuộc về con người.
- **Một verdict duy nhất** — `PASS` hoặc `BLOCK`, không có vùng xám.

### So sánh với các công cụ hiện có

| Tiêu chí | Human Review (thủ công) | Static Analysis (ESLint, SonarQube...) | AI PR Bot thế hệ đầu (CodeRabbit, Copilot Review...) | **AI Dev Guardian** |
|---|---|---|---|---|
| Thời điểm chạy | Sau khi mở PR, phụ thuộc lịch reviewer | IDE/CI | Sau khi push — tầng CI/CD hoặc PR bot | **Trước khi push** — git hook cục bộ |
| Hiểu logic nghiệp vụ riêng | Có, nhưng cảm tính, không nhất quán | Không — chỉ bắt cú pháp/style | Có phần, nhưng không cho định nghĩa Policy-as-Code riêng | **Có** — Policy-as-Code bằng Markdown |
| Cấu hình luật | Không cấu hình được | Phức tạp — cần học DSL/Rego hoặc YAML rườm rà | Thường giới hạn qua UI/prompt cố định | 1 file Markdown + YAML frontmatter, viết như giải thích cho đồng nghiệp |
| Chống Hallucination | N/A (con người vẫn có thể sai/sót) | N/A (deterministic, không dùng LLM) | Thường 1 lượt LLM, không công khai cơ chế xác minh độc lập | **5 lớp**: grounding, CoT, self-consistency, AI-as-Judge, RAG-lite |
| Auto-fix code | Không | Có (`--fix`) nhưng chỉ cho rule cứng, an toàn | Một số tự động đề xuất/commit fix — rủi ro patch sai âm thầm | **Không bao giờ** — chỉ sinh `promptToFix` |
| Chi phí vận hành | Thời gian reviewer (khó định lượng, luôn tốn) | Miễn phí | Thuê bao theo seat, phổ biến ~10-20 USD/dev/tháng | Trả theo token thực tế + cache — ~$3-4/dev/tháng (mục 8) |
| Nút thắt khi team scale | Có — bottleneck rõ rệt | Không | Không, nhưng cộng dồn chi phí CI/compute | Không — chạy song song, cache tái sử dụng |

*Đặc điểm của các công cụ bên thứ ba trong bảng trên phản ánh xu hướng chung của nhóm sản phẩm,
không phải benchmark đo trực tiếp trên phiên bản mới nhất của từng công cụ.*

## 3. Tính năng & Công nghệ lõi

| Nhóm | Tính năng | Công nghệ lõi |
|---|---|---|
| Kiểm tra xác định | Secret Scan | Regex trên các dòng diff mới thêm (`+`) |
| Kiểm tra xác định | Architecture Check | `madge` — phát hiện circular dependency, chỉ báo cáo cycle liên quan tới diff; severity đọc từ policy sở hữu `rules`, không hardcode |
| Kiểm tra xác định | Architecture Rules | Rule `from`/`forbid` khai báo trong frontmatter policy, đối chiếu bằng `micromatch` trên dependency graph của `madge` — chặn import trái layer |
| Kiểm tra xác định | Dependency Rules | Đối chiếu dependency mới thêm vào `package.json` (phân biệt với version bump) với `dependencyAllowlist` khai báo trong policy, xác thực chéo với `package.json` thật trên đĩa |
| Kiểm tra xác định | Semgrep Check (tuỳ chọn) | Binary `semgrep`, ruleset `p/security-audit`, lọc theo dòng diff thật đã thêm |
| Kiểm tra ngữ nghĩa | LLM Policy Check | Anthropic Claude / OpenAI GPT, 1 lần gọi/file, chỉ kèm policy đúng scope |
| Ngữ cảnh | RAG-lite | Đọc thêm tối đa 3 file vệ tinh được import trực tiếp — TS/JS, Python, C/C++, Go |
| Hiệu năng | Diff-hash caching | SHA-256, LRU 20 hash `PASS` gần nhất, lưu tại `.git/guardian_cache.json` |
| An toàn | Prompt-as-a-Fix | Không tự sinh code vá lỗi — chỉ sinh prompt nhờ AI khác sửa, 1 template chuẩn dùng chung |
| Vận hành | Interactive Git Hook | `guardian install-hook`, hỏi `Y/n` khi có TTY, fail-open khi chạy trong CI |
| Vận hành | CI Gate (`--ci`) | GitHub Actions (`pull_request`), diff `origin/<base>...HEAD`, post/update comment Markdown trên PR qua GitHub REST API |

### 5 lớp khiên chống ảo giác LLM — chi tiết kỹ thuật (phần lõi của dự án)

Đây là phần kỹ thuật quan trọng nhất của AI Dev Guardian. Thay vì tin tưởng mù quáng vào một lượt
gọi LLM duy nhất, mỗi vi phạm phải **sống sót qua 5 lớp kiểm tra độc lập, xếp chồng lên nhau** —
mỗi lớp chặn đúng một *loại* lỗi khác nhau mà LLM có thể mắc phải. Bỏ bất kỳ lớp nào cũng để lọt
một kiểu hallucination cụ thể đã được quan sát thấy trong thực tế khi xây dựng dự án này.

**Lớp 1 — Grounding theo schema (chống bịa policy).** `policyId` model trả về bị ràng buộc bằng
`enum` trong JSON Schema (`buildViolationsSchema()`, `src/checks/llm/types.ts`), chỉ chứa đúng
danh sách id của các policy đã thực sự được nạp cho file đang xét (qua `routePolicies()`). Cơ chế
structured tool-calling khiến model **không thể** trả về một giá trị nằm ngoài enum này — response
sai sẽ bị chặn ở tầng API trước khi tới được code của Guardian. `policyViolated` hiển thị cho dev
cuối cùng luôn được Guardian tự ghép lại từ policy thật (`policy.category (${policy.id})`), không
bao giờ lấy nguyên văn lời model.

**Lớp 2 — Reasoning-first (buộc suy luận trước khi kết luận).** Field `reasoning` được khai báo
**đầu tiên** trong JSON Schema — trước cả `errorWhat`, `policyId`, `riskLevel`. Với cơ chế sinh
token tuần tự của structured output, thứ tự field trong schema quyết định thứ tự model buộc phải
điền: (1) đoạn code này thực sự làm gì, (2) policy yêu cầu gì, (3) có thực sự mâu thuẫn hay chỉ
*giống bề ngoài* — trước khi được phép chốt verdict. Đây là chain-of-thought có cấu trúc bắt buộc
bởi schema, không phải một câu "hãy suy nghĩ từng bước" chung chung trong prompt.

**Lớp 3 — Grounded Evidence (chống bịa bằng chứng).** `evidenceSnippet` phải là (các) dòng trích
dẫn **y hệt** tồn tại trong diff thật — hàm `isEvidenceGrounded()` (`llmPolicyCheck.ts`) tách từng
dòng, trim, và bắt buộc mỗi dòng phải xuất hiện verbatim trong nội dung diff thật; dòng nào chỉ
nằm trong comment bị loại khỏi tập bằng chứng hợp lệ. Lớp này chặn đúng case đã xảy ra thật: model
trích dẫn *đúng* dòng JSDoc `// Fail-safe: any madge error...` làm bằng chứng cho việc "code dùng
kiểu `any`" — trích dẫn có thật (grounding lớp 3 vẫn pass), nhưng dòng đó chỉ là văn xuôi mô tả,
không phải code thực thi kiểu `any`. Vì vậy Guardian còn AST-annotate nội dung file trước khi gửi
cho model: mọi comment/string được bọc tag `<comment>...</comment>` / `<string>...</string>`, và
prompt yêu cầu model không bao giờ tính nội dung trong `<comment>` là code đang thực thi.

**Lớp 4 — Self-consistency (xác nhận lại phát hiện critical).** `critical` là mức độ duy nhất tự
nó chặn được push, nên phải chịu một bài kiểm tra khắt khe hơn: khi lượt gọi đầu tiên phát hiện
bất kỳ vi phạm `critical` nào, `checkPoliciesWithLLM` gọi lại **y hệt prompt đó lần thứ 2** trên
cùng file, và chỉ giữ vi phạm nếu `policyId` xuất hiện ở **cả hai** lượt. Model bất đồng với chính
nó giữa 2 lần hỏi độc lập bị xem là false positive và bị loại. Cái giá chỉ là 1 lượt gọi thêm — và
chỉ tốn khi push thực sự chứa phát hiện critical, không phải mọi lần push.

**Lớp 5 — AI-as-a-Judge (phúc thẩm độc lập).** Lớp cuối, áp dụng cho **mọi** vi phạm sống sót
(không chỉ critical): một model thứ hai — độc lập, được đóng khung câu hỏi khác hẳn qua
`buildJudgePrompt()` — nhận lại đúng file/diff thật và được yêu cầu **tự đếm lại/tự suy luận lại**
từng claim từ đầu, không được tin lại reasoning gốc hay số liệu model đầu đã đưa ra. Đây là lớp
duy nhất bắt được lỗi mà grounding (lớp 3) không thể: model trích dẫn **đúng** một đoạn code thật
nhưng khẳng định **sai** một điều gì đó về nó. Case đã xảy ra thật: một hàm 24 dòng bị model đầu
khẳng định "dài hơn 50 dòng" và chặn push 3 lần liên tiếp — judge đếm lại đúng 24 dòng và lật
verdict từ `BLOCK` sang `PASS`. Judge dùng model rẻ hơn (`claude-haiku-4-5` / `gpt-4.1-mini`), chỉ
tốn 1 lượt gọi thêm mỗi **file** có vi phạm (không phải mỗi vi phạm), và **fail-open**: lỗi mạng
hay thiếu key ở judge không bao giờ làm mất đi một vi phạm hợp lệ — nó chỉ có thể *loại bỏ* false
positive, không bao giờ làm Guardian kém tin cậy hơn trước khi có lớp này.

**Vì sao phải xếp chồng cả 5 lớp, không dùng 1 lớp là đủ:** mỗi lớp chặn một loại lỗi khác nhau —
lớp 1 chặn bịa policy, lớp 2 ép suy luận có cấu trúc, lớp 3 chặn bịa bằng chứng, lớp 4 chặn bất
nhất ở mức nghiêm trọng nhất, lớp 5 chặn "trích dẫn thật nhưng suy luận sai" mà 4 lớp trước không
thể phát hiện. Đây chính là điều tách AI Dev Guardian ra khỏi một "AI reviewer" thông thường chỉ
gọi LLM một lần rồi tin nguyên văn kết quả.

## 4. Đo lường bằng số liệu thật — Evaluation Suite

5 lớp khiên ở Mục 3 là *thiết kế lý thuyết*. Phần này là *bằng chứng đo được*: một bộ đánh giá độc
lập, chạy API thật (không mock LLM), dùng để trả lời đúng câu hỏi mà mọi kỹ thuật chống ảo giác
phải trả lời được — Agent có thật sự phát hiện đúng vi phạm hay không, tính bằng số chứ không phải
cảm tính.

### 4.1. Golden Dataset — 100 case cân bằng

`eval/dataset/cases.ts` — 100 case viết tay, cân bằng gần tuyệt đối để không thể ăn gian chỉ số
theo 1 chiều:

- **51 True-Positive** — case chứa đúng 1 vi phạm thật (SQL Injection, Hardcoded Secrets, Auth
  Bypass, N+1 Query, Invalid JWT Handling, Raw SSO SDK Leaking...).
- **49 False-Positive-Trap** — case AN TOÀN nhưng cố tình giống vi phạm để bẫy báo nhầm (test
  fixture, comment giải thích tiếng Việt, log không chứa dữ liệu nhạy cảm, decode JWT chỉ để hiển
  thị UI...), mỗi case mô phỏng đúng theo ví dụ "KHÔNG vi phạm" viết sẵn trong chính file policy.

Phủ 4 công nghệ đang vận hành ở V-ID: TypeScript/TSX, Python, Go, Dockerfile. Mỗi case là 1 diff
tổng hợp (`DiffResult`) đưa thẳng vào `runGuardianCheck()` thật — không có LLM provider giả lập.

### 4.2. Hành trình tinh chỉnh — 3 mốc đo, không phải 1 lần chạy đẹp

| Mốc đo | Recall | Precision | FPR | Nguyên nhân chính đã xử lý |
|---|---|---|---|---|
| Baseline (72 case) | 81.1% | 73.2% | 31.4% | Chưa mở rộng dataset, policy chưa tinh câu chữ |
| Sau mở rộng 100 case + tuning | 86.3% | 91.7% | 8.2% | Cụ thể hoá carve-out bằng ví dụ code thật |
| **Kết quả cuối (verify sống)** | **96.1%** | **94.2%** | **6.1%** | Evidence Matcher whitespace-tolerant + OpenAI strict schema |

Root cause đáng chú ý nhất: nhiều case "judge tự mâu thuẫn" hoá ra không phải lỗi logic mà do
OpenAI function-calling chưa bật chế độ `strict` — field bắt buộc `claimIsTrue` có thể bị model bỏ
sót dù phần `reasoning` đã kết luận đúng. Thêm `strict: true` + `additionalProperties: false` vào
schema (`src/checks/llm/types.ts`, `openaiClient.ts`) giải quyết dứt điểm 5 case cùng lúc chỉ bằng
1 chỗ sửa — một minh chứng cụ thể cho việc Lớp 1 (grounding theo schema, Mục 3) không chỉ là lý
thuyết mà ảnh hưởng trực tiếp tới độ chính xác đo được.

### 4.3. Kết quả cuối cùng đã verify sống

*Nguồn: `eval/results/history/2026-08-12_164551.json` (commit `03e5f3b`, model `gpt-4o` via
OpenAI, 100 case, gọi API thật).*

| Chỉ số | Kết quả | Ngưỡng Quality Gate | Ngưỡng lý tưởng | Đánh giá |
|---|---|---|---|---|
| Recall | **96.1%** (49/51) | ≥ 85.0% | ≥ 90.0% | Vượt ngưỡng lý tưởng +6.1đ |
| Precision | **94.2%** | ≥ 80.0% | ≥ 85.0% | Vượt ngưỡng lý tưởng +9.2đ |
| False Positive Rate | **6.1%** (3/49) | ≤ 25.0% | ≤ 15.0% | Dưới target 8.9đ |

**Minh bạch — 5 case chưa pass, không che giấu**: 2 case nhiễu sampling ở `temperature 0.2`
(`tp-27`, `fp-27` — pass lại khi chạy riêng lẻ); 1 case nhiễu dai dẳng hơn, chưa xác định nguyên
nhân gốc dứt điểm (`tp-28`); 1 carve-out chưa đủ ổn định qua nhiều lần chạy (`fp-24`); 1 giới hạn
đã biết trước của secret scan tất định — regex khớp nhầm 1 AWS placeholder key nằm trong comment
(`fp-12`), đây là giới hạn của lớp check regex (Mục 3), không sửa được bằng cách chỉnh policy.

### 4.4. Đo lường liên tục sau khi merge

`.github/workflows/eval.yml` đã wire và chạy tự động thật trên 3 điều kiện: thủ công
(`workflow_dispatch`), theo lịch mỗi đêm (bắt drift khi provider tự cập nhật model, kể cả không ai
đổi policy), và mọi PR đụng `src/checks/llm/**`, `.guardian/policies/**` hoặc `eval/**` — kết quả
tự động post/update thành 1 comment trên PR.

> ⚠️ **Điểm cần quyết định — chưa phải gate cứng**: workflow hiện chạy `npm run eval` (chế độ
> thông tin, luôn `exit 0`) — chưa dùng cờ `--ci` (`eval/checkThresholds.ts`, đã code xong) vốn tự
> chặn PR khi Recall < 85% hoặc FPR > 25%. Số liệu đã hiển thị tự động trên mọi PR liên quan,
> nhưng chưa PR nào bị chặn cứng vì tụt điểm — bật cờ này là 1 quyết định còn treo (xem Mục 9).

`eval/history.ts` ghi snapshot bất biến mỗi lần `npm run eval`, tự so Delta có màu với lần chạy gần
nhất; `eval/runBenchmark.ts` (`npm run eval:matrix`) đối sánh `gpt-4o` với `gpt-4o-mini` trên cùng
100 case để tối ưu chi phí API — cả 2 đều thao tác trên chính bộ 100 case ở Mục 4.1, không phải
một bộ dữ liệu riêng cho mục đích trình diễn.

## 5. Kiến trúc hệ thống đã triển khai

![Sơ đồ luồng hệ thống AI Dev Guardian](../img/system-flow.svg)

Sơ đồ trên mô tả đúng những gì **đã được cài đặt và chạy được**, chia thành 4 tầng rõ ràng:

- **CLI / Entrypoint** — `CLI entrypoint` (đọc lệnh `guardian check`) và `Git diff reader` (lấy
  diff từ staged area hoặc từ pre-push hook).
- **Core Engine / Orchestrator** — `Policy router and cache` (định tuyến policy theo scope +
  kiểm tra diff-hash cache) và `Verdict aggregator` (gộp kết quả, tính `PASS`/`BLOCK`).
- **Checkers layer** (lồng bên trong Orchestrator, chạy song song) — `Secret scan`,
  `Architecture`, `Semgrep`, `LLM + judge`.
- **Reporter** — `Fix-prompt generator` (build `promptToFix` theo template dùng chung) và
  `Terminal renderer` (khung màu theo mức độ nghiêm trọng).

Mọi khối trong sơ đồ tương ứng 1:1 với module thật trong `src/`: `src/cli.ts`,
`src/orchestrator.ts`, `src/checks/*.ts`, `src/report/*.ts` — đây là ảnh chụp đúng trạng thái
code hiện tại, không phải sơ đồ khái niệm.

## 6. Cách hoạt động dựa trên sơ đồ kiến trúc

Theo đúng thứ tự trong sơ đồ:

1. **Trigger** — dev chạy `git push` (đã cài `guardian install-hook`) hoặc gọi tay
   `guardian check --staged`.
2. **CLI / Entrypoint** — CLI đọc lệnh, lấy diff tương ứng.
3. **Policy router and cache** — loại bỏ file test/fixture, định tuyến policy có `scope` khớp
   file thay đổi, tính SHA-256 hash của diff để tra cache.
4. **Fan-out sang Checkers layer** — 4 checker chạy **đồng thời** (`Promise.all`): `Secret scan`,
   `Architecture`, `Semgrep` luôn chạy; riêng `LLM + judge` bị **bỏ qua nếu hash trùng một lần
   `PASS` gần đây** — đường bypass cache vẽ riêng ở lề phải sơ đồ.
5. **Fan-in vào Verdict aggregator** — kết quả 4 nhánh gộp lại một chỗ; verdict là `BLOCK` nếu có
   ít nhất 1 vi phạm mức `medium` trở lên, ngược lại là `PASS` (và ghi hash vào cache).
6. **Reporter** — `Fix-prompt generator` build `promptToFix` cho từng vi phạm, sau đó
   `Terminal renderer` in khung màu kết quả cuối cùng cho dev.

## 7. Lợi ích hiệu năng

- **Chạy song song, không tuần tự** — tổng thời gian check giới hạn bởi checker chậm nhất
  (thường là LLM call), không phải tổng cộng cả 4.
- **Cache-bypass tức thì** — diff không đổi thì bỏ qua hoàn toàn bước LLM (phần chậm và tốn phí
  nhất); 3 checker miễn phí vẫn luôn chạy nên độ an toàn không đổi.
- **Không trả tiền 2 lần cho cùng 1 diff** — LRU 20 hash `PASS` gần nhất, sống sót qua việc
  chuyển branch qua lại.
- **`BLOCK` không bao giờ được cache** — đảm bảo mọi bản sửa lỗi luôn được kiểm tra lại thật.
- **Fail-open trên mọi thành phần tuỳ chọn** — thiếu API key, thiếu binary `semgrep`, hoặc lỗi
  mạng ở judge pass đều chỉ log cảnh báo và bỏ qua đúng bước đó, không bao giờ crash hay tự ý
  `BLOCK` một push hợp lệ.

## 8. Quản trị & Vận hành nhiều Team

Phần trên (Mục 1–7) mô tả engine kiểm tra diff — phần chạy trên máy từng dev. Từ đó, dự án được mở
rộng thêm 1 lớp quản trị để vận hành được ở quy mô nhiều nhóm dev như V-ID, không chỉ 1 repo đơn lẻ.

### 8.0. Mô hình Quản trị theo Tầng (Tiered Governance Model)

AI Dev Guardian được định vị là một kiến trúc **Tiered Governance** 3 tầng, không phải 1 khối
monolith — mỗi tầng phục vụ 1 mức độ vận hành khác nhau, và có thể áp dụng độc lập:

| Tầng | Vai trò | Hạ tầng | Cơ chế vận hành |
|---|---|---|---|
| **Tier 1 — Core** | Miễn phí & mặc định cho mọi Dev | Không cần server (CLI + Git Pre-push Hook + CI Gate) | Đổi policy qua Pull Request thường, dùng `CODEOWNERS` trên `.guardian/policies/**` |
| **Tier 2 — Enterprise Standard** | Chuẩn hoá policy xuyên nhiều repo | Central Policy Package (`@vinsmartfuture/guardian-policies`) | Policy trung tâm publish dạng NPM package có version, từng service `npm install` rồi mở rộng thêm rule riêng |
| **Tier 3 — Executive & Compliance Mode** | Quản trị tập trung cho CISO & Kiểm toán | Dashboard + ReBAC Engine + Audit Logs (Mục 8.1–8.3) | Dashboard tập trung, duyệt thay đổi policy trong app, cách ly đa Team bằng OpenFGA/ReBAC, audit trail phục vụ compliance |

**Ưu tiên nguồn lực:** phần lớn effort kỹ thuật hiện dồn vào **Tier 1 & Tier 2** — độ chính xác của
AI Agent, tốc độ diff-cache, trải nghiệm CLI — vì đây là thứ mọi dev chạm vào hàng ngày. **Tier 3**
(Dashboard/ReBAC, đã triển khai đầy đủ ở Mục 8.1–8.3) được giữ ở trạng thái vận hành tốt nhưng đóng
vai trò chính là **bộ Demo/Pitching Suite** để trình diễn năng lực mở rộng (scalability &
multi-tenancy) khi báo cáo Lãnh đạo/khách hàng doanh nghiệp, không phải lộ trình rollout mặc định.

### 8.1. Web Dashboard & RBAC

Dashboard (React/Vite/Tailwind) + API (Express) chạy chung 1 lệnh `guardian dashboard`, dành cho
Tech Lead quản lý policy/audit mà không cần đọc terminal. 4 vai trò, 1 ma trận quyền dùng chung cả
server lẫn web:

| Vai trò | Có thể làm |
|---|---|
| **Admin** | Sửa/xoá policy trực tiếp, duyệt policy/bypass request, chỉnh Engine Config |
| **Senior Dev-Lead** | Đề xuất thay đổi policy, duyệt policy/bypass request |
| **Developer** | Chạy audit, xin bypass, chỉ đọc policy |
| **Auditor** | Chỉ đọc toàn bộ — không duyệt, không sửa, không chạy |

Đăng nhập cấp JWT ký thật (`src/server/token.ts`), không còn header client tự nhận role — mọi
request sau đó xác thực qua `Authorization: Bearer <token>`, hết hạn/giả mạo đều bị chặn ở
`requireAuth()`.

### 8.2. Vòng đời thay đổi Policy có kiểm soát

Vai trò không có quyền sửa trực tiếp đề xuất → tạo `PolicyChangeRequest` **pending**, không đụng
file ngay → Admin/Senior Dev-Lead duyệt mới thực sự ghi/xoá file `.guardian/policies/*.md`.

Quyết định kỹ thuật đáng chú ý: sau khi ghi/xoá file, hệ thống **không tự động `git commit`/`git
push`** — rủi ro khó đảo ngược, dễ conflict giữa nhiều clone của nhiều dev. Server trả về
`gitSyncHint`, Dashboard hiện nhắc qua toast, nhưng người duyệt vẫn phải tự đẩy lên Git — "đồng bộ
policy trong team" bản chất là đồng bộ Git bình thường (`git pull`), không có kênh phân phối riêng
nào chạy ngầm.

### 8.3. Phân quyền đa Team bằng OpenFGA/ReBAC

Ranh giới Team là **quan hệ (tuple)** kiểu Google Zanzibar, không phải cột `teamId` lọc thủ công:
`organization → team → policy / audit_record / bypass_request`. Khi 1 policy được tạo/duyệt,
`tagPolicyTeam()` tự ghi tuple `policy:<id>#team@team:<teamId>`.

- **Super Admin tự động kế thừa quyền admin trên mọi Team** — không cần gán tay từng team, engine
  tự suy luận từ Authorization Model (đã verify 11/11 case qua `fga query check` thật, đã demo cho
  Mentor).
- Admin Team A gọi API vào resource của Team B → luôn bị từ chối, dù cùng có relation `admin`.
- Cơ chế trên chỉ **thật sự thực thi** khi biến môi trường `GUARDIAN_AUTHZ_MODE=fga` được bật.
  Mặc định (không set), mọi route vẫn chạy RBAC phẳng cũ, **không lọc theo team** — ranh giới Team
  hiển thị đúng trên UI nhưng chưa bị khoá ở tầng quyền cho tới khi Ops chủ động bật flag này
  trong môi trường thật (xem Mục 9).

### 8.4. Chuẩn hoá Policy Doanh nghiệp

Toàn bộ 9 file policy đang áp dụng (`security`, `rbac`, `coding-convention`, `naming-convention`,
`logging`, `import-rules`, `architecture`, `dependency`, `performance`) theo cấu trúc 5 phần
Enterprise Standard, tham chiếu OWASP Top 10 / ISO 27001: Compliance Metadata → Executive Summary
→ Normative Directives (ví dụ ❌/✅ code thật) → Approved Exceptions → Remediation & Escalation.

## 9. Lộ trình tương lai

### Đã hoàn thành

| Tính năng | Trạng thái |
|---|---|
| Secret scan (regex, deterministic) | ✅ Done |
| LLM policy check (Claude/GPT, Policy-as-Code) | ✅ Done |
| Grounding evidence + policyId enum | ✅ Done |
| Chain-of-thought reasoning field | ✅ Done |
| AST comment/string annotation | ✅ Done |
| Self-consistency cho critical | ✅ Done |
| AI-as-a-Judge (2nd pass) | ✅ Done |
| Prompt-as-a-Fix (template dùng chung, tiếng Anh) | ✅ Done |
| Diff-hash caching (SHA-256, LRU 20) | ✅ Done |
| RAG-lite (TS/JS, Python, C/C++, Go) | ✅ Done |
| Circular dependency detection (madge) | ✅ Done |
| Semgrep integration (tuỳ chọn) | ✅ Done |
| Interactive pre-push git hook | ✅ Done |
| CI / GitHub Action gate (`--ci`, diff PR, comment tự động lên PR) | ✅ Done |
| Architecture Rules (`from`/`forbid` trong policy, chặn import trái layer) | ✅ Done |
| Policy-driven severity cho circular dependency (không còn hardcode `medium`) | ✅ Done |
| Dependency Rules (`dependencyAllowlist` trong policy, chặn dependency mới chưa duyệt) | ✅ Done |
| Web Dashboard (React/Vite/Tailwind) + API (Express) | ✅ Done |
| RBAC 4 vai trò + xác thực JWT thật (thay header tự nhận role) | ✅ Done |
| Policy Change Request / Bypass Request — vòng đời duyệt có kiểm soát | ✅ Done |
| Multi-Team Authorization bằng OpenFGA/ReBAC (song song RBAC cũ qua feature flag) | ✅ Done |
| Chuẩn hoá Policy Doanh nghiệp — cấu trúc 5 phần, 9 policy, OWASP/ISO 27001 | ✅ Done |
| Evaluation Suite — Golden Dataset 100 case, đo Recall/Precision/FPR bằng API thật | ✅ Done |
| CI/CD Quality Gate cho Evaluation (`eval/checkThresholds.ts`, cờ `--ci`) | ✅ Done (code) — chưa bật gate cứng trong workflow, xem Mục 4.4 |
| Historical Analytics & Live Delta Engine cho Evaluation | ✅ Done |
| Multi-Model Benchmark Matrix (`npm run eval:matrix`) | ✅ Done |
| Publish công khai trên npm (`ai-dev-guardian@0.1.0`) | ✅ Done |

### Đang chờ / Kế hoạch

| Tính năng | Mô tả |
|---|---|
| Bật cờ `--ci` làm gate cứng trong `eval.yml` | Hiện workflow chỉ chạy chế độ thông tin (luôn `exit 0`) — xem Mục 4.4 |
| OpenFGA production & Dashboard tập trung | Đưa `GUARDIAN_AUTHZ_MODE=fga` sang môi trường thật; quyết định deploy 1 Dashboard dùng chung cho cả team hay mỗi dev tự chạy instance riêng |
| Policy Studio & Pipeline Wizard | Upload PDF/Docx → auto-convert → Health Audit (0–100đ) → Conflict Check → Synthetic TestGen → Deploy |
| Multi-Tenant RBAC mở rộng 5 vai trò | Security Admin (CISO), Tech Lead, Senior Dev, Dev, Auditor — kế thừa nền OpenFGA đã có |
| Git Workflow policy category | Luật đặt tên branch, format commit message |
| Testing Standards policy category | Luật yêu cầu file test tương ứng khi thêm code mới |
| Business Requirements policy category | Gắn thay đổi code với yêu cầu sản phẩm (cơ chế cụ thể còn TBD) |
| Jira integration | Tự động gắn violation vào ticket theo dõi |
| Component ownership qua git blame | Gắn `promptToFix` với đúng người đã viết dòng code vi phạm |

## 10. Phân tích FinOps & Định vị thị trường

> **💡 Điểm nhấn tài chính (Key Takeaway)**
>
> AI Dev Guardian bảo vệ mã nguồn cho **toàn bộ team 5 người** với chi phí hàng tháng
> (**$18.50**) còn **rẻ hơn** tiền mua **1 tài khoản cá nhân** của GitHub Copilot (**$19.00**).

Rào cản lớn nhất khi đưa AI vào CI/CD là rủi ro "đốt tiền" API không kiểm soát được. AI Dev
Guardian giải quyết triệt để bài toán này bằng triết lý **Cost by Design** — tối ưu chi phí ngay
từ lõi kiến trúc, không phải một bản vá thêm vào sau.

### 8.1. Kiến trúc tối ưu chi phí (Unit Economics)

Thay vì gọi API vô tội vạ cho mọi file, hệ thống áp dụng **phễu lọc 3 lớp** để vắt kiệt giá trị
của từng cent:

- **Chi phí $0 (Zero-Cost Baseline)** — Secret scan, Architecture check (circular dependency) và
  Semgrep chạy hoàn toàn bằng Deterministic Engine nội bộ, không tốn một token nào. Trong khoảng
  ~75% số lượt check, không có vi phạm nào sống sót tới mức cần AI Judge xác minh thêm — tức phần
  lớn khối lượng công việc đã được lọc sạch trước khi chạm tới lớp tốn phí nhất.
- **Cắt giảm ~30% API thừa** — Thuật toán diff-hash (SHA-256, xem Mục 7) ghi nhớ những diff đã
  từng `PASS`, tự động bỏ qua lượt gọi LLM cho các lần push không đổi logic thật (chỉ sửa format,
  chuyển qua lại branch...), giúp TCO (tổng chi phí sở hữu) giảm khoảng 30%.
- **Định tuyến model thông minh (Smart Routing)** — Lượt check chính dùng **Claude Sonnet 5**
  ($3.00/1M input), còn lượt AI Judge (thẩm định chéo, xem Mục 3) dùng **Claude Haiku 4.5** — rẻ
  hơn 3 lần ($1.00/1M input) — và chỉ được kích hoạt khi thật sự có vi phạm cần xác minh (~25%
  tần suất), không chạy cho mọi file.

👉 **Tổng chi phí trung bình: chỉ ~$0.02 (2 cent) cho mỗi file được AI quét toàn diện.**

### 8.2. Dự phóng chi phí thực tế (team 5 kỹ sư)

*(Giả định cường độ cao: 4 lần push/ngày/dev × 3 file/push × 22 ngày làm việc — nêu rõ để minh
bạch, không phải số đo thực tế)*

| Phân bổ / Tháng | Lượt check AI | Chi phí dự phóng |
|---|---|---|
| Bình quân 1 Dev | ~185 lượt | **~$3.70 / tháng** |
| **Tổng toàn Team (5 Devs)** | **~924 lượt** | **~$18.50 / tháng** |
| 20 Devs | ~3.696 lượt | ~$74 / tháng |
| 50 Devs | ~9.240 lượt | ~$185 / tháng |

### Định vị thị trường

Đặt cạnh bảng so sánh ở Mục 2: các AI PR Bot thế hệ đầu (CodeRabbit, Copilot Review...) thường
tính phí **10-20 USD/dev/tháng** — tức một team 5 người đã tốn **50-100 USD/tháng** chỉ để mua
seat, chưa tính chi phí CI/compute phát sinh. AI Dev Guardian đạt được **cùng lớp phòng thủ AI**
với **~$3.70/dev/tháng** — rẻ hơn 3-5 lần — nhờ chạy pre-push cục bộ (không tốn CI) và kiến trúc
Cost by Design nói trên, mà không đánh đổi bằng việc bớt lớp bảo vệ nào trong 5 lớp chống
hallucination ở Mục 3.

**Kết luận khả thi:** chi phí không đáng kể so với hậu quả thực tế của một sự cố duy nhất mà
Guardian ngăn được (một secret bị lộ production, hoặc một circular dependency gây bug khó debug
hàng giờ) — và được kiểm soát chủ động bởi chính kiến trúc, không phải may rủi.

---

*Tài liệu tổng hợp từ `README.md`, `reports/sprint-plan.html`, `eval/results/history/` và trạng
thái code thật của dự án tại thời điểm 13/08/2026.*
