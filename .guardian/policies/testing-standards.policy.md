---
category: Testing Standards
scope: []
severity: low
tags: [testing-standards, test-coverage]
testingStandards:
  - sourcePattern: ["src/checks/**/*.ts", "src/git/**/*.ts", "src/policy/**/*.ts", "src/server/**/*.ts"]
    testPattern: ["test/**/*.test.ts"]
    description: "Repo này yêu cầu logic mới (check/policy/server) phải kèm ít nhất 1 test trong cùng lần push — xem test/ hiện có: 40+ file, gần như 1:1 với các module chính."
---

# Testing Standards Policy

## 1. Executive Summary & Compliance Standards

Policy này bảo vệ khả năng refactor an toàn về sau — code mới không có test đi kèm không có gì bắt
lỗi khi ai đó (kể cả chính tác giả, kể cả AI assistant) sửa lại sau này. Repo này đã có văn hoá test
rất chặt (`vitest run` — 44 file test, 400+ case, chạy trên mọi PR) — rule này chỉ tự động hoá lại
đúng kỳ vọng đã có sẵn, không phải yêu cầu mới.

- **ISO/IEC 27001 Annex A:** `A.14 System Acquisition, Development and Maintenance` (kiểm thử là
  1 phần của quy trình phát triển an toàn).

## 2. Normative Directives

### 2.1 File mới trong `src/checks/`, `src/git/`, `src/policy/`, `src/server/` phải kèm test

Diff thêm 1 file **hoàn toàn mới** (không phải sửa file có sẵn) khớp `src/checks/**`, `src/git/**`,
`src/policy/**`, hoặc `src/server/**` thì diff đó phải đụng ít nhất 1 file khớp `test/**/*.test.ts`.

**Không bắt buộc khớp tên 1-1** (ví dụ `checkFoo.ts` không nhất thiết phải có đúng
`checkFoo.test.ts`) — repo này tự nó đã không theo quy ước đặt tên chặt (`auth.ts` được test bởi
`authRouter.test.ts`, `policies.ts` bởi `policyRouter.test.ts`) nên rule chỉ đòi hỏi diff có TOUCH
1 file test nào đó, không đòi hỏi tên khớp.

❌ **Non-Compliant:** push chỉ có `src/checks/newCheck.ts`, không có file `test/*.test.ts` nào
trong cùng diff.

✅ **Compliant:** push có `src/checks/newCheck.ts` + `test/newCheck.test.ts` (hoặc bất kỳ tên file
test nào khác trong `test/**`).

## 3. Approved Exceptions & Carve-outs

- File mới trong `src/cli.ts`, `src/hooks/**`, `src/sso/**`, `src/ttyConfirm.ts`, `src/types/**`
  không nằm trong `sourcePattern` — không bắt buộc test (entrypoint/type-only/adapter mỏng, giá trị
  test thấp so với chi phí).
- File chỉ **sửa** (không phải file mới hoàn toàn) không bị rule này bắt — Guardian chỉ đánh giá
  diff hiện tại, không truy ngược lịch sử để đòi hỏi test cho code cũ chưa từng có test.
- Diff không thêm file `src/**` mới nào (chỉ sửa file có sẵn, hoặc chỉ đổi file ngoài `src/`) —
  không kiểm tra, không có gì để yêu cầu.

## 4. Automated Enforcement

- **Deterministic check** — `checkTestingStandards` (`src/checks/testingStandardsCheck.ts`), đọc
  `testingStandards: [{ sourcePattern, testPattern }]` ở frontmatter trên. Chỉ so khớp đường dẫn
  file (glob qua `micromatch`) + có/không có dòng `new file mode` trong diff — không đọc nội dung
  file, không qua LLM.

## 5. Remediation & Escalation Guide

- **Tự sửa:** thêm 1 file test khớp `test/**/*.test.ts` trong cùng lần push, phủ đúng logic file
  mới vừa thêm — xem các file test hiện có (`test/gitWorkflowCheck.test.ts`, `test/blame.test.ts`)
  làm mẫu (dùng repo/tmp dir thật khi có thể, không mock quá tay).
- **Không đồng ý với verdict:** severity mặc định `low` (không chặn push, chỉ cảnh báo) — nếu team
  muốn chặn cứng, nâng `severity` lên `medium`+ trong frontmatter.
