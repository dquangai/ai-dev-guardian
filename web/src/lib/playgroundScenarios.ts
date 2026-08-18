/**
 * Static display content for the 5 fixed Policy Playground demo scenarios — inert data, never
 * executed, purely for rendering the code panel. Mirrors
 * src/server/routes/playgroundScenarios.ts's content (server owns the authoritative copy used to
 * build the real diff; kept in sync by hand, small/stable/5 entries). Kept in its own file for the
 * same reason as the server copy: `.guardian/policies/security.policy.md`/`logging.policy.md`'s
 * carve-outs for this exact path are a reliable literal file-path match, not an LLM inference every
 * check run.
 *
 * expectedVerdict/ruleNote are display-only editorial context (not asserted by the server) — the
 * real verdict always comes from the live `/playground/run` response, these just set expectations
 * before Run Check and explain why the rule is V-ID-specific rather than a generic OWASP check.
 */
export type ScenarioId = 'jwt' | 'redirect' | 'importRules' | 'decodeDisplay' | 'noAuditLogOnRevoke'

export interface GenericAiComparison {
  /** Model actually called — always disclosed as a raw API call, never claimed to be the literal
   * ChatGPT web product or the Copilot IDE extension (neither is reachable from this environment).
   * ANTHROPIC_API_KEY is unset in this environment, so only OpenAI's configured model could
   * actually be called — never claim a model that wasn't really queried. */
  model: string
  testedAt: string
  /** Verbatim response text, recorded once and never altered — this is a historical record, not a
   * live call replayed on every page view. */
  response: string
  /** Honest one-line takeaway: did the generic model's free-text answer actually align with
   * Guardian's verdict for this scenario, or miss it? Derived by reading the real response above,
   * not asserted independent of it. */
  gapNote: string
}

export interface Scenario {
  label: string
  file: string
  lang: string
  lines: string[]
  highlightLine: number
  expectedVerdict: 'PASS' | 'BLOCK'
  ruleNote: string
  genericAiComparison: GenericAiComparison
}

