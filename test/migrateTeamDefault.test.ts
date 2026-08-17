import { describe, it, expect } from "vitest";
import { buildMigrationTuples, ORG_ID, DEFAULT_TEAM_ID } from "../src/server/authz/migrateTeamDefault";
import { SEED_USER_IDS } from "../src/server/users";

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
      user: `user:${SEED_USER_IDS["super-admin"]}`,
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

  it("gán engine_config:default thuộc org + admin (view+edit) + auditor (view only) — T-22", () => {
    expect(tuples).toContainEqual({
      user: `organization:${ORG_ID}`,
      relation: "org",
      object: "engine_config:default",
    });
    expect(tuples).toContainEqual({ user: "user:admin-1", relation: "can_view", object: "engine_config:default" });
    expect(tuples).toContainEqual({ user: "user:admin-1", relation: "can_edit", object: "engine_config:default" });
    expect(tuples).toContainEqual({ user: "user:auditor-1", relation: "can_view", object: "engine_config:default" });
    expect(tuples).not.toContainEqual({
      user: "user:auditor-1",
      relation: "can_edit",
      object: "engine_config:default",
    });
  });

  it("tổng đúng 10 tuple khi không truyền policyIds (1 org-team-link + 1 super_admin + 4 role user + 4 engine_config)", () => {
    expect(tuples).toHaveLength(10);
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
    expect(withPolicies).toHaveLength(12);
  });

  it("không truyền policyIds thì không tự thêm tuple policy nào (mặc định [])", () => {
    expect(buildMigrationTuples()).toEqual(buildMigrationTuples([]));
  });
});
