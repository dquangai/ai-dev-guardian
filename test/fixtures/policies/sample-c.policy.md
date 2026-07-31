---
category: Architecture
severity: high
rules:
  - from: "src/policy/**"
    forbid: "src/checks/**"
    description: "Policy layer không được phụ thuộc ngược lên checks layer."
  - from: "src/malformed/**"
---

Sample policy with architecture rules.
