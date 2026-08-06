import { describe, it, expect } from "vitest";
import { buildMigrationTuples, ORG_ID, DEFAULT_TEAM_ID } from "../src/server/authz/migrateTeamDefault";
import { DEMO_USERS } from "../src/server/users";

describe("buildMigrationTuples", () => {
  const tuples = buildMigrationTuples();

  it("gán team-default thuộc organization:vsf (bài học T-19 — thiếu tuple này Super Admin sẽ 'mù')", () => {
    expect(tuples).toContainEqual({
      user: `organization:${ORG_ID}`,
      relation: "org",
      object: `team:${DEFAULT_TEAM_ID}`,
    });
  });

  it("gán super-admin demo user vào relation super_admin của organization", () => {
    expect(tuples).toContainEqual({
      user: `user:${DEMO_USERS["super-admin"].id}`,
      relation: "super_admin",
      object: `organization:${ORG_ID}`,
    });
  });

  it("gán đúng cả 4 demo user cũ vào đúng role cũ trong team-default", () => {
    expect(tuples).toContainEqual({ user: "user:admin-1", relation: "admin", object: "team:team-default" });
    expect(tuples).toContainEqual({
      user: "user:senior-dev-1",
      relation: "senior_dev",
      object: "team:team-default",
    });
    expect(tuples).toContainEqual({
      user: "user:developer-1",
      relation: "developer",
      object: "team:team-default",
    });
    expect(tuples).toContainEqual({ user: "user:auditor-1", relation: "auditor", object: "team:team-default" });
  });

  it("tổng đúng 6 tuple khi không truyền policyIds (1 org-link + 1 super_admin + 4 role user)", () => {
    expect(tuples).toHaveLength(6);
  });

  it("gán mọi policyId truyền vào thuộc team-default (bài học tìm được lúc verify sống T-21)", () => {
    const withPolicies = buildMigrationTuples(["architecture.policy.md", "security.policy.md"]);
    expect(withPolicies).toContainEqual({
      user: `team:${DEFAULT_TEAM_ID}`,
      relation: "team",
      object: "policy:architecture.policy.md",
    });
    expect(withPolicies).toContainEqual({
      user: `team:${DEFAULT_TEAM_ID}`,
      relation: "team",
      object: "policy:security.policy.md",
    });
    expect(withPolicies).toHaveLength(8);
  });

  it("không truyền policyIds thì không tự thêm tuple policy nào (mặc định [])", () => {
    expect(buildMigrationTuples()).toEqual(buildMigrationTuples([]));
  });
});
