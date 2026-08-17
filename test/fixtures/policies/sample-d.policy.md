---
category: Git Workflow
severity: low
gitWorkflow:
  - branchPattern: "^feature/.+$"
    exemptBranches: ["master", "main"]
    commitPattern: "^(feat|fix): .+$"
    description: "Sample git-workflow rule for loader tests."
  - commitPattern: "^chore: .+$"
---

Sample policy with git-workflow rules.
