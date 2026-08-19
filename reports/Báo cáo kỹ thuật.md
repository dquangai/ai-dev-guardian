# Báo cáo Kỹ thuật: AI Dev Guardian

### AI Engineering Governance Agent — Người gác cổng chất lượng code trước mỗi lần `git push`

*Phiên bản: v0.1.0 — Level 5 Enterprise Automation · Ngày cập nhật: 19/08/2026*

> Đã publish công khai trên npm (`ai-dev-guardian@0.1.0`) · **Recall 96.1% / Precision 94.2% / FPR
> 6.1%** đo thật trên Golden Dataset 100 case (Mục 4) · Dashboard quản trị + RBAC 4 vai trò +
> phân quyền đa Team bằng OpenFGA/ReBAC đã chạy được (Mục 8) — không còn là MVP đơn lẻ CLI.

---

## 1. Thực trạng: Human Review quá tải, Static Analysis giới hạn, và rủi ro Ảo giác của AI Reviewer

### 1.1. Quá tải Human Review và giới hạn của Static Analysis

Sự phổ biến của các công cụ tạo mã bằng AI đã giúp tăng tốc độ viết code, kéo theo lượng Pull
Request (PR) bùng nổ, khiến việc đánh giá thủ công trở nên quá tải. Nghiên cứu thị trường liên tục
chỉ ra rằng chất lượng đánh giá mã của con người giảm sút nghiêm trọng khi một PR vượt ngưỡng
200–400 dòng code. Trong khi đó, các công cụ phân tích tĩnh (Static Analysis) truyền thống dù bắt
lỗi cú pháp tốt nhưng lại thiếu khả năng thấu hiểu bối cảnh toàn cục của dự án — logic nghiệp vụ,
kiến trúc, và thư viện nội bộ riêng.

### 1.2. Vấn đề "Sai vị trí" (Wrong Gate)

Việc kích hoạt AI review ở tầng CI/CD hoặc PR Bot trên GitHub/GitLab tạo ra độ trễ lớn và ngắt
quãng sự tập trung của dev — phải chờ push code lên mới nhận được phản hồi. Xu hướng hiện tại của
các công cụ hàng đầu dành cho doanh nghiệp là dịch chuyển lớp bảo vệ này sang giai đoạn **pre-push**
(chạy tại CLI hoặc IDE) để bắt lỗi *trước khi* mã tiếp cận Pull Request và CI pipeline, giúp tiết
kiệm chi phí tính toán và thời gian của nhà phát triển.

### 1.3. Thảm họa "Ảo giác" (Hallucination) và Kiệt sức vì cảnh báo (Alert Fatigue)

Hầu hết các công cụ AI đánh giá mã hiện tại chỉ nhìn vào phần thay đổi (diff) mà không nắm được quy
chuẩn đặt tên, kiến trúc hay thư viện nội bộ của toàn bộ dự án, dẫn đến việc áp dụng các quy tắc
chung chung và tạo ra hàng loạt cảnh báo sai (false positive):

- **Tỷ lệ chính xác thấp** — dữ liệu nghiên cứu thị trường đầu năm 2026 cho thấy các công cụ AI
  đánh giá mã hàng đầu chỉ đạt độ chính xác 42–48% khi bắt các lỗi runtime thực sự; hơn một nửa số
  vấn đề bị gắn cờ không phải là lỗi thật.
- **Alert Fatigue** — khi một PR nhận hàng chục bình luận rác hoặc bắt bẻ phong cách (nitpick), lập
  trình viên bị kiệt sức và mất niềm tin; ghi nhận tới 40% cảnh báo AI bị team phớt lờ hoàn toàn khi
  rơi vào trạng thái mệt mỏi vì cảnh báo rác.
- **Rủi ro bảo mật & chi phí** — việc phớt lờ này tạo ra "điểm mù bảo mật": một lỗ hổng nghiêm trọng
  có thể lọt ra production chỉ vì bị chôn vùi dưới hàng chục bình luận vô giá trị. Về tài chính, một
  đội 10 người có thể lãng phí 2,5–5 giờ/tuần chỉ để đọc và bỏ qua cảnh báo sai — thiệt hại ước tính
  $65.000–$130.000 chi phí lao động mỗi năm.

