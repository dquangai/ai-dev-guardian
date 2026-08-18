/**
 * Static sample content for the 5 fixed Policy Playground demo scenarios — inert data, never
 * executed. Kept in its own file (rather than inline in playground.ts) specifically so
 * `.guardian/policies/security.policy.md`/`logging.policy.md`'s carve-outs for this exact path can
 * be a reliable, literal file-path match instead of asking the LLM check to infer "this looks like
 * vulnerable code but is actually just a demo sample" from context every time — the same
 * reliability trade already proven for `test/fixtures/**`, just scoped to this one file by exact
 * name.
 *
 * Content mirrors real eval dataset cases (eval/dataset/cases.ts) verbatim: tp-19, tp-20, tp-32,
 * tp-48, fp-22. Copied rather than imported — eval/ is measurement tooling, importing it into
 * server runtime would create a wrong-direction dependency if eval's structure changes later.
 */
export type ScenarioId = "jwt" | "redirect" | "importRules" | "decodeDisplay" | "noAuditLogOnRevoke";

export const PLAYGROUND_SCENARIOS: Record<ScenarioId, { file: string; lines: string[] }> = {
  jwt: {
    file: "sso/session.go",
    lines: [
      "func ParseSessionClaims(tokenString string) (*SessionClaims, error) {",
      "  parser := jwt.NewParser(jwt.WithoutClaimsValidation())",
      "  token, _, err := parser.ParseUnverified(tokenString, &SessionClaims{})",
      "  if err != nil {",
      "    return nil, err",
      "  }",
      "  claims := token.Claims.(*SessionClaims)",
      "  if claims.ExpiresAt < time.Now().Unix() {",
      '    return nil, errors.New("token expired")',
      "  }",
      "  return claims, nil",
      "}",
    ],
  },
  redirect: {
    file: "pages/SsoCallbackPage.tsx",
    lines: [
      "export function SsoCallbackPage({ location }: { location: Location }) {",
      "  const params = new URLSearchParams(location.search);",
      '  const returnUrl = params.get("returnUrl") ?? "/";',
      '  if (returnUrl.includes("v-id.vn")) {',
      "    window.location.href = returnUrl;",
      "  }",
      "  return <p>Đang chuyển hướng...</p>;",
      "}",
    ],
  },
  importRules: {
    file: "webhooks/partnerWebhook.ts",
    lines: [
      'import jwt from "jsonwebtoken";',
      "",
      "export function verifyPartnerWebhookToken(token: string): unknown {",
      '  return jwt.verify(token, process.env.PARTNER_WEBHOOK_SECRET as string, { algorithms: ["HS256"] });',
      "}",
    ],
  },
  decodeDisplay: {
    file: "ui/sessionExpiryBadge.ts",
    lines: [
      "export function decodeTokenUnsafe(token: string): { exp: number } {",
      "  return jwt.decode(token) as { exp: number }; // không verify chữ ký — chỉ đọc exp",
      "}",
      "",
      "export function renderSessionExpiryBadge(token: string) {",
      "  const { exp } = decodeTokenUnsafe(token); // chỉ dùng để hiển thị UI, không cấp quyền truy cập",
      "  return `Phiên hết hạn lúc ${new Date(exp * 1000).toLocaleTimeString()}`;",
      "}",
    ],
  },
  noAuditLogOnRevoke: {
    file: "sso/revokeHandler.go",
    lines: [
      "func RevokeToken(w http.ResponseWriter, r *http.Request, tokenID string) {",
      "  if err := revokeTokenByID(tokenID); err != nil {",
      '    log.Println("revoke failed")',
      '    http.Error(w, "error", http.StatusInternalServerError)',
      "    return",
      "  }",
      "  w.WriteHeader(http.StatusNoContent)",
      "}",
    ],
  },
};

export function isScenarioId(value: unknown): value is ScenarioId {
  return (
    value === "jwt" ||
    value === "redirect" ||
    value === "importRules" ||
    value === "decodeDisplay" ||
    value === "noAuditLogOnRevoke"
  );
}
