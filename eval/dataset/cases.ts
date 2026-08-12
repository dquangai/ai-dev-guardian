import type { EvalCase } from "../types";

/**
 * Every case is a brand-new file (`--- /dev/null`) so no real on-disk fixture is needed —
 * `readFileContextSafe` just returns null for a path that doesn't exist, which is a normal,
 * fail-open path the real checker already handles (see src/checks/llm/fileContext.ts). File paths
 * live under "eval-samples/" specifically so they never collide with a real path in this repo.
 */
function newFileDiff(file: string, contentLines: string[]): string {
  return [
    `diff --git a/${file} b/${file}`,
    `new file mode 100644`,
    `index 0000000..1111111`,
    `--- /dev/null`,
    `+++ b/${file}`,
    `@@ -0,0 +1,${contentLines.length} @@`,
    ...contentLines.map((line) => `+${line}`),
  ].join("\n");
}

function makeCase(
  id: string,
  description: string,
  group: EvalCase["group"],
  policyIds: string[],
  file: string,
  contentLines: string[]
): EvalCase {
  return {
    id,
    description,
    group,
    policyIds,
    changedFiles: [file],
    diffText: newFileDiff(file, contentLines),
  };
}

const SECURITY = "security.policy.md";
const CODING_CONVENTION = "coding-convention.policy.md";
const RBAC = "rbac.policy.md";
const LOGGING = "logging.policy.md";
const NAMING_CONVENTION = "naming-convention.policy.md";
const IMPORT_RULES = "import-rules.policy.md";
const PERFORMANCE = "performance.policy.md";
const DISABLED_SECURITY_CONTROL = "disabled-security-control.policy.md";
const DEAD_CODE = "dead-code.policy.md";
const ARCHITECTURE = "architecture.policy.md";