### 1.4. Nhu cầu Tự động hóa Doanh nghiệp và Quản trị Kỹ thuật (Engineering Governance) quy mô lớn

Việc ứng dụng AI và tự động hóa trong doanh nghiệp đang tăng tốc chưa từng có — dự báo đến năm 2028
sẽ có tới 90% kỹ sư phần mềm doanh nghiệp dùng trợ lý mã hoá AI. Tốc độ này mang theo rủi ro đi kèm:
khi hệ thống tự động hoặc AI agent hoạt động độc lập mà thiếu ngữ cảnh tổ chức hoặc sự giám sát,
chúng dễ tạo ra kết quả vi phạm chính sách nội bộ (out of policy), gây sai lệch kiến trúc hoặc mở ra
những lỗi khó phát hiện.

Để đối phó, các tổ chức lớn đang ứng dụng Kỹ thuật Nền tảng (Platform Engineering) để xây dựng nền
tảng dev nội bộ có sẵn "rào chắn" (guardrails) tự động, giảm bớt sự thất vọng và quá tải cho kỹ sư.
Nhúng tiêu chuẩn quản trị (governance) và cơ chế bảo mật trực tiếp vào luồng công việc đang trở
thành tiêu chuẩn sống còn — thay vì chỉ "dịch chuyển sang trái" (shift left) một cách gượng ép,
doanh nghiệp cần tích hợp sâu hệ thống an ninh vào quá trình cộng tác của cả nhóm.

Đây chính là khoảng trống mà AI Dev Guardian được thiết kế để lấp đầy: chặn đúng chỗ (trước push,
không phải sau), hiểu đúng ngữ cảnh (Policy-as-Code, không phải DSL cứng), và không tự ý sửa code
thay con người — cơ chế Policy-as-Code kết hợp hệ thống quản trị định danh/phân quyền (OpenFGA/ReBAC,
Mục 8.3) cho phép doanh nghiệp số hoá quy định nghiệp vụ thành luật, tự động hoá khâu kiểm duyệt an
toàn và nhất quán, đảm bảo mọi mã nguồn tuân thủ kiến trúc trước khi đi sâu vào hệ thống tích hợp
liên tục.

*Số liệu thị trường trong Mục 1 (ngưỡng chất lượng review 200–400 dòng, độ chính xác 42–48%, tỷ lệ
bỏ qua cảnh báo 40%, thiệt hại $65k–$130k/năm, dự báo 90% kỹ sư dùng AI coding assistant vào 2028)
là quan sát/nghiên cứu thị trường được tổng hợp lại, không phải số đo trực tiếp của AI Dev Guardian
— khác với Recall/Precision/FPR ở Mục 4, vốn là kết quả verify sống trên chính Golden Dataset của
dự án.*

## 2. Giải pháp

**AI Dev Guardian** là một agent quản trị kỹ thuật (Engineering Governance Agent) chạy như một
**pre-push gate**: kiểm tra diff *trước khi* code rời máy dev, không phải dọn dẹp *sau khi* đã
lên remote — trả lời trực tiếp vấn đề "Sai vị trí" (Wrong Gate) đã nêu ở Mục 1.2.

Mỗi nguyên lý thiết kế cốt lõi dưới đây đối ứng ngược lại đúng 1 thực trạng ở Mục 1, không phải
danh sách tính năng rời rạc:

- **Chạy tại pre-push, không phải CI/PR bot** — giải quyết *Wrong Gate* (1.2): bắt lỗi trước khi mã
  chạm Pull Request, không ngắt quãng luồng làm việc của dev, không tốn compute CI cho những lỗi lẽ
  ra đã chặn được sớm hơn.
- **Deterministic + Probabilistic kết hợp** — luật kiểm tra chắc chắn (secret lộ, circular
  dependency, static analysis rule) chạy bằng công cụ xác định 100%; chỉ những gì thực sự cần
  *hiểu ngữ nghĩa* mới giao cho LLM — lấp đúng khoảng trống Static Analysis bỏ lại ở 1.1: bắt cú
  pháp tốt nhưng "mù" trước bối cảnh và logic nghiệp vụ riêng của dự án.
- **Evidence-grounded + 5 lớp chống ảo giác (Mục 3)** — mọi claim của LLM bị đối chiếu lại với diff
  thật trước khi tin, giảm trực tiếp rủi ro Hallucination/Alert Fatigue ở 1.3: FPR đo thật chỉ
  **6.1%** (Mục 4), so với mức 40% cảnh báo AI bị team phớt lờ hoàn toàn ghi nhận ở thị trường nói
  chung.
