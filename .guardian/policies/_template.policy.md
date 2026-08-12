---
# ── Frontmatter schema (src/policy/loader.ts) ──────────────────────────────
# category: string hiển thị trong report/dashboard — 1 danh mục rõ ràng (Security,
#           Authorization (RBAC), Coding Convention, Logging & Audit...).
# scope:    glob (micromatch) — file nào khớp thì policy này mới được đưa vào prompt
#           kiểm tra cho file đó (src/policy/router.ts). Rỗng ([]) = áp dụng MỌI file,
#           dùng cẩn thận.
# severity: low | medium | high | critical — critical/high/medium chặn push (BLOCK),
#           low chỉ hiển thị cảnh báo, không chặn (xem BLOCKING_SEVERITIES trong
#           src/orchestrator.ts).
# tags:     string[] tự do, phục vụ tìm kiếm/lọc trên dashboard.
# rules:    CHỈ dùng cho policy kiến trúc — from/forbid/description, được
#           architectureRulesCheck.ts kiểm tra tự động (deterministic, không qua LLM).
# dependencyAllowlist: CHỈ dùng cho policy kiểm soát dependency (package.json) —
#           được dependencyRulesCheck.ts kiểm tra tự động (deterministic).
#
# Lưu ý: file bắt đầu bằng "_" (như file này) bị loadPolicies() bỏ qua có chủ đích
# (src/policy/loader.ts) — đây là TEMPLATE để copy, không phải policy đang áp dụng.
# Khi tạo policy thật từ template này, đổi tên bỏ dấu "_" ở đầu, ví dụ:
# "_template.policy.md" -> "session-management.policy.md".
category: "<Tên danh mục — ví dụ: Session Management>"
scope: ["**/*.ts", "**/*.tsx", "**/*.py", "**/*.go"]
severity: high
tags: [enterprise-standard, <tag-khac>]
---

# <Tên Policy>

## 1. Executive Summary & Compliance Standards

Tóm tắt 2-3 câu: policy này bảo vệ điều gì, rủi ro nghiệp vụ nếu vi phạm là gì (không chỉ nói
"không an toàn" chung chung — nêu hậu quả cụ thể: lộ dữ liệu người dùng, chiếm quyền tài khoản,
gián đoạn dịch vụ...).

Tham chiếu chuẩn liên quan (mapping tham khảo, không phải chứng nhận đã audit chính thức):

- **OWASP Top 10 (2021):** ví dụ `A01:2021 – Broken Access Control`, `A02:2021 – Cryptographic
  Failures`, `A03:2021 – Injection` — chọn đúng mục khớp với rule bên dưới.
- **ISO/IEC 27001 Annex A:** ví dụ `A.9 Access Control`, `A.10 Cryptography`, `A.12 Operations
  Security` — chọn đúng control khớp với rule bên dưới.

## 2. Normative Directives

Danh sách rule cụ thể, mỗi rule PHẢI có ví dụ ❌ Non-Compliant và ✅ Compliant bám sát đúng ranh
giới mong muốn — Guardian's LLM check bám theo chính xác ranh giới các ví dụ này khi ra quyết định
(không suy diễn rộng hơn).

### 2.1 <Tên rule>

<Mô tả rule bằng 1-2 câu, nói rõ điều kiện áp dụng — chỉ áp dụng khi nào, không áp dụng khi nào.>

❌ **Non-Compliant:**

```
<đoạn code vi phạm, ngắn gọn, thực tế>
```

✅ **Compliant:**

```
<đoạn code đúng, giải quyết đúng vấn đề trên>
```

## 3. Approved Exceptions & Carve-outs

Liệt kê rõ các trường hợp KHÔNG tính là vi phạm dù bề mặt trông giống — đây là phần quan trọng nhất
để tránh false positive (Guardian's LLM check bám sát đúng các ngoại lệ được liệt kê ở đây). Ví dụ:
placeholder/ví dụ trong tài liệu, dữ liệu test trong `test/fixtures/**`, comment mô tả khái niệm
bằng ngôn ngữ tự nhiên (không phải code đang thực thi).

## 4. Automated Enforcement

Ghi rõ rule này được Guardian kiểm tra tự động bằng cơ chế nào, để người đọc biết mức độ tin cậy:

- **LLM Policy Check** (`checkPoliciesWithLLM`, có grounding + judge pass xác minh lại) — dùng cho
  rule cần hiểu ngữ cảnh/ngữ nghĩa, không thể viết regex/AST match đơn giản.
- **Deterministic check** — nêu rõ checker (`secretScan.ts`, `architectureCheck.ts` (madge),
  `architectureRulesCheck.ts` (rules ở frontmatter), `dependencyRulesCheck.ts`, `semgrepCheck.ts`)
  nếu rule này có thể/đã được kiểm tra bằng công cụ tất định thay vì LLM.

## 5. Remediation & Escalation Guide

- **Tự sửa:** Guardian sinh sẵn 1 prompt gợi ý sửa lỗi copy-paste được kèm mỗi vi phạm (xem
  `report/promptToFix.ts`) — dán trực tiếp vào Copilot/ChatGPT/Claude cá nhân của dev.
- **Không đồng ý với verdict (nghi ngờ false positive):** dùng luồng "yêu cầu bypass" có sẵn trên
  dashboard (`/api/bypass-requests`, cần Approver duyệt) — không tự ý sửa policy để né qua.
- **Leo thang (escalation):** vi phạm `critical` không tự sửa được trong <SLA, ví dụ: 24h> — báo
  Security/Tech Lead phụ trách (điền tên/kênh liên hệ thật của tổ chức khi áp dụng template này).
