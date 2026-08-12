---
category: Dependency
scope: ["package.json"]
severity: medium
tags: [dependency, supply-chain]
dependencyAllowlist:
  - "@anthropic-ai/*"
  - "@ast-grep/*"
  - "@types/*"
  - chalk
  - commander
  - concurrently
  - cors
  - dotenv
  - express
  - gray-matter
  - madge
  - micromatch
  - openai
  - simple-git
  - tsx
  - typescript
  - vitest
---

# Dependency Policy

## 1. Executive Summary & Compliance Standards

Policy này bảo vệ chống rủi ro chuỗi cung ứng phần mềm (supply-chain risk) — mỗi dependency mới là
một bề mặt tấn công tiềm ẩn (typosquatting, package bị chiếm quyền, lỗ hổng chưa vá) và một gánh
nặng bảo trì lâu dài; thêm dependency âm thầm, không qua review, khiến tổ chức mất kiểm soát những
gì thực sự chạy trong production.

- **OWASP Top 10 (2021):** `A06:2021 – Vulnerable and Outdated Components`.
- **ISO/IEC 27001 Annex A:** `A.15 Supplier Relationships`.

## 2. Normative Directives

### 2.1 Dependency mới phải nằm trong allowlist

Mọi dependency mới thêm vào `package.json` phải nằm trong danh sách `dependencyAllowlist` ở
frontmatter phía trên — nâng cấp version của dependency đã có sẵn không bị ảnh hưởng bởi rule này.

### 2.2 Không thêm dependency chỉ để dùng một hàm tiện ích nhỏ

Không thêm dependency mới chỉ để dùng 1 hàm tiện ích nhỏ có thể tự viết trong vài dòng.

### 2.3 Dependency mới phải có lịch sử bảo trì tốt

Dependency mới phải có lịch sử bảo trì tốt (còn cập nhật, không có lỗ hổng bảo mật đã biết công
khai) trước khi được thêm vào allowlist.

## 3. Approved Exceptions & Carve-outs

Nếu thực sự cần một dependency mới, thêm tên (hoặc glob pattern, ví dụ `@scope/*`) của nó vào
`dependencyAllowlist` trong chính policy này như một phần của PR, không thêm âm thầm — đây là cách
"xin ngoại lệ" chính thức cho policy này, không phải một exception ngầm.

## 4. Automated Enforcement

- **Deterministic** — `dependencyRulesCheck.ts` đọc trực tiếp diff của `package.json`, so khớp mọi
  dependency thêm mới với `dependencyAllowlist` ở frontmatter phía trên. Rule 2.2/2.3 (chất lượng,
  lý do cần thiết) không tự động hoá được — đánh giá bằng review thủ công khi PR thêm entry mới vào
  allowlist.

## 5. Remediation & Escalation Guide

- **Tự sửa:** thêm tên package vào `dependencyAllowlist` trong PR cùng lúc với thay đổi
  `package.json`, kèm lý do ngắn gọn trong PR description.
- **Trước khi thêm vào allowlist:** chạy `npm audit` cho package mới, kiểm tra lịch sử publish/số
  lượt tải trên npm — không thêm package không rõ nguồn gốc hoặc mới publish, ít người dùng.