- **Policy-as-Code** — luật không phải cấu hình cứng từ nhà cung cấp, mà là file Markdown do chính
  team viết (`.guardian/policies/*.md`), LLM đọc và áp dụng trực tiếp — đúng hướng "guardrail nhúng
  thẳng vào luồng làm việc" mà Platform Engineering doanh nghiệp đang cần ở 1.4, thay vì một sản
  phẩm SaaS đóng hộp áp đặt luật chung.
- **Không tự động vá code** — mọi vi phạm chỉ đi kèm một `promptToFix` sẵn sàng copy-paste vào AI
  assistant của chính dev — quyết định sửa thế nào vẫn luôn thuộc về con người, loại bỏ hẳn rủi ro
  *Auto-fix âm thầm* đã nêu ở 1.2.
- **Một verdict duy nhất** — `PASS` hoặc `BLOCK`, không có vùng xám, không sinh ra hàng chục comment
  nitpick góp phần gây Alert Fatigue như AI PR Bot thế hệ đầu (1.3).

Guardian **không thay thế Human Review** (1.1) — nó giảm tải cho human review bằng cách tự chặn sẵn
phần lớn lỗi cơ bản/lặp lại trước khi PR tới tay reviewer, để con người dồn sự tập trung có hạn vào
đúng phần cần phán đoán nghiệp vụ, thay vì đọc lại từng dòng trong một PR 200–400 dòng.

### So sánh với các công cụ hiện có — tôi có gì, họ có gì

| Tiêu chí | Human Review (thủ công) | Static Analysis (ESLint, SonarQube...) | AI Code Reviewer hiện đại 2026 (CodeRabbit/Greptile/Bugbot...) | **AI Dev Guardian** |
|---|---|---|---|---|
| Thời điểm chạy | Sau khi mở PR, phụ thuộc lịch reviewer | IDE/CI | Chủ yếu vẫn là PR bot; một số đã bổ sung CLI chạy trước push trong 2026 (add-on, không phải cơ chế mặc định) | **Trước khi push** — git hook cục bộ, tự động, không cần chạy lệnh tay |
| Hiểu logic nghiệp vụ riêng | Có, nhưng cảm tính, không nhất quán | Không — chỉ bắt cú pháp/style | Có — một số tool (Greptile) index toàn bộ codebase, không chỉ đọc diff | **Có** — Policy-as-Code bằng Markdown do chính team viết |
| Cấu hình luật | Không cấu hình được | Phức tạp — cần học DSL/Rego hoặc YAML rườm rà | Cấu hình chung/prompt, chưa thấy công khai cơ chế "policy file do team tự viết + ví dụ VI PHẠM/KHÔNG vi phạm" như Guardian | 1 file Markdown + YAML frontmatter, viết như giải thích cho đồng nghiệp |
| Chống Hallucination | N/A (con người vẫn có thể sai/sót) | N/A (deterministic, không dùng LLM) | Không công khai cơ chế xác minh nhiều lớp tương đương | **5 lớp**: grounding, CoT, self-consistency, AI-as-Judge, RAG-lite (Mục 3) |
| Auto-fix code | Không | Có (`--fix`) nhưng chỉ cho rule cứng, an toàn | Một số có commit/auto-fix (rủi ro patch sai âm thầm nếu lọt review) | **Không bao giờ** — chỉ sinh `promptToFix` |
| Nút thắt khi team scale | Có — bottleneck rõ rệt | Không | Không, nhưng cộng dồn chi phí CI/compute và phí theo seat/lượt chạy | Không — chạy song song, cache tái sử dụng, ~75% check không tốn LLM (Mục 10) |

### Đối chiếu trực tiếp 3 công cụ dẫn đầu 2026 — không phải "đời đầu"

Bảng trên gộp chung nhóm "AI Code Reviewer" để dễ so — bảng dưới đây đối chiếu trực tiếp từng công
cụ cụ thể đang dẫn đầu thị trường tính đến 08/2026 (không phải nhóm SaaS PR-bot sơ khai bị coi là
lỗi thời), để phần so sánh có căn cứ kiểm chứng được thay vì mô tả chung chung:

