import { describe, it, expect } from "vitest";
import { signToken, verifyToken } from "../src/server/token";

const PAYLOAD = { sub: "admin-1", role: "admin" as const, name: "Alex Morgan", email: "admin@guardian.dev" };

describe("signToken / verifyToken", () => {
  it("verifies a token it just signed and returns the original payload", () => {
    const token = signToken(PAYLOAD, false);
    expect(verifyToken(token)).toMatchObject(PAYLOAD);
  });

  it("rejects garbage input instead of throwing", () => {
    expect(verifyToken("not-a-real-token")).toBeNull();
    expect(verifyToken("")).toBeNull();
  });

  it("rejects a token whose signature was tampered with", () => {
    const token = signToken(PAYLOAD, false);
    const [header, payload, signature] = token.split(".");
    const flippedSignature = signature.slice(0, -1) + (signature.at(-1) === "a" ? "b" : "a");
    expect(verifyToken([header, payload, flippedSignature].join("."))).toBeNull();
  });

  it("rejects a payload tampered with to claim a different role", () => {
    const token = signToken(PAYLOAD, false);
    const [header, , signature] = token.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ ...PAYLOAD, role: "senior-dev" })).toString(
      "base64url"
    );
    expect(verifyToken([header, forgedPayload, signature].join("."))).toBeNull();
  });
});