export const PLAYGROUND_SCENARIOS: Record<ScenarioId, Scenario> = {
  jwt: {
    label: 'JWT decode-as-verify (Go)',
    file: 'sso/session.go',
    lang: 'GO',
    highlightLine: 3,
    expectedVerdict: 'BLOCK',
    ruleNote:
      'security.policy.md — decode-only JWT parsing (bỏ qua bước verify chữ ký) không phải lỗi OWASP Top 10 chuẩn, phải khai báo rõ pattern verify thật của V-ID mới bắt được.',
    lines: [
      'func ParseSessionClaims(tokenString string) (*SessionClaims, error) {',
      '  parser := jwt.NewParser(jwt.WithoutClaimsValidation())',
      '  token, _, err := parser.ParseUnverified(tokenString, &SessionClaims{})',
      '  if err != nil {',
      '    return nil, err',
      '  }',
      '  claims := token.Claims.(*SessionClaims)',
      '  if claims.ExpiresAt < time.Now().Unix() {',
      '    return nil, errors.New("token expired")',
      '  }',
      '  return claims, nil',
      '}',
    ],
    genericAiComparison: {
      model: 'gpt-4o — gọi thẳng API model gốc, KHÔNG phải sản phẩm ChatGPT/Copilot thật (phiên này không có ANTHROPIC_API_KEY thật để gọi Claude, chỉ OpenAI key có giá trị)',
      testedAt: '2026-08-18',
      response:
        "The code snippet parses a JWT token without verifying its signature, which is a security issue. Using `ParseUnverified` means that the token's validity isn't checked, making it vulnerable to manipulation. This can allow an attacker to modify the token contents and bypass any checks you might have based on the token's claims. It's crucial to verify the token's signature to ensure its integrity and authenticity. If signature verification is needed, consider using a parser method that validates the token with a known secret or public key.",
      gapNote: 'GPT-4o bắt đúng lỗi bảo mật này — không có khoảng cách với Guardian ở case này, đây là lỗi bảo mật kinh điển AI hiện đại đã biết.',
    },
  },
  redirect: {
    label: 'Open Redirect (React)',
    file: 'pages/SsoCallbackPage.tsx',
    lang: 'TSX',
    highlightLine: 4,
    expectedVerdict: 'BLOCK',
    ruleNote:
      'security.policy.md — domain v-id.vn cụ thể của dự án, .includes() thay vì parse hostname là lỗi runtime của riêng domain check này.',
    lines: [
      'export function SsoCallbackPage({ location }: { location: Location }) {',
      '  const params = new URLSearchParams(location.search);',
      '  const returnUrl = params.get("returnUrl") ?? "/";',
      '  if (returnUrl.includes("v-id.vn")) {',
      '    window.location.href = returnUrl;',
      '  }',
      '  return <p>Đang chuyển hướng...</p>;',
      '}',
    ],
    genericAiComparison: {
      model: 'gpt-4o — gọi thẳng API model gốc, KHÔNG phải sản phẩm ChatGPT/Copilot thật (phiên này không có ANTHROPIC_API_KEY thật để gọi Claude, chỉ OpenAI key có giá trị)',
      testedAt: '2026-08-18',
      response:
        'This code contains a potential security issue known as an open redirect vulnerability. By directly using a query parameter (`returnUrl`) to redirect the user without proper validation or sanitization, an attacker could exploit this to redirect users to a malicious site. To mitigate this, you should validate the `returnUrl` against a whitelist of allowed domains or paths before performing the redirect. Apart from this issue, the code is otherwise clean and functional.',
      gapNote: 'GPT-4o cũng bắt đúng open redirect — không có khoảng cách với Guardian ở case này.',
    },
  },
  importRules: {
    label: 'Raw JWT import (bỏ qua wrapper)',
    file: 'webhooks/partnerWebhook.ts',
    lang: 'TS',
    highlightLine: 1,
    expectedVerdict: 'BLOCK',
    ruleNote:
      'import-rules.policy.md — chỉ V-ID mới có wrapper nội bộ ../auth/tokenVerifier bắt buộc; import thẳng jsonwebtoken chỉ sai vì lệch KIẾN TRÚC nội bộ, code tự nó không có lỗi kỹ thuật gì.',
    lines: [
      'import jwt from "jsonwebtoken";',
      '',
      'export function verifyPartnerWebhookToken(token: string): unknown {',
      '  return jwt.verify(token, process.env.PARTNER_WEBHOOK_SECRET as string, { algorithms: ["HS256"] });',
      '}',
    ],
    genericAiComparison: {
      model: 'gpt-4o — gọi thẳng API model gốc, KHÔNG phải sản phẩm ChatGPT/Copilot thật (phiên này không có ANTHROPIC_API_KEY thật để gọi Claude, chỉ OpenAI key có giá trị)',
      testedAt: '2026-08-18',
      response:
        'The code snippet uses the "jsonwebtoken" library to verify a JWT token using a secret key stored in an environment variable. There are no apparent bugs, but there are a few considerations for code quality and security: 1. Error Handling — wrap jwt.verify in try-catch. 2. Environment Variable Check — ensure PARTNER_WEBHOOK_SECRET is set. 3. Type Safety — consider a more precise return type than unknown.',
      gapNote: 'Bỏ sót vi phạm import-rules.policy.md — đây là quy ước KIẾN TRÚC nội bộ của V-ID (bắt buộc dùng wrapper ../auth/tokenVerifier), không nằm trong training data hay chuẩn OWASP chung.',
    },
  },
  decodeDisplay: {
    label: 'jwt.decode() chỉ để hiển thị UI',
    file: 'ui/sessionExpiryBadge.ts',
    lang: 'TS',
    highlightLine: 2,
    expectedVerdict: 'PASS',
    ruleNote:
      'Tên hàm decodeTokenUnsafe trung thực + không dùng để authorize gì cả, chỉ render UI — phân biệt đúng/sai đòi hỏi đọc luồng dữ liệu, không chỉ pattern-match tên hàm "decode".',
    lines: [
      'export function decodeTokenUnsafe(token: string): { exp: number } {',
      '  return jwt.decode(token) as { exp: number }; // không verify chữ ký — chỉ đọc exp',
      '}',
      '',
      'export function renderSessionExpiryBadge(token: string) {',
      '  const { exp } = decodeTokenUnsafe(token); // chỉ dùng để hiển thị UI, không cấp quyền truy cập',
      '  return `Phiên hết hạn lúc ${new Date(exp * 1000).toLocaleTimeString()}`;',
      '}',
    ],
    genericAiComparison: {
      model: 'gpt-4o — gọi thẳng API model gốc, KHÔNG phải sản phẩm ChatGPT/Copilot thật (phiên này không có ANTHROPIC_API_KEY thật để gọi Claude, chỉ OpenAI key có giá trị)',
      testedAt: '2026-08-18',
      response:
        "The code snippet provided decodes a JWT token without verifying its signature, which can be a security risk if the decoded information is used for authorization purposes. However, in this specific context, the comment indicates that it's only used for UI display and not for granting access, which mitigates the risk. The use of `as { exp: number }` assumes that the `exp` claim is always present, which could lead to runtime errors if the token does not have this structure. Consider adding error handling to manage cases where the token does not contain an `exp` field. Otherwise, there are no major issues if the usage context aligns with the described intent.",
      gapNote: 'GPT-4o cũng đọc đúng comment, kết luận an toàn — khớp verdict PASS của Guardian, không phải false positive như suy đoán ban đầu.',
    },
  },
  noAuditLogOnRevoke: {
    label: 'Thu hồi token không ghi audit log',
    file: 'sso/revokeHandler.go',
    lang: 'GO',
    highlightLine: 7,
    expectedVerdict: 'BLOCK',
    ruleNote:
      'logging.policy.md 2.1 — code không có lỗi kỹ thuật nào (compile được, xử lý lỗi đúng, trả đúng HTTP status), chỉ THIẾU 1 dòng audit log theo yêu cầu compliance nội bộ V-ID cho hành động thu hồi token. Không có code smell nào để nhận ra nếu không biết yêu cầu này tồn tại.',
    lines: [
      'func RevokeToken(w http.ResponseWriter, r *http.Request, tokenID string) {',
      '  if err := revokeTokenByID(tokenID); err != nil {',
      '    log.Println("revoke failed")',
      '    http.Error(w, "error", http.StatusInternalServerError)',
      '    return',
      '  }',
      '  w.WriteHeader(http.StatusNoContent)',
      '}',
    ],
    genericAiComparison: {
      model: 'gpt-4o — gọi thẳng API model gốc, KHÔNG phải sản phẩm ChatGPT/Copilot thật (phiên này không có ANTHROPIC_API_KEY thật để gọi Claude, chỉ OpenAI key có giá trị)',
      testedAt: '2026-08-18',
      response:
        'The code snippet appears to handle the revocation of a token by its ID and sends the appropriate HTTP status code based on the success or failure of the operation. There are no apparent bugs, security issues, or code quality problems in this snippet. It correctly logs an error message and returns a 500 status code if the token revocation fails, and it returns a 204 status code on success. Everything seems to be implemented correctly for this functionality.',
      gapNote: 'Bỏ sót hoàn toàn — test lặp lại 4/4 lần đều kết luận "không có vấn đề gì". Đây là khoảng cách RÕ NHẤT trong các case: không có code smell nào để nhận ra, chỉ có thể biết nếu đã đọc policy compliance nội bộ của V-ID.',
    },
  },
}