| Tiêu chí | CodeRabbit | Greptile | Cursor Bugbot | **AI Dev Guardian** |
|---|---|---|---|---|
| Mô hình vận hành | PR bot đa nền tảng (GitHub/GitLab/Bitbucket/Azure DevOps) + CLI pre-push bổ sung (2026) | PR bot, index toàn bộ codebase thành graph phụ thuộc | Gắn với editor Cursor, chạy trên PR/agent run | Git hook pre-push cục bộ, mặc định, không cần SaaS |
| Catch rate (Recall) công bố | 44% (benchmark của Greptile) hoặc 28.7% (benchmark độc lập 122 bug) | 82% (tự benchmark) hoặc 36.1% (benchmark độc lập) | 58% (benchmark của Greptile) hoặc 32.0% (benchmark độc lập) | **96.1%** — đo trên 100 case tự viết, tái lập được (Mục 4) |
| False positive | Thấp nhất trong 3 tool ở 1 benchmark (2 FP/50 PR) | Cao hơn (11 FP/50 PR ở cùng benchmark); trang benchmark chính thức không công bố FP rate | 4.8% (tự công bố) | **FPR 6.1%** — đo trên 49 case bẫy cố ý, công khai cả 3 case còn sai (Mục 4.3) |
| Chi phí / dev / tháng | $24–30 (gói Pro), $48–60 (gói Pro+) | Theo seat, giá cụ thể không công khai trong các nguồn tra cứu được | $20/tháng + ~$1–1.5/lượt chạy (individual); $40/user/tháng + gói chi tiêu agentic (team) | **~$3.70** — dự phóng dựa trên kiến trúc lọc 3 lớp thật (Mục 10) |

