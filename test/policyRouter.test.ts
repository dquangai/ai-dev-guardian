import { describe, it, expect } from "vitest";
import { routePolicies } from "../src/policy/router";
import type { Policy } from "../src/policy/types";

function makePolicy(overrides: Partial<Policy>): Policy {
  return {
    id: "test.policy.md",
    category: "Test",
    scope: [],
    severity: "medium",
    tags: [],
    body: "body",
    rules: [],
    dependencyAllowlist: [],
    gitWorkflow: [],
    ...overrides,
  };
}

describe("routePolicies", () => {
  it("policy với scope rỗng luôn được chọn (áp dụng toàn cục), bất kể changedFiles", () => {
    const global = makePolicy({ id: "global.md", scope: [] });
    expect(routePolicies([global], [])).toEqual([global]);
    expect(routePolicies([global], ["src/anything.ts"])).toEqual([global]);
  });

  it("policy với scope glob chỉ được chọn khi có file thay đổi khớp glob", () => {
    const scoped = makePolicy({ id: "scoped.md", scope: ["src/**/*.ts"] });
    expect(routePolicies([scoped], ["src/app.ts"])).toEqual([scoped]);
    expect(routePolicies([scoped], ["docs/readme.md"])).toEqual([]);
  });

  it("lọc đúng tập hợp con khi trộn nhiều policy với changedFiles hỗn hợp", () => {
    const global = makePolicy({ id: "global.md", scope: [] });
    const tsOnly = makePolicy({ id: "ts.md", scope: ["**/*.ts"] });
    const mdOnly = makePolicy({ id: "md.md", scope: ["**/*.md"] });

    const result = routePolicies([global, tsOnly, mdOnly], ["src/app.ts"]);
    expect(result.map((p) => p.id).sort()).toEqual(["global.md", "ts.md"]);
  });
});