export const EVAL_CASES: EvalCase[] = [
  // ── True positives: real violations, should be BLOCKed ──────────────────

  makeCase(
    "tp-01-aws-secret",
    "Hardcoded AWS access key committed to source",
    "true-positive",
    [SECURITY],
    "eval-samples/tp-01-aws-secret.ts",
    [
      "export const AWS_CONFIG = {",
      '  region: "us-east-1",',
      '  accessKeyId: "AKIAABCDEFGHIJKLMNOP",',
      "};",
    ]
  ),

  makeCase(
    "tp-02-generic-api-key",
    "Hardcoded generic API key string assigned to a variable",
    "true-positive",
    [SECURITY],
    "eval-samples/tp-02-generic-api-key.ts",
    [
      "export function createPaymentClient() {",
      '  const apiKey = "sk_live_9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c";',
      "  return new PaymentClient(apiKey);",
      "}",
    ]
  ),

  makeCase(
    "tp-03-md5-password",
    "Uses MD5 to hash a user password",
    "true-positive",
    [SECURITY],
    "eval-samples/tp-03-md5-password.ts",
    [
      'import crypto from "node:crypto";',
      "",
      "export function hashPassword(password: string): string {",
      '  return crypto.createHash("md5").update(password).digest("hex");',
      "}",
    ]
  ),

  makeCase(
    "tp-04-sql-injection",
    "Builds a SQL query via string concatenation from unsanitized user input",
    "true-positive",
    [SECURITY],
    "eval-samples/tp-04-sql-injection.ts",
    [
      "export async function findUserByEmail(req: Request, db: Database) {",
      "  const email = req.query.email;",
      "  const sql = \"SELECT * FROM users WHERE email = '\" + email + \"'\";",
      "  return db.raw(sql);",
      "}",
    ]
  ),

  makeCase(
    "tp-05-auth-bypass-commented-out",
    "Existing auth middleware check commented out to 'test quickly'",
    "true-positive",
    [DISABLED_SECURITY_CONTROL],
    "eval-samples/tp-05-auth-bypass-commented-out.ts",
    [
      "export function adminOnly(req: Request, res: Response, next: NextFunction) {",
      "  // if (req.user?.role !== \"admin\") return res.status(403).send(\"Forbidden\");",
      "  // tạm comment để test nhanh, nhớ bật lại trước khi merge",
      "  next();",
      "}",
    ]
  ),

  makeCase(
    "tp-06-log-sensitive-value",
    "Logs a raw JWT/password value to the console",
    "true-positive",
    [SECURITY],
    "eval-samples/tp-06-log-sensitive-value.ts",
    [
      "export function debugLogin(username: string, password: string, token: string) {",
      '  console.log("Login attempt", { username, password, token });',
      "  return authenticate(username, password);",
      "}",
    ]
  ),

  makeCase(
    "tp-07-tls-verification-disabled",
    "Disables TLS certificate verification for an outgoing HTTPS request",
    "true-positive",
    [SECURITY],
    "eval-samples/tp-07-tls-verification-disabled.ts",
    [
      'import https from "node:https";',
      "",
      "export const insecureAgent = new https.Agent({",
      "  rejectUnauthorized: false,",
      "});",
    ]
  ),

  makeCase(
    "tp-08-any-no-justification",
    "Uses `any` with no explanatory comment",
    "true-positive",
    [CODING_CONVENTION],
    "eval-samples/tp-08-any-no-justification.ts",
    [
      "export function parseWebhookPayload(raw: string) {",
      "  let data: any;",
      "  data = JSON.parse(raw);",
      "  return data;",
      "}",
    ]
  ),

  makeCase(
    "tp-09-leftover-debug-log",
    "Leftover debug console.log left in code being prepared for merge",
    "true-positive",
    [CODING_CONVENTION],
    "eval-samples/tp-09-leftover-debug-log.ts",
    [
      "export function calculateTotal(items: CartItem[]): number {",
      "  const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);",
      '  console.log("debug: total is", total);',
      "  return total;",
      "}",
    ]
  ),

  makeCase(
    "tp-10-dead-code-block",
    "Large block of old commented-out code left in the diff",
    "true-positive",
    [DEAD_CODE],
    "eval-samples/tp-10-dead-code-block.ts",
    [
      "export function formatInvoice(invoice: Invoice): string {",
      "  // const legacyFormat = invoice.items.map(i => {",
      "  //   return `${i.name} x${i.qty} = ${i.price * i.qty}`;",
      "  // }).join('\\n');",
      "  // return `Invoice #${invoice.id}\\n${legacyFormat}\\nTotal: ${invoice.total}`;",
      "  return `Invoice #${invoice.id} — Total: ${invoice.total}`;",
      "}",
    ]
  ),

  makeCase(
    "tp-11-multi-responsibility-function",
    "One 50+ line function mixing input validation, DB write, and email sending",
    "true-positive",
    [CODING_CONVENTION],
    "eval-samples/tp-11-multi-responsibility-function.ts",
    [
      "export async function registerUser(input: RegisterInput, db: Database, mailer: Mailer) {",
      "  // --- validation ---",
      "  if (!input.email || !input.email.includes(\"@\")) {",
      '    throw new Error("Invalid email");',
      "  }",
      "  if (!input.password || input.password.length < 8) {",
      '    throw new Error("Password too short");',
      "  }",
      "  if (!input.username || input.username.trim().length === 0) {",
      '    throw new Error("Username required");',
      "  }",
      "  if (input.age !== undefined && input.age < 13) {",
      '    throw new Error("User too young");',
      "  }",
      "  if (input.country && input.country.length !== 2) {",
      '    throw new Error("Invalid country code");',
      "  }",
      "  const normalizedEmail = input.email.trim().toLowerCase();",
      "  const normalizedUsername = input.username.trim();",
      "",
      "  // --- persistence ---",
      "  const existing = await db.users.findOne({ email: normalizedEmail });",
      "  if (existing) {",
      '    throw new Error("Email already registered");',
      "  }",
      "  const passwordHash = await hashPasswordSecurely(input.password);",
      "  const user = await db.users.insert({",
      "    email: normalizedEmail,",
      "    username: normalizedUsername,",
      "    passwordHash,",
      "    country: input.country ?? null,",
      "    createdAt: new Date(),",
      "  });",
      "  await db.auditLog.insert({",
      '    action: "user.registered",',
      "    userId: user.id,",
      "    at: new Date(),",
      "  });",
      "",
      "  // --- notification ---",
      "  const welcomeSubject = \"Welcome to the platform!\";",
      "  const welcomeBody = `Hi ${normalizedUsername}, thanks for signing up.`;",
      "  await mailer.send({",
      "    to: normalizedEmail,",
      "    subject: welcomeSubject,",
      "    body: welcomeBody,",
      "  });",
      "  const adminBody = `New user registered: ${normalizedEmail}`;",
      "  await mailer.send({",
      '    to: "admin@example.com",',
      '    subject: "New user registered",',
      "    body: adminBody,",
      "  });",
      "",
      "  return user;",
      "}",
    ]
  ),

  makeCase(
    "tp-12-non-camelcase-function",
    "Function named with snake_case, violating the project's camelCase convention",
    "true-positive",
    [CODING_CONVENTION],
    "eval-samples/tp-12-non-camelcase-function.ts",
    [
      "export function get_user_data(userId: string) {",
      "  return db.users.findById(userId);",
      "}",
    ]
  ),

  // ── False-positive traps: clean code with deceptive surface text, should PASS ───

  makeCase(
    "fp-01-any-mentioned-in-vietnamese-comment",
    "Comment mentions the word 'any' in Vietnamese prose, not as a TypeScript type",
    "false-positive-trap",
    [CODING_CONVENTION],
    "eval-samples/fp-01-any-mentioned-in-vietnamese-comment.ts",
    [
      "export function safeParse(raw: string): ParsedResult | null {",
      "  try {",
      "    // xử lý any lỗi có thể xảy ra khi parse JSON không hợp lệ",
      "    return JSON.parse(raw) as ParsedResult;",
      "  } catch {",
      "    return null;",
      "  }",
      "}",
    ]
  ),

  makeCase(
    "fp-02-string-describes-secret-concept",
    "A message string describes the 'no hardcoded secret' rule as a concept, not an actual secret",
    "false-positive-trap",
    [SECURITY],
    "eval-samples/fp-02-string-describes-secret-concept.ts",
    [
      "export const SECURITY_RULE_MESSAGE = {",
      '  why: "Không hardcode secret thật vào code — dùng biến môi trường hoặc secret manager.",',
      "};",
    ]
  ),

  makeCase(
    "fp-03-placeholder-key-in-comment",
    "A placeholder example API key appears only in a setup comment, not as a real credential",
    "false-positive-trap",
    [SECURITY],
    "eval-samples/fp-03-placeholder-key-in-comment.ts",
    [
      "// Cấu hình trước khi chạy: đặt biến môi trường ANTHROPIC_API_KEY=sk-ant-... trong file .env",
      "export function loadConfig() {",
      "  return {",
      "    anthropicKey: process.env.ANTHROPIC_API_KEY,",
      "  };",
      "}",
    ]
  ),

  makeCase(
    "fp-04-technical-constant-not-credential",
    "A fixed git SHA constant that superficially resembles a credential string",
    "false-positive-trap",
    [SECURITY],
    "eval-samples/fp-04-technical-constant-not-credential.ts",
    [
      "export const BUILD_COMMIT_SHA = \"a1b2c3d4e5f60718293a4b5c6d7e8f9a0b1c2d3\";",
      "",
      "export function getBuildInfo() {",
      "  return { commit: BUILD_COMMIT_SHA };",
      "}",
    ]
  ),

  makeCase(
    "fp-05-log-non-sensitive-result",
    "Logs a check result/status message that contains no credential or PII",
    "false-positive-trap",
    [SECURITY],
    "eval-samples/fp-05-log-non-sensitive-result.ts",
    [
      "export function runCheck(): CheckReport {",
      "  const report = performCheck();",
      '  console.log("[guardian] Kiểm tra hoàn tất, verdict:", report.verdict);',
      "  return report;",
      "}",
    ]
  ),

  makeCase(
    "fp-06-any-with-justification",
    "Uses `any` but with an explicit justifying comment, matching the policy's own carve-out",
    "false-positive-trap",
    [CODING_CONVENTION],
    "eval-samples/fp-06-any-with-justification.ts",
    [
      "export function callLegacySdk(payload: unknown) {",
      "  // dùng any vì third-party SDK không có type definition (không có @types package)",
      "  const response: any = legacySdk.call(payload);",
      "  return response;",
      "}",
    ]
  ),

  makeCase(
    "fp-07-reads-auth-for-diagnostics",
    "Reads and logs the current user's role for a diagnostics endpoint, without disabling auth",
    "false-positive-trap",
    [SECURITY],
    "eval-samples/fp-07-reads-auth-for-diagnostics.ts",
    [
      "export function diagnosticsHandler(req: Request, res: Response) {",
      "  res.json({",
      "    role: req.user?.role ?? null,",
      "    teamId: req.teamId ?? null,",
      "  });",
      "}",
    ]
  ),

  makeCase(
    "fp-08-local-cli-no-auth-needed",
    "A local CLI script with no auth check — legitimately doesn't need one, per the policy's own carve-out",
    "false-positive-trap",
    [SECURITY],
    "eval-samples/fp-08-local-cli-no-auth-needed.ts",
    [
      "export function readLocalConfig(configPath: string): AppConfig {",
      "  const raw = fs.readFileSync(configPath, \"utf-8\");",
      "  return JSON.parse(raw) as AppConfig;",
      "}",
    ]
  ),

  makeCase(
    "fp-09-parameterized-query-with-risk-comment",
    "A code-review-style comment discusses SQL injection risk, but the actual query is correctly parameterized",
    "false-positive-trap",
    [SECURITY],
    "eval-samples/fp-09-parameterized-query-with-risk-comment.ts",
    [
      "export async function findUserByEmail(email: string, db: Database) {",
      "  // Lưu ý: tránh SQL injection bằng cách luôn dùng parameterized query, không nối chuỗi trực tiếp.",
      '  return db.query("SELECT * FROM users WHERE email = ?", [email]);',
      "}",
    ]
  ),

  makeCase(
    "fp-10-long-but-cohesive-function",
    "A 50+ line function that is verbose but single-responsibility (pure sequential validation)",
    "false-positive-trap",
    [CODING_CONVENTION],
    "eval-samples/fp-10-long-but-cohesive-function.ts",
    [
      "export function validateOrderForm(form: OrderForm): string[] {",
      "  const errors: string[] = [];",
      '  if (!form.customerName) errors.push("customerName is required");',
      '  if (!form.customerEmail) errors.push("customerEmail is required");',
      '  if (!form.shippingAddress) errors.push("shippingAddress is required");',
      '  if (!form.shippingCity) errors.push("shippingCity is required");',
      '  if (!form.shippingCountry) errors.push("shippingCountry is required");',
      '  if (!form.shippingPostalCode) errors.push("shippingPostalCode is required");',
      '  if (!form.billingAddress) errors.push("billingAddress is required");',
      '  if (!form.billingCity) errors.push("billingCity is required");',
      '  if (!form.billingCountry) errors.push("billingCountry is required");',
      '  if (!form.billingPostalCode) errors.push("billingPostalCode is required");',
      '  if (!form.paymentMethod) errors.push("paymentMethod is required");',
      '  if (!form.items || form.items.length === 0) errors.push("items must not be empty");',
      "  if (form.items) {",
      "    for (const item of form.items) {",
      '      if (!item.sku) errors.push("item.sku is required");',
      '      if (item.quantity <= 0) errors.push("item.quantity must be positive");',
      '      if (item.unitPrice < 0) errors.push("item.unitPrice cannot be negative");',
      "    }",
      "  }",
      '  if (form.discountCode && form.discountCode.length > 20) errors.push("discountCode too long");',
      '  if (form.notes && form.notes.length > 500) errors.push("notes too long");',
      "  if (form.customerEmail && !form.customerEmail.includes(\"@\")) {",
      '    errors.push("customerEmail is invalid");',
      "  }",
      "  if (form.shippingPostalCode && !/^[0-9]{4,10}$/.test(form.shippingPostalCode)) {",
      '    errors.push("shippingPostalCode format is invalid");',
      "  }",
      "  if (form.billingPostalCode && !/^[0-9]{4,10}$/.test(form.billingPostalCode)) {",
      '    errors.push("billingPostalCode format is invalid");',
      "  }",
      "  return errors;",
      "}",
    ]
  ),

  // ── Batch 2: enterprise policies (rbac/logging/naming-convention/import-rules/performance) ──
  // Every case below is designed to require reading/understanding the surrounding context —
  // no case in this batch is catchable by a naive keyword/regex scan alone.

  // ── True positives ──────────────────────────────────────────────────────

  makeCase(
    "tp-13-header-based-admin-bypass",
    "Custom x-admin-secret header check used instead of the project's authz middleware",
    "true-positive",
    [RBAC],
    "eval-samples/tp-13-header-based-admin-bypass.ts",
    [
      "export function deleteUserAccount(req: Request, res: Response, userService: UserService) {",
      '  if (req.headers["x-admin-secret"] === "letmein-2024") {',
      "    userService.deleteUser(req.params.userId);",
      "    return res.status(204).send();",
      "  }",
      '  return res.status(403).send("Forbidden");',
      "}",
    ]
  ),

  makeCase(
    "tp-14-header-based-admin-bypass-python",
    "Same custom-header admin bypass anti-pattern, in a Python Flask route",
    "true-positive",
    [RBAC],
    "eval-samples/tp-14-header-based-admin-bypass.py",
    [
      '@app.route("/admin/users/<user_id>", methods=["DELETE"])',
      "def delete_user(user_id):",
      '    if request.headers.get("X-Admin-Secret") == "letmein-2024":',
      "        user_service.delete_user(user_id)",
      '        return "", 204',
      '    return "Forbidden", 403',
    ]
  ),

  makeCase(
    "tp-15-sql-injection-via-intermediary-var",
    "SQL injection built through an intermediary clause variable, not a direct one-line concat",
    "true-positive",
    [SECURITY],
    "eval-samples/tp-15-sql-injection-via-intermediary-var.ts",
    [
      "export async function searchOrders(req: Request, db: Database) {",
      "  const rawStatus = req.query.status as string;",
      "  const clause = `status = '${rawStatus}'`;",
      "  const sql = `SELECT * FROM orders WHERE ${clause}`;",
      "  return db.raw(sql);",
      "}",
    ]
  ),

  makeCase(
    "tp-16-sql-injection-fmt-sprintf-go",
    "SQL injection in Go built via fmt.Sprintf through an intermediary clause variable",
    "true-positive",
    [SECURITY],
    "eval-samples/tp-16-sql-injection-fmt-sprintf.go",
    [
      "func FindOrdersByStatus(db *sql.DB, status string) (*sql.Rows, error) {",
      "  clause := fmt.Sprintf(\"status = '%s'\", status)",
      '  query := fmt.Sprintf("SELECT * FROM orders WHERE %s", clause)',
      "  return db.Query(query)",
      "}",
    ]
  ),

  makeCase(
    "tp-17-tls-reject-unauthorized-disabled",
    "NODE_TLS_REJECT_UNAUTHORIZED disabled inside an innocuous-looking bootstrap function",
    "true-positive",
    [SECURITY],
    "eval-samples/tp-17-tls-reject-unauthorized-disabled.ts",
    [
      "export function bootstrapInternalHttpClient() {",
      "  // Cấu hình nội bộ trước khi khởi tạo client gọi API đối tác",
      '  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";',
      '  return axios.create({ baseURL: "https://partner-api.internal" });',
      "}",
    ]
  ),

  makeCase(
    "tp-18-requests-verify-false-python",
    "Python requests call disables TLS verification, buried inside a helper function",
    "true-positive",
    [SECURITY],
    "eval-samples/tp-18-requests-verify-false.py",
    [
      "def fetch_partner_profile(partner_id):",
      "    session = requests.Session()",
      '    session.headers.update({"Accept": "application/json"})',
      '    response = session.get(f"https://partner-api.internal/{partner_id}", verify=False)',
      "    return response.json()",
    ]
  ),

  makeCase(
    "tp-19-jwt-decode-as-verify-go",
    "Go session parsing uses ParseUnverified (decode-only) then manually checks exp, same class of bug as jwt.decode()",
    "true-positive",
    [SECURITY],
    "eval-samples/tp-19-jwt-decode-as-verify.go",
    [
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
    ]
  ),

  makeCase(
    "tp-20-open-redirect-substring-check-tsx",
    "React SSO callback page validates the return URL with .includes() instead of parsing hostname",
    "true-positive",
    [SECURITY],
    "eval-samples/tp-20-open-redirect-substring-check.tsx",
    [
      "export function SsoCallbackPage({ location }: { location: Location }) {",
      "  const params = new URLSearchParams(location.search);",
      '  const returnUrl = params.get("returnUrl") ?? "/";',
      '  if (returnUrl.includes("v-id.vn")) {',
      "    window.location.href = returnUrl;",
      "  }",
      "  return <p>Đang chuyển hướng...</p>;",
      "}",
    ]
  ),

  makeCase(
    "tp-21-trust-client-role-param-python",
    "Flask route trusts a role value taken straight from the query string to grant cross-tenant access",
    "true-positive",
    [RBAC],
    "eval-samples/tp-21-trust-client-role-param.py",
    [
      '@app.route("/invoices")',
      "def list_invoices():",
      '    role = request.args.get("role")',
      '    if role == "admin":',
      "        return jsonify(invoice_service.get_all_invoices_across_teams())",
      "    return jsonify(invoice_service.get_invoices_for_current_user(current_user_id()))",
    ]
  ),

  makeCase(
    "tp-22-skip-auth-query-param-backdoor",
    "Auth middleware silently bypassed via a ?skipAuth=1 query param left in production code",
    "true-positive",
    [RBAC],
    "eval-samples/tp-22-skip-auth-query-param.ts",
    [
      "export function requireAuth(req: Request, res: Response, next: NextFunction) {",
      '  if (req.query.skipAuth === "1") {',
      "    return next();",
      "  }",
      "  if (!req.session?.userId) {",
      '    return res.status(401).send("Unauthorized");',
      "  }",
      "  return next();",
      "}",
    ]
  ),

  makeCase(
    "tp-23-as-any-cast-tsx",
    "React component casts a typed config object to any to sidestep a type error, no justification",
    "true-positive",
    [CODING_CONVENTION],
    "eval-samples/tp-23-as-any-cast.tsx",
    [
      "export function ExperimentBanner({ config }: { config: ExperimentConfig }) {",
      "  const variant = (config as any).variant;",
      '  return <div className="banner">{variant}</div>;',
      "}",
    ]
  ),

  makeCase(
    "tp-24-window-as-any",
    "Reads an undocumented global via (window as any) with no explanatory comment",
    "true-positive",
    [CODING_CONVENTION],
    "eval-samples/tp-24-window-as-any.ts",
    [
      "export function readAnalyticsQueue(): unknown[] {",
      "  return (window as any).__analyticsQueue ?? [];",
      "}",
    ]
  ),

  makeCase(
    "tp-25-misleading-verify-token-name-go",
    "Go function named VerifyToken but internally only parses the token without checking its signature",
    "true-positive",
    [NAMING_CONVENTION, SECURITY],
    "eval-samples/tp-25-misleading-verify-token-name.go",
    [
      "func VerifyToken(tokenString string) (*SessionClaims, error) {",
      "  parser := jwt.NewParser(jwt.WithoutClaimsValidation())",
      "  token, _, err := parser.ParseUnverified(tokenString, &SessionClaims{})",
      "  if err != nil {",
      "    return nil, err",
      "  }",
      "  return token.Claims.(*SessionClaims), nil",
      "}",
    ]
  ),

  makeCase(
    "tp-26-order-checkout-multi-responsibility",
    "A ~40-line checkout function mixing validation, payment charge, DB write, and email in one place",
    "true-positive",
    [CODING_CONVENTION],
    "eval-samples/tp-26-order-checkout-multi-responsibility.ts",
    [
      "export async function checkoutOrder(",
      "  input: CheckoutInput,",
      "  db: Database,",
      "  paymentGateway: PaymentGateway,",
      "  mailer: Mailer",
      ") {",
      "  if (!input.cartId) {",
      '    throw new Error("cartId is required");',
      "  }",
      "  if (!input.shippingAddress) {",
      '    throw new Error("shippingAddress is required");',
      "  }",
      "  if (input.items.length === 0) {",
      '    throw new Error("cart is empty");',
      "  }",
      "  const total = input.items.reduce((sum, item) => sum + item.price * item.qty, 0);",
      "  if (total <= 0) {",
      '    throw new Error("invalid order total");',
      "  }",
      "",
      "  const charge = await paymentGateway.charge({",
      "    amount: total,",
      '    currency: "VND",',
      "    customerId: input.customerId,",
      "  });",
      '  if (charge.status !== "succeeded") {',
      '    throw new Error("payment failed");',
      "  }",
      "",
      "  const order = await db.orders.insert({",
      "    cartId: input.cartId,",
      "    customerId: input.customerId,",
      "    total,",
      "    shippingAddress: input.shippingAddress,",
      "    paymentChargeId: charge.id,",
      "    createdAt: new Date(),",
      "  });",
      "",
      "  await mailer.send({",
      "    to: input.customerEmail,",
      '    subject: "Xác nhận đơn hàng",',
      "    body: `Đơn hàng #${order.id} của bạn đã được xác nhận, tổng tiền ${total}đ.`,",
      "  });",
      "",
      "  return order;",
      "}",
    ]
  ),

  makeCase(
    "tp-27-ambiguous-abbreviation-tok",
    "Sensitive credential parameter named with an unclear abbreviation (tok)",
    "true-positive",
    [NAMING_CONVENTION],
    "eval-samples/tp-27-ambiguous-abbreviation-tok.ts",
    [
      "export function storeApiCredential(userId: string, tok: string, store: CredentialStore) {",
      "  store.save(userId, tok);",
      "}",
    ]
  ),

  makeCase(
    "tp-28-ambiguous-token-wrong-usage",
    "A generic `token` variable is reused across an idToken/accessToken boundary, causing the wrong token to be sent",
    "true-positive",
    [NAMING_CONVENTION],
    "eval-samples/tp-28-ambiguous-token-wrong-usage.ts",
    [
      "export async function fetchUserProfile(token: string, apiClient: ApiClient) {",
      "  // `token` ở đây thực chất là idToken lấy từ bước SSO login",
      '  return apiClient.get("/profile", { headers: { Authorization: `Bearer ${token}` } });',
      "}",
      "",
      "export function loginWithSso(idToken: string, accessToken: string, apiClient: ApiClient) {",
      "  const token = idToken;",
      "  return fetchUserProfile(token, apiClient);",
      "}",
    ]
  ),

  makeCase(
    "tp-29-permission-denied-log-missing-context-python",
    "Permission-denied event logged with no actor/action/target context",
    "true-positive",
    [LOGGING],
    "eval-samples/tp-29-permission-denied-log-missing-context.py",
    [
      "def check_permission(user_id, required_scope):",
      "    if not has_permission(user_id, required_scope):",
      '        print("Error")',
      "        abort(403)",
    ]
  ),

  makeCase(
    "tp-30-logs-raw-request-body",
    "Logs the entire raw request body of a login endpoint, including the plaintext password field",
    "true-positive",
    [LOGGING],
    "eval-samples/tp-30-logs-raw-request-body.ts",
    [
      "export function loginHandler(req: Request, res: Response, authService: AuthService) {",
      '  console.log("Incoming login request:", req.body);',
      "  return authService.login(req.body.username, req.body.password);",
      "}",
    ]
  ),

  makeCase(
    "tp-31-logs-anomaly-but-continues",
    "Logs a suspicious large transfer as a warning but still executes it instead of blocking",
    "true-positive",
    [LOGGING],
    "eval-samples/tp-31-logs-anomaly-but-continues.ts",
    [
      "export function transferFunds(req: Request, res: Response, transferService: TransferService) {",
      "  if (req.body.amount > 1_000_000_000) {",
      '    console.warn("Suspicious large transfer detected", req.body.amount);',
      "  }",
      "  return transferService.execute(req.body.fromAccount, req.body.toAccount, req.body.amount);",
      "}",
    ]
  ),

  makeCase(
    "tp-32-scattered-raw-jwt-import",
    "Imports the low-level jsonwebtoken library directly instead of the project's shared token wrapper",
    "true-positive",
    [IMPORT_RULES],
    "eval-samples/tp-32-scattered-raw-jwt-import.ts",
    [
      'import jwt from "jsonwebtoken";',
      "",
      "export function verifyPartnerWebhookToken(token: string): unknown {",
      '  return jwt.verify(token, process.env.PARTNER_WEBHOOK_SECRET as string, { algorithms: ["HS256"] });',
      "}",
    ]
  ),

  makeCase(
    "tp-33-imports-mock-into-production",
    "A real checkout route imports a payment gateway test double from the test fixtures directory",
    "true-positive",
    [IMPORT_RULES],
    "eval-samples/tp-33-imports-mock-into-production.ts",
    [
      'import { fakePaymentGateway } from "../test/fixtures/paymentGateway.mock";',
      "",
      "export function checkoutRoute(req: Request, res: Response) {",
      "  return fakePaymentGateway.charge(req.body.amount);",
      "}",
    ]
  ),

  makeCase(
    "tp-34-raw-sso-sdk-in-business-logic",
    "SSO provider SDK called directly inside a route handler instead of through a dedicated adapter",
    "true-positive",
    [IMPORT_RULES],
    "eval-samples/tp-34-raw-sso-sdk-in-business-logic.ts",
    [
      'import { OAuthClient } from "some-sso-provider-sdk";',
      "",
      "export async function handleSsoCallback(code: string, db: Database) {",
      "  const client = new OAuthClient({ clientId: process.env.SSO_CLIENT_ID });",
      "  const tokenSet = await client.exchangeCode(code);",
      "  await db.sessions.insert({ accessToken: tokenSet.access_token });",
      "  return tokenSet;",
      "}",
    ]
  ),

  makeCase(
    "tp-35-n-plus-one-permission-lookup-go",
    "Fetches each user's permissions one at a time inside a loop instead of a single batch query",
    "true-positive",
    [PERFORMANCE],
    "eval-samples/tp-35-n-plus-one-permission-lookup.go",
    [
      "func GetTeamPermissionSummary(db *sql.DB, userIDs []string) ([]Permission, error) {",
      "  var summary []Permission",
      "  for _, id := range userIDs {",
      "    permission, err := FindPermissionByUserID(db, id)",
      "    if err != nil {",
      "      return nil, err",
      "    }",
      "    summary = append(summary, permission)",
      "  }",
      "  return summary, nil",
      "}",
    ]
  ),

  makeCase(
    "tp-36-permission-cache-no-invalidation",
    "Permission cache is populated but never cleared when a role is revoked",
    "true-positive",
    [PERFORMANCE],
    "eval-samples/tp-36-permission-cache-no-invalidation.ts",
    [
      "const permissionCache = new Map<string, string[]>();",
      "",
      "export async function getUserPermissions(userId: string, db: Database) {",
      "  if (permissionCache.has(userId)) {",
      "    return permissionCache.get(userId);",
      "  }",
      "  const permissions = await db.permissions.findByUserId(userId);",
      "  permissionCache.set(userId, permissions);",
      "  return permissions;",
      "}",
      "",
      "export async function revokeRole(userId: string, role: string, db: Database) {",
      "  await db.roles.remove(userId, role);",
      "}",
    ]
  ),

  makeCase(
    "tp-37-dockerfile-hardcoded-secret",
    "Dockerfile bakes a real-looking live Stripe secret key into an ENV instruction",
    "true-positive",
    [SECURITY],
    "eval-samples/tp-37-dockerfile-secret/Dockerfile",
    [
      "FROM node:20-alpine",
      "WORKDIR /app",
      "COPY . .",
      "ENV STRIPE_SECRET_KEY=sk_live_51Hxyzabcdefghijklmnopqrstuvwxyz1234",
      "RUN npm ci --omit=dev",
      'CMD ["node", "dist/server.js"]',
    ]
  ),

  // ── False-positive traps ─────────────────────────────────────────────────

  makeCase(
    "fp-11-secret-in-test-fixture",
    "Stripe's own published test key literal appears inside a test fixture file, not real production code",
    "false-positive-trap",
    [SECURITY],
    "eval-samples/fp-11-secret-in-test-fixture/test/fixtures/stripeFixtures.ts",
    [
      'export const FAKE_STRIPE_TEST_KEY = "sk_test_4eC39HqLyjWDarjtT1zdp7dc";',
      "",
      "export function mockStripeCharge() {",
      '  return { status: "succeeded", key: FAKE_STRIPE_TEST_KEY };',
      "}",
    ]
  ),

  makeCase(
    "fp-12-env-example-aws-placeholder",
    "AWS's own documented example access key ID appears only in a setup comment describing .env.example",
    "false-positive-trap",
    [SECURITY],
    "eval-samples/fp-12-env-example-aws-placeholder.ts",
    [
      "// Nội dung mẫu trong .env.example (không phải secret thật):",
      "// AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE",
      "export function loadAwsConfig() {",
      "  return { accessKeyId: process.env.AWS_ACCESS_KEY_ID };",
      "}",
    ]
  ),

  makeCase(
    "fp-13-parameterized-query-with-injection-example-comment",
    "A comment shows a classic SQL injection example as a warning, but the real query is parameterized",
    "false-positive-trap",
    [SECURITY],
    "eval-samples/fp-13-parameterized-query-with-injection-example-comment.ts",
    [
      "export async function findOrderById(orderId: string, db: Database) {",
      "  // CẢNH BÁO cho dev mới: KHÔNG được viết kiểu",
      "  // `SELECT * FROM orders WHERE id = '${orderId}'` — đây là ví dụ lỗi SQL injection kinh điển.",
      "  // Luôn dùng parameterized query như bên dưới:",
      '  return db.query("SELECT * FROM orders WHERE id = $1", [orderId]);',
      "}",
    ]
  ),

  makeCase(
    "fp-14-misleadingly-named-but-secure-function",
    "Function named insecureConnection() but its actual implementation enforces safe TLS 1.3",
    "false-positive-trap",
    [SECURITY],
    "eval-samples/fp-14-misleadingly-named-but-secure-function.ts",
    [
      "export function insecureConnection(host: string) {",
      "  // Tên hàm giữ lại từ bản cũ (legacy naming), hành vi thực tế đã được sửa an toàn.",
      '  return tls.connect({ host, minVersion: "TLSv1.3", rejectUnauthorized: true });',
      "}",
    ]
  ),

  makeCase(
    "fp-15-any-with-legacy-sdk-justification",
    "Uses any but with a genuine justifying comment about an untyped legacy SDK",
    "false-positive-trap",
    [CODING_CONVENTION],
    "eval-samples/fp-15-any-with-legacy-sdk-justification.ts",
    [
      "export function callBillingSdkV1(payload: BillingPayload) {",
      "  // dùng any do thư viện billing-sdk v1 legacy chưa publish type definition, sẽ xoá khi nâng cấp lên v2",
      "  const result: any = billingSdkV1.charge(payload);",
      "  return result;",
      "}",
    ]
  ),

  makeCase(
    "fp-16-any-word-in-vietnamese-comment",
    "The word 'any' appears only inside Vietnamese prose describing error handling, not as a TS type",
    "false-positive-trap",
    [CODING_CONVENTION],
    "eval-samples/fp-16-any-word-in-vietnamese-comment.ts",
    [
      "export function retryUpload(file: File, maxAttempts: number) {",
      "  // xử lý any sự cố phát sinh trong lúc upload, thử lại tối đa maxAttempts lần",
      "  for (let i = 0; i < maxAttempts; i++) {",
      "    const ok = attemptUpload(file);",
      "    if (ok) return true;",
      "  }",
      "  return false;",
      "}",
    ]
  ),

  makeCase(
    "fp-17-long-but-single-purpose-dto-mapper",
    "A 50+ line function that only maps DTO fields to an entity sequentially — single responsibility despite its length",
    "false-positive-trap",
    [CODING_CONVENTION],
    "eval-samples/fp-17-long-but-single-purpose-dto-mapper.ts",
    [
      "export function mapOrderDtoToEntity(dto: OrderDto): OrderEntity {",
      "  return {",
      "    id: dto.id,",
      "    customerId: dto.customer_id,",
      "    customerName: dto.customer_name,",
      "    customerEmail: dto.customer_email,",
      '    shippingStreet: dto.shipping_address?.street ?? "",',
      '    shippingCity: dto.shipping_address?.city ?? "",',
      '    shippingState: dto.shipping_address?.state ?? "",',
      '    shippingPostalCode: dto.shipping_address?.postal_code ?? "",',
      '    shippingCountry: dto.shipping_address?.country ?? "",',
      '    billingStreet: dto.billing_address?.street ?? "",',
      '    billingCity: dto.billing_address?.city ?? "",',
      '    billingState: dto.billing_address?.state ?? "",',
      '    billingPostalCode: dto.billing_address?.postal_code ?? "",',
      '    billingCountry: dto.billing_address?.country ?? "",',
      "    subtotal: dto.subtotal,",
      "    taxAmount: dto.tax_amount,",
      "    shippingFee: dto.shipping_fee,",
      "    discountAmount: dto.discount_amount,",
      "    total: dto.total,",
      "    currency: dto.currency,",
      "    paymentMethod: dto.payment_method,",
      "    paymentStatus: dto.payment_status,",
      "    fulfillmentStatus: dto.fulfillment_status,",
      "    trackingNumber: dto.tracking_number ?? null,",
      "    carrier: dto.carrier ?? null,",
      "    loyaltyPointsEarned: dto.loyalty_points_earned ?? 0,",
      "    loyaltyPointsRedeemed: dto.loyalty_points_redeemed ?? 0,",
      "    giftCardCode: dto.gift_card_code ?? null,",
      "    referralCode: dto.referral_code ?? null,",
      "    utmSource: dto.utm_source ?? null,",
      "    utmMedium: dto.utm_medium ?? null,",
      "    utmCampaign: dto.utm_campaign ?? null,",
      "    isGift: dto.is_gift ?? false,",
      "    giftMessage: dto.gift_message ?? null,",
      "    invoiceRequested: dto.invoice_requested ?? false,",
      '    notes: dto.notes ?? "",',
      "    createdAt: new Date(dto.created_at),",
      "    updatedAt: new Date(dto.updated_at),",
      "    items: dto.items.map((item) => ({",
      "      sku: item.sku,",
      "      name: item.name,",
      "      quantity: item.quantity,",
      "      unitPrice: item.unit_price,",
      "      lineTotal: item.line_total,",
      "    })),",
      "  };",
      "}",
    ]
  ),

  makeCase(
    "fp-18-comment-warns-against-header-bypass",
    "A comment explicitly warns against the x-admin-secret anti-pattern while the real code uses the shared authz gate",
    "false-positive-trap",
    [RBAC],
    "eval-samples/fp-18-comment-warns-against-header-bypass.ts",
    [
      "export function deleteTeamHandler(req: Request, res: Response, teamService: TeamService) {",
      "  // KHÔNG được tự chế kiểu `if (req.headers['x-admin-secret'] === ...)` — luôn dùng authzGate chung.",
      '  return authzGate("team#admin")(req, res, () => {',
      "    teamService.deleteTeam(req.params.teamId);",
      "    res.status(204).send();",
      "  });",
      "}",
    ]
  ),

  makeCase(
    "fp-19-admin-email-in-test-fixture",
    "A hardcoded-looking admin email only appears inside a unit test fixture, not real authorization logic",
    "false-positive-trap",
    [RBAC],
    "eval-samples/fp-19-admin-email-in-test-fixture.ts",
    [
      "export const SUPER_ADMIN_FIXTURE = {",
      '  email: "admin@v-id.vn",',
      '  role: "super-admin",',
      "};",
      "",
      'describe("resolveEffectiveRole", () => {',
      '  it("trả về đúng role super-admin cho fixture admin", () => {',
      "    expect(resolveEffectiveRole(SUPER_ADMIN_FIXTURE)).toBe(\"super-admin\");",
      "  });",
      "});",
    ]
  ),

  makeCase(
    "fp-20-skip-auth-param-rejected-in-test",
    "The ?skipAuth=1 backdoor pattern only appears inside a test asserting that it is correctly rejected",
    "false-positive-trap",
    [RBAC],
    "eval-samples/fp-20-skip-auth-param-rejected-in-test.ts",
    [
      'describe("requireAuth middleware", () => {',
      '  it("từ chối request có ?skipAuth=1, không cho phép bỏ qua xác thực", async () => {',
      '    const res = await request(app).get("/admin/reports?skipAuth=1");',
      "    expect(res.status).toBe(401);",
      "  });",
      "});",
    ]
  ),

  makeCase(
    "fp-21-tls-warning-comment-not-disabled-python",
    "A comment warns against ever disabling TLS verification, and the real Python code never does",
    "false-positive-trap",
    [SECURITY],
    "eval-samples/fp-21-tls-warning-comment-not-disabled.py",
    [
      "def bootstrap_http_client():",
      "    # Lưu ý: TUYỆT ĐỐI không được gọi requests với verify=False ở bất kỳ đâu trong dự án.",
      "    session = requests.Session()",
      '    session.headers.update({"Accept": "application/json"})',
      "    return session",
    ]
  ),

  makeCase(
    "fp-22-honestly-named-decode-for-display-only",
    "A function honestly named decodeTokenUnsafe is used only to render a non-authoritative UI countdown",
    "false-positive-trap",
    [NAMING_CONVENTION, SECURITY],
    "eval-samples/fp-22-honestly-named-decode-for-display-only.ts",
    [
      "export function decodeTokenUnsafe(token: string): { exp: number } {",
      "  return jwt.decode(token) as { exp: number };",
      "}",
      "",
      "export function renderSessionExpiryBadge(token: string) {",
      "  const { exp } = decodeTokenUnsafe(token);",
      "  return `Phiên hết hạn lúc ${new Date(exp * 1000).toLocaleTimeString()}`;",
      "}",
    ]
  ),

  makeCase(
    "fp-23-single-token-type-unambiguous-tsx",
    "A small React hook only ever deals with one kind of token, so the generic name `token` is unambiguous",
    "false-positive-trap",
    [NAMING_CONVENTION],
    "eval-samples/fp-23-single-token-type-unambiguous.tsx",
    [
      "export function useRefreshableToken(refreshEndpoint: string) {",
      "  const [token, setToken] = useState<string | null>(null);",
      "  useEffect(() => {",
      '    fetch(refreshEndpoint, { method: "POST" })',
      "      .then((res) => res.json())",
      "      .then((body) => setToken(body.access_token));",
      "  }, [refreshEndpoint]);",
      "  return token;",
      "}",
    ]
  ),

  makeCase(
    "fp-24-pwd-as-route-path-name",
    "The abbreviation 'pwd' appears only as part of a URL route path string, not as a variable holding data",
    "false-positive-trap",
    [NAMING_CONVENTION],
    "eval-samples/fp-24-pwd-as-route-path-name.ts",
    [
      "export function registerPasswordRoutes(router: Router) {",
      '  router.get("/users/:id/pwd-reset-status", getPasswordResetStatus);',
      '  router.post("/users/:id/pwd-reset-request", requestPasswordReset);',
      "}",
    ]
  ),

  makeCase(
    "fp-25-correctly-logged-security-event",
    "A permission-denied event is logged correctly with actor/action/target/timestamp at warn level",
    "false-positive-trap",
    [LOGGING],
    "eval-samples/fp-25-correctly-logged-security-event.ts",
    [
      "export function checkPermission(req: Request, res: Response, next: NextFunction) {",
      "  if (!hasPermission(req.userId, req.requiredScope)) {",
      '    console.warn("[audit] permission_denied", {',
      "      actor: req.userId,",
      "      action: req.requiredScope,",
      "      target: req.path,",
      "      timestamp: new Date().toISOString(),",
      "    });",
      '    return res.status(403).send("Forbidden");',
      "  }",
      "  return next();",
      "}",
    ]
  ),

  makeCase(
    "fp-26-non-security-log-missing-actor-python",
    "A build pipeline progress log has no actor/action fields, but it isn't a security-relevant event",
    "false-positive-trap",
    [LOGGING],
    "eval-samples/fp-26-non-security-log-missing-actor.py",
    [
      "def run_build_pipeline(steps):",
      "    for step in steps:",
      '        print(f"Đang chạy bước build: {step.name}")',
      "        step.run()",
      '    print("Build hoàn tất")',
    ]
  ),

  makeCase(
    "fp-27-logs-anomaly-then-blocks-go",
    "Logs a suspicious large transfer and then correctly rejects it, instead of logging and continuing",
    "false-positive-trap",
    [LOGGING],
    "eval-samples/fp-27-logs-anomaly-then-blocks.go",
    [
      "func TransferFunds(w http.ResponseWriter, r *http.Request, req TransferRequest) {",
      "  if req.Amount > 1_000_000_000 {",
      '    log.Printf("[audit] suspicious_large_transfer actor=%s amount=%d", req.ActorID, req.Amount)',
      "    http.Error(w, \"Giao dịch vượt hạn mức, vui lòng liên hệ hỗ trợ.\", http.StatusBadRequest)",
      "    return",
      "  }",
      "  executeTransfer(req)",
      "}",
    ]
  ),

  makeCase(
    "fp-28-jwt-import-inside-designated-wrapper",
    "jsonwebtoken is imported, but only inside the project's one designated token-verification wrapper module",
    "false-positive-trap",
    [IMPORT_RULES],
    "eval-samples/fp-28-jwt-import-inside-designated-wrapper/auth/tokenVerifier.ts",
    [
      'import jwt from "jsonwebtoken";',
      "",
      "export function verifySessionToken(token: string) {",
      '  return jwt.verify(token, process.env.SESSION_PUBLIC_KEY as string, { algorithms: ["RS256"] });',
      "}",
    ]
  ),

  makeCase(
    "fp-29-mock-exam-feature-not-a-test-double",
    "The word 'mock' in the import path names a real 'practice exam' product feature, not a test double",
    "false-positive-trap",
    [IMPORT_RULES],
    "eval-samples/fp-29-mock-exam-feature-not-a-test-double/mockExamService.ts",
    [
      'import { generateMockExamQuestions } from "../features/mockExam/questionBank";',
      "",
      "export function startMockExamSession(studentId: string) {",
      '  const questions = generateMockExamQuestions({ subject: "toán", count: 20 });',
      "  return { studentId, questions, startedAt: new Date() };",
      "}",
    ]
  ),

  makeCase(
    "fp-30-sso-sdk-inside-dedicated-adapter",
    "The SSO provider SDK is imported, but only inside the project's one designated adapter module",
    "false-positive-trap",
    [IMPORT_RULES],
    "eval-samples/fp-30-sso-sdk-inside-dedicated-adapter/auth/ssoAdapter.ts",
    [
      'import { OAuthClient } from "some-sso-provider-sdk";',
      "",
      "export class SsoAdapter {",
      "  private client = new OAuthClient({ clientId: process.env.SSO_CLIENT_ID });",
      "",
      "  async exchangeCode(code: string) {",
      "    return this.client.exchangeCode(code);",
      "  }",
      "}",
    ]
  ),

  makeCase(
    "fp-31-loop-over-fixed-small-collection-go",
    "A DB call inside a loop, but over a small fixed set of dashboard widget IDs, not a user/team list",
    "false-positive-trap",
    [PERFORMANCE],
    "eval-samples/fp-31-loop-over-fixed-small-collection.go",
    [
      'var dashboardWidgetIDs = []string{"revenue", "active-users", "error-rate"}',
      "",
      "func LoadDashboardWidgets(db *sql.DB) ([]WidgetConfig, error) {",
      "  var widgets []WidgetConfig",
      "  for _, id := range dashboardWidgetIDs {",
      "    widget, err := FindWidgetConfigByID(db, id)",
      "    if err != nil {",
      "      return nil, err",
      "    }",
      "    widgets = append(widgets, widget)",
      "  }",
      "  return widgets, nil",
      "}",
    ]
  ),

  makeCase(
    "fp-32-permission-cache-with-invalidation",
    "A permission cache has both a TTL and an explicit invalidation call on role revocation",
    "false-positive-trap",
    [PERFORMANCE],
    "eval-samples/fp-32-permission-cache-with-invalidation.ts",
    [
      "const permissionCache = new Map<string, { value: string[]; expiresAt: number }>();",
      "",
      "export async function getUserPermissions(userId: string, db: Database) {",
      "  const cached = permissionCache.get(userId);",
      "  if (cached && cached.expiresAt > Date.now()) {",
      "    return cached.value;",
      "  }",
      "  const permissions = await db.permissions.findByUserId(userId);",
      "  permissionCache.set(userId, { value: permissions, expiresAt: Date.now() + 60_000 });",
      "  return permissions;",
      "}",
      "",
      "export async function revokeRole(userId: string, role: string, db: Database) {",
      "  await db.roles.remove(userId, role);",
      "  permissionCache.delete(userId);",
      "}",
    ]
  ),

  makeCase(
    "fp-33-dockerfile-build-arg-placeholder",
    "Dockerfile declares an ARG for an API key with no default value — injected at build time, not embedded",
    "false-positive-trap",
    [SECURITY],
    "eval-samples/fp-33-dockerfile-build-arg-placeholder/Dockerfile",
    [
      "FROM node:20-alpine",
      "ARG API_KEY",
      "WORKDIR /app",
      "COPY . .",
      "RUN npm ci --omit=dev",
      'CMD ["node", "dist/server.js"]',
    ]
  ),

  makeCase(
    "fp-34-python-test-fixture-fake-key",
    "Stripe's own published test key literal appears inside a Python pytest fixture, not production code",
    "false-positive-trap",
    [SECURITY],
    "eval-samples/fp-34-python-test-fixture-fake-key/tests/fixtures/stripe_fixtures.py",
    [
      'FAKE_STRIPE_TEST_KEY = "sk_test_4eC39HqLyjWDarjtT1zdp7dc"',
      "",
      "",
      "def mock_stripe_charge():",
      '    return {"status": "succeeded", "key": FAKE_STRIPE_TEST_KEY}',
    ]
  ),

  makeCase(
    "fp-35-go-tls-log-message-safe-config",
    "A Go startup log message contains the word TLS, but the actual config correctly stays secure",
    "false-positive-trap",
    [SECURITY],
    "eval-samples/fp-35-go-tls-log-message-safe-config.go",
    [
      "func StartServer() {",
      '  log.Println("TLS verification: enabled (min TLS 1.2, certificate check active)")',
      "  server := &http.Server{",
      "    TLSConfig: &tls.Config{MinVersion: tls.VersionTLS12},",
      "  }",
      '  server.ListenAndServeTLS("cert.pem", "key.pem")',
      "}",
    ]
  ),

  // ── Batch 3: fill out under-represented policies (disabled-security-control, dead-code,
  // architecture, and more rbac/naming/logging/import-rules/performance) to reach 100 cases total,
  // same "must understand context" design bar as batch 2. ──

  // ── True positives ──────────────────────────────────────────────────────

  makeCase(
    "tp-38-disabled-auth-decorator-python",
    "Flask route decorator for role check commented out, left disabled",
    "true-positive",
    [DISABLED_SECURITY_CONTROL],
    "eval-samples/tp-38-disabled-auth-decorator.py",
    [
      '@app.route("/admin/reports")',
      '# @require_role("admin")  # tạm tắt để debug, nhớ bật lại',
      "def admin_reports():",
      "    return get_all_reports()",
    ]
  ),

  makeCase(
    "tp-39-disabled-auth-middleware-go",
    "One link of a Go middleware chain (admin requirement) commented out",
    "true-positive",
    [DISABLED_SECURITY_CONTROL],
    "eval-samples/tp-39-disabled-auth-middleware.go",
    [
      "func AdminRouter() *mux.Router {",
      "  r := mux.NewRouter()",
      "  // r.Use(middleware.RequireAdmin) // tạm tắt để test nhanh",
      '  r.HandleFunc("/admin/settings", updateSettings)',
      "  return r",
      "}",
    ]
  ),

  makeCase(
    "tp-40-dead-code-python",
    "Old implementation left commented out above the real one",
    "true-positive",
    [DEAD_CODE],
    "eval-samples/tp-40-dead-code.py",
    [
      "def calculate_shipping_fee(order):",
      "    # def calculate_shipping_fee_v1(order):",
      "    #     return order.weight * 0.5",
      "    return order.weight * 0.35 + FLAT_FEE",
    ]
  ),

  makeCase(
    "tp-41-todo-without-context",
    "A TODO left with zero context about what needs fixing or why",
    "true-positive",
    [DEAD_CODE],
    "eval-samples/tp-41-todo-without-context.ts",
    [
      "// TODO: fix this",
      "export function normalizePhoneNumber(raw: string): string {",
      "  return raw.replace(/\\D/g, \"\");",
      "}",
    ]
  ),

  makeCase(
    "tp-42-business-logic-in-cli",
    "cli.ts embeds real business logic (charge calculation, payment, DB write) instead of delegating",
    "true-positive",
    [ARCHITECTURE],
    "src/cli.ts",
    [
      'program.command("charge-customer").action(async (customerId) => {',
      "  const customer = await db.customers.findById(customerId);",
      "  const invoice = calculateInvoiceTotal(customer.cart);",
      "  await paymentGateway.charge(customer.paymentMethodId, invoice.total);",
      '  await db.invoices.insert({ customerId, total: invoice.total, status: "paid" });',
      "});",
    ]
  ),

  makeCase(
    "tp-43-validation-logic-in-cli",
    "cli.ts embeds multi-field validation logic directly instead of delegating to a lower layer",
    "true-positive",
    [ARCHITECTURE],
    "src/cli.ts",
    [
      'program.command("import-users <file>").action((file) => {',
      '  const rows = fs.readFileSync(file, "utf-8").split("\\n");',
      "  const users = rows.map((row) => {",
      '    const [email, role] = row.split(",");',
      '    if (!email.includes("@")) throw new Error(`Invalid email: ${email}`);',
      '    if (!["admin", "member"].includes(role)) throw new Error(`Invalid role: ${role}`);',
      "    return { email, role };",
      "  });",
      "  db.users.insertMany(users);",
      "});",
    ]
  ),

  makeCase(
    "tp-44-role-from-unvalidated-cookie-go",
    "Go middleware trusts a client-writable cookie value as the role, no server-side lookup",
    "true-positive",
    [RBAC],
    "eval-samples/tp-44-role-from-unvalidated-cookie.go",
    [
      "func AdminOnly(next http.Handler) http.Handler {",
      "  return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {",
      '    roleCookie, _ := r.Cookie("role")',
      '    if roleCookie != nil && roleCookie.Value == "admin" {',
      "      next.ServeHTTP(w, r)",
      "      return",
      "    }",
      '    http.Error(w, "Forbidden", http.StatusForbidden)',
      "  })",
      "}",
    ]
  ),

  makeCase(
    "tp-45-team-from-client-header-python",
    "Flask route trusts a client-supplied X-Team-Id header to prove team membership",
    "true-positive",
    [RBAC],
    "eval-samples/tp-45-team-from-client-header.py",
    [
      '@app.route("/teams/<team_id>/reports")',
      "def team_reports(team_id):",
      '    caller_team = request.headers.get("X-Team-Id")',
      "    if caller_team == team_id:",
      "        return jsonify(get_reports_for_team(team_id))",
      '    return "Forbidden", 403',
    ]
  ),

  makeCase(
    "tp-46-misleading-verify-session-python",
    "Python function named verify_session but explicitly disables signature verification",
    "true-positive",
    [NAMING_CONVENTION],
    "eval-samples/tp-46-misleading-verify-session.py",
    [
      "def verify_session(token):",
      '    return jwt.decode(token, options={"verify_signature": False})',
    ]
  ),

  makeCase(
    "tp-47-ambiguous-token-reuse-go",
    "Go function reassigns idToken to a generic name before passing it where refreshToken is expected",
    "true-positive",
    [NAMING_CONVENTION],
    "eval-samples/tp-47-ambiguous-token-reuse.go",
    [
      "func RefreshAccessToken(idToken string, refreshToken string) (string, error) {",
      "  token := idToken",
      "  return callTokenExchangeAPI(token)",
      "}",
    ]
  ),

  makeCase(
    "tp-48-no-audit-log-on-revoke-go",
    "Revoking a token (security-relevant action) with no audit log recording the event at all",
    "true-positive",
    [LOGGING],
    "eval-samples/tp-48-no-audit-log-on-revoke.go",
    [
      "func RevokeToken(w http.ResponseWriter, r *http.Request, tokenID string) {",
      "  if err := revokeTokenByID(tokenID); err != nil {",
      '    log.Println("revoke failed")',
      '    http.Error(w, "error", http.StatusInternalServerError)',
      "    return",
      "  }",
      "  w.WriteHeader(http.StatusNoContent)",
      "}",
    ]
  ),

  makeCase(
    "tp-49-logs-full-token-response-python",
    "Logs the entire response body of a token-refresh endpoint, including the new tokens",
    "true-positive",
    [LOGGING],
    "eval-samples/tp-49-logs-full-token-response.py",
    [
      '@app.route("/api/token/refresh", methods=["POST"])',
      "def refresh_token():",
      "    response = issue_new_tokens(request.json)",
      '    logging.info(f"Token refresh response: {response}")',
      "    return jsonify(response)",
    ]
  ),

  makeCase(
    "tp-50-imports-mock-into-production-python",
    "Real Python checkout function imports a payment test double from tests/fixtures",
    "true-positive",
    [IMPORT_RULES],
    "eval-samples/tp-50-imports-mock-into-production.py",
    [
      "from tests.fixtures.payment_mock import fake_payment_gateway",
      "",
      "def checkout(order):",
      "    return fake_payment_gateway.charge(order.total)",
    ]
  ),

  makeCase(
    "tp-51-sync-scrypt-in-login-handler",
    "Synchronous, expensive KDF call directly on the login request path, blocking the event loop",
    "true-positive",
    [PERFORMANCE],
    "eval-samples/tp-51-sync-scrypt-in-login-handler.ts",
    [
      "export function loginHandler(req: Request, res: Response, storedHash: string) {",
      '  const hash = crypto.scryptSync(req.body.password, "salt", 64).toString("hex");',
      '  if (hash !== storedHash) return res.status(401).send("Unauthorized");',
      '  return res.status(200).send("OK");',
      "}",
    ]
  ),

  // ── False-positive traps ─────────────────────────────────────────────────

  makeCase(
    "fp-36-why-comment-mentions-auth-concept",
    "Comment explains a design decision using the word 'auth', but no check was ever disabled",
    "false-positive-trap",
    [DISABLED_SECURITY_CONTROL],
    "eval-samples/fp-36-why-comment-mentions-auth-concept.ts",
    [
      "// Endpoint này công khai theo thiết kế — health-check không cần auth để hệ thống giám sát bên ngoài gọi được.",
      "export function healthCheckHandler(req: Request, res: Response) {",
      '  res.json({ status: "ok" });',
      "}",
    ]
  ),

  makeCase(
    "fp-37-comment-explains-concepts-not-disabled",
    "Comment describes authentication vs authorization as concepts; the real code registers both middlewares correctly",
    "false-positive-trap",
    [DISABLED_SECURITY_CONTROL],
    "eval-samples/fp-37-comment-explains-concepts-not-disabled.ts",
    [
      "// Ghi chú kiến trúc: authentication (xác thực danh tính) khác với authorization (phân quyền) — dự án này tách 2 middleware riêng.",
      "export function configureMiddlewares(app: Express) {",
      "  app.use(sessionMiddleware);",
      "  app.use(authenticationMiddleware);",
      "  app.use(authorizationMiddleware);",
      "}",
    ]
  ),

  makeCase(
    "fp-38-todo-with-full-context",
    "A TODO with an issue link, specific reason, and current-behavior explanation — matches the policy's own compliant example",
    "false-positive-trap",
    [DEAD_CODE],
    "eval-samples/fp-38-todo-with-full-context.ts",
    [
      "// TODO(#512): chuyển sang dùng thư viện libphonenumber khi có ngân sách — hiện tại chỉ strip ký tự không phải số, chưa validate định dạng theo quốc gia.",
      "export function normalizePhoneNumber(raw: string): string {",
      "  return raw.replace(/\\D/g, \"\");",
      "}",
    ]
  ),

  makeCase(
    "fp-39-commented-code-inside-test-file",
    "Old commented-out expected value inside a test file, debugging leftover — not a production code path",
    "false-positive-trap",
    [DEAD_CODE],
    "eval-samples/fp-39-commented-code-inside-test-file.ts",
    [
      'describe("formatInvoice", () => {',
      '  // const legacyExpected = "Invoice #1 - Total: 100"; // để tạm khi debug snapshot cũ',
      '  it("format đúng chuỗi hoá đơn", () => {',
      "    expect(formatInvoice({ id: 1, total: 100 })).toBe(\"Invoice #1 — Total: 100\");",
      "  });",
      "});",
    ]
  ),

  makeCase(
    "fp-40-cli-delegates-to-lower-layer",
    "cli.ts command handler only calls lower-layer functions and prints the result — no business logic inline",
    "false-positive-trap",
    [ARCHITECTURE],
    "src/cli.ts",
    [
      'program.command("check").action(async () => {',
      "  const diff = await getStagedDiff();",
      "  const report = await runGuardianCheck(diff);",
      "  printReport(report);",
      "});",
    ]
  ),

  makeCase(
    "fp-41-cli-pure-arg-parsing",
    "cli.ts command only parses/converts a flag and passes it down — no business logic",
    "false-positive-trap",
    [ARCHITECTURE],
    "src/cli.ts",
    [
      'program',
      '  .command("dashboard")',
      '  .option("-p, --port <number>", "Cổng chạy dashboard", (v) => parseInt(v, 10))',
      "  .action((options) => {",
      "    startServer(options.port);",
      "  });",
    ]
  ),

  makeCase(
    "fp-42-team-from-session-not-client-input",
    "Team scoping correctly derived from the authenticated session, only superficially resembles trusting client input",
    "false-positive-trap",
    [RBAC],
    "eval-samples/fp-42-team-from-session-not-client-input.ts",
    [
      "export function teamReportsHandler(req: Request, res: Response) {",
      "  const callerTeamId = req.session.teamId;",
      "  return res.json(getReportsForTeam(callerTeamId));",
      "}",
    ]
  ),

  makeCase(
    "fp-43-explicitly-marked-public-route",
    "Route explicitly marked public via the project's own convention — matches the deny-by-default carve-out",
    "false-positive-trap",
    [RBAC],
    "eval-samples/fp-43-explicitly-marked-public-route.ts",
    [
      'router.get("/pricing", { public: true }, (req, res) => {',
      "  res.json(getPublicPricingPlans());",
      "});",
    ]
  ),

  makeCase(
    "fp-44-common-abbreviations-not-sensitive",
    "Uses industry-standard abbreviations (req, res, db) — not sensitive-field abbreviations like pwd/tok",
    "false-positive-trap",
    [NAMING_CONVENTION],
    "eval-samples/fp-44-common-abbreviations-not-sensitive.ts",
    [
      "export function getUserById(req: Request, res: Response, db: Database) {",
      "  return res.json(db.users.findById(req.params.id));",
      "}",
    ]
  ),

  makeCase(
    "fp-45-honestly-named-verify-that-really-verifies-go",
    "Go function named VerifySessionToken that genuinely parses and validates the signature",
    "false-positive-trap",
    [NAMING_CONVENTION],
    "eval-samples/fp-45-honestly-named-verify-that-really-verifies.go",
    [
      "func VerifySessionToken(tokenString string, publicKey *rsa.PublicKey) (*Claims, error) {",
      "  token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(t *jwt.Token) (interface{}, error) {",
      "    return publicKey, nil",
      "  })",
      "  if err != nil || !token.Valid {",
      '    return nil, errors.New("invalid token")',
      "  }",
      "  return token.Claims.(*Claims), nil",
      "}",
    ]
  ),

  makeCase(
    "fp-46-debug-log-non-auth-event",
    "Debug-level log for a routine non-security event — the level/actor rule only applies to auth/permission events",
    "false-positive-trap",
    [LOGGING],
    "eval-samples/fp-46-debug-log-non-auth-event.ts",
    [
      "export function fetchExchangeRate(currency: string, exchangeRateClient: ExchangeRateClient) {",
      '  console.debug("Fetching exchange rate for", currency);',
      "  return exchangeRateClient.get(currency);",
      "}",
    ]
  ),

  makeCase(
    "fp-47-jwt-wrapper-in-auth-dir-generic-name",
    "jsonwebtoken imported inside auth/ in a file with a generic (non-'Verifier'/'Adapter') name, but still the sole wrapper",
    "false-positive-trap",
    [IMPORT_RULES],
    "eval-samples/fp-47-jwt-wrapper-in-auth-dir-generic-name/auth/session.ts",
    [
      'import jwt from "jsonwebtoken";',
      "",
      "export function issueSessionToken(payload: object) {",
      '  return jwt.sign(payload, process.env.SESSION_SECRET as string, { expiresIn: "1h" });',
      "}",
    ]
  ),

  makeCase(
    "fp-48-payment-sdk-inside-dedicated-client",
    "Stripe SDK imported only inside a dedicated client/ module named after its role",
    "false-positive-trap",
    [IMPORT_RULES],
    "eval-samples/fp-48-payment-sdk-inside-dedicated-client/client/stripeClient.ts",
    [
      'import Stripe from "stripe";',
      "",
      "export class StripeClient {",
      "  private stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);",
      "",
      "  async charge(amount: number, customerId: string) {",
      "    return this.stripe.charges.create({ amount, customer: customerId });",
      "  }",
      "}",
    ]
  ),

  makeCase(
    "fp-49-loop-over-fixed-error-codes",
    "DB call inside a loop, but over a small fixed literal array of known error codes, not a dynamic user/team list",
    "false-positive-trap",
    [PERFORMANCE],
    "eval-samples/fp-49-loop-over-fixed-error-codes.ts",
    [
      'const CRITICAL_ERROR_CODES = ["AUTH_FAILED", "RATE_LIMITED", "SERVER_ERROR"] as const;',
      "",
      "export async function checkKnownErrorPatterns(db: Database) {",
      "  const patterns = [];",
      "  for (const code of CRITICAL_ERROR_CODES) {",
      "    patterns.push(await db.errorPatterns.findByCode(code));",
      "  }",
      "  return patterns;",
      "}",
    ]
  ),
];