*Nguồn số liệu 2 bảng trên về đối thủ (không phải Guardian tự benchmark các công cụ này, tra cứu
web ngày 19/08/2026): [Greptile — Best AI Code Review Tools 2026](https://www.greptile.com/content-library/best-ai-code-review-tools),
[Greptile Benchmarks](https://www.greptile.com/benchmarks), [Tenki — AI Code Review Benchmark 2026](https://tenki.cloud/benchmarks/code-reviewer),
[Pondero — Cursor Bugbot vs CodeRabbit, 06/2026](https://pondero.ai/coding/guides/cursor-bugbot-vs-coderabbit-ai-code-review-june-2026/).
Chênh lệch lớn giữa benchmark của chính vendor và benchmark độc lập (ví dụ Greptile 82% theo
benchmark của họ nhưng chỉ 36.1% ở benchmark độc lập) không phải sai sót trích dẫn — đó chính là
hiện trạng thị trường: đa số benchmark AI code review hiện do chính vendor tự công bố, chưa có
phương pháp đo thống nhất. Đây cũng là lý do Mục 4 của tài liệu này đo trên 1 bộ 100 case cố định
do Guardian tự viết, chạy lại được (`npm run eval`), và công khai cả case đo sai thay vì chỉ chọn 1
con số đẹp để công bố.*

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

> ✅ **Đã bật gate cứng (17/08/2026)**: workflow chạy cờ `--ci` (`eval/checkThresholds.ts`) cho
> trigger `pull_request` — tự chặn PR khi Recall < 85% hoặc FPR > 25%. Trigger `schedule`/
> `workflow_dispatch` vẫn giữ chế độ thông tin (`npm run eval`, luôn `exit 0`), vì không gắn với 1
> PR cụ thể nào để chặn. Chi tiết xem Phụ lục A — Nhật ký phát triển.

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
  trong môi trường thật. Việc bật flag này ở môi trường production vẫn đang chờ Mentor chốt hướng
  đầu tư cho Dashboard/Tier 3 (Mục 8.0) trước khi triển khai.

### 8.4. Chuẩn hoá Policy Doanh nghiệp

Toàn bộ 9 file policy đang áp dụng (`security`, `rbac`, `coding-convention`, `naming-convention`,
`logging`, `import-rules`, `architecture`, `dependency`, `performance`) theo cấu trúc 5 phần
Enterprise Standard, tham chiếu OWASP Top 10 / ISO 27001: Compliance Metadata → Executive Summary
→ Normative Directives (ví dụ ❌/✅ code thật) → Approved Exceptions → Remediation & Escalation.

## 9. Lộ trình tương lai — Định hướng khi đưa vào quy trình tự động hóa doanh nghiệp

Mô tả hướng phát triển nếu AI Dev Guardian được đưa từ "công cụ 1 dev/1 repo tự cài" thành 1 mắt xích
chính thức trong quy trình tự động hóa phát triển phần mềm — trước hết ở quy mô **VinSmart Future**
(nội bộ V-ID và các team kỹ thuật khác trong tập đoàn dùng chung GitLab), sau đó là hướng đi khả thi
cho **bất kỳ doanh nghiệp nào khác** áp dụng cùng mô hình Tiered Governance (Mục 8.0) cho pipeline
CI/CD của họ.

### 9.1. Gate bắt buộc trong pipeline CI/CD nội bộ, không chỉ hook cá nhân

Hiện `guardian install-hook` là lựa chọn tự nguyện của từng dev, dễ bị gỡ hoặc bypass âm thầm
(`git push --no-verify`). Định hướng: viết `.gitlab-ci.yml` wire `guardian check --ci` thành
required pipeline job trên GitLab nội bộ (song song bản GitHub Action `--ci` đã có cho repo
public) — biến Guardian thành gate cấp tổ chức, không phụ thuộc việc từng dev có tự cài hook hay
không.

### 9.2. Policy Package trung tâm, rollout đa repo (Tier 2 vận hành thật)

9 policy hiện sống trong 1 repo duy nhất. Định hướng: publish `@vinsmartfuture/guardian-policies`
lên internal NPM registry, versioned; mỗi service tự `npm install` rồi mở rộng thêm rule riêng theo
domain, đồng bộ chuẩn chung qua bump version thay vì copy-paste thủ công giữa các repo — đúng mô
hình Tier 2 đã phác thảo ở Mục 8.0, nhưng cần hạ tầng registry thật mới vận hành được ở quy mô
nhiều team.

### 9.3. Auto-remediation có kiểm soát, không phải auto-patch mù

Nguyên tắc cốt lõi (Mục 2) vẫn giữ nguyên: Guardian không tự sửa code. Định hướng mở rộng thận
trọng: với nhóm vi phạm có fix xác định gần như 100% (ví dụ thiếu đúng 1 dòng audit log theo
template cố định), có thể tự mở 1 PR nháp đính kèm `promptToFix` để dev chỉ cần review/approve
thay vì tự tay copy-paste — vẫn giữ nguyên tắc con người quyết định cuối cùng, chỉ giảm số bước
thao tác thủ công, không tự động merge.

### 9.4. ChatOps & tích hợp hệ thống nội bộ

BLOCK mức `critical` tự động thông báo vào đúng kênh chat của team sở hữu file vi phạm — suy ra từ
`git blame` (cơ chế đã có sẵn), không cần cấu hình routing thủ công. Audit trail có thể đồng bộ 2
chiều với hệ thống ticket nội bộ nếu V-ID có nhu cầu thật — chỉ nên làm khi có yêu cầu cụ thể, xem
lý do "Jira integration" hiện đang bị đề xuất gỡ khỏi roadmap (bên dưới) vì chưa có nhu cầu xác
định.

### 9.5. Observability cấp doanh nghiệp cho chi phí & chất lượng model

Số liệu FinOps ở Mục 10 hiện là dự phóng tĩnh theo giả định cường độ dùng. Định hướng: dashboard
chi phí API thật theo team/theo tháng, và kênh cảnh báo chủ động khi Recall/Precision (Mục 4) tụt
qua ngưỡng giữa các lần chạy nightly eval — hiện workflow eval chỉ post comment thông tin trên PR
liên quan, chưa có cảnh báo chủ động cho lần chạy theo lịch (không gắn với PR nào để post vào) khi
provider âm thầm đổi hành vi model.

### 9.6. Giảm phụ thuộc 1 nhà cung cấp LLM

Khi Guardian trở thành gate bắt buộc toàn tổ chức (9.1), 1 provider bị rate-limit hoặc downtime
không được phép làm treo cả pipeline CI. Định hướng: cấu hình failover tự động Anthropic ↔ OpenAI,
thay vì đổi biến môi trường thủ công như hiện tại — tăng độ sẵn sàng tương xứng với vai trò gate
bắt buộc.

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
