// Ghi video walkthrough tự động cho trang giới thiệu AI Dev Guardian. Mở đầu bằng trang Login
// thật của app, bấm nút "NoteBook" (điều hướng client-side sang /notebook — CÙNG component
// NoteBook.tsx với bản build GitHub Pages) rồi mới vào kịch bản 8 phần: Hero -> Pre-push
// Terminal -> How It Works -> Agent Map -> CI/CD Gate -> Benchmark -> What's in the Box ->
// Footer/CTA.
//
// CẦN server + web dev chạy thật (`npm run dev` ở gốc repo) — trang Login chỉ tồn tại trong app
// đầy đủ (index.html/App.tsx), KHÔNG có trong bản build tĩnh notebook.html trên GitHub Pages
// (bundle riêng, không có React Router/trang Login).
import { chromium } from 'playwright'
import { mkdir, readdir, rename, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  injectOverlay,
  setCursorPosition,
  moveCursor,
  hoverSequence,
  cursorClick,
  showCaption,
  hideCaption,
  showSlate,
  hideSlate,
} from './overlay.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = path.join(__dirname, 'output')

const DASHBOARD_URL = process.env.DASHBOARD_URL ?? 'http://localhost:5173'
const LOGIN_URL = `${DASHBOARD_URL}/login`
const LANG = process.env.DEMO_LANG === 'en' ? 'en' : 'vi'
const DARK = process.env.DEMO_DARK === '1'
const DRY_RUN = process.env.DRY_RUN === '1'
const VIEWPORT = { width: 1600, height: 1000 }

const t = (vi, en) => (LANG === 'vi' ? vi : en)

const FINISHED_TEXT = { vi: 'Mô phỏng hoàn tất', en: 'Walkthrough finished' }

// ---------------------------------------------------------------------------
// PHẦN -1 — Trang Login (trước khi vào NoteBook)
// ---------------------------------------------------------------------------
const LOGIN_HOVER = ['h2:has-text("Đăng nhập hệ thống")', 'text=Explore Demo Mode']
const LOGIN_TOTAL_MS = 3000
const NOTEBOOK_BUTTON = 'button[title="Xem sổ tay hướng dẫn sử dụng hệ thống"]'

// ---------------------------------------------------------------------------
// PHẦN 0 — Hero & Header
// ---------------------------------------------------------------------------
const HERO_HOVER = [
  'header >> text=guardian',
  'text=OPEN SOURCE',
  t('text=GIẤY PHÉP MIT', 'text=MIT LICENSE'),
  t('text=QUẢN TRỊ AST & LLM', 'text=AST & LLM GOVERNANCE'),
  'h1',
  t('text=Sao chép', 'text=Copy'),
  'text=Windsurf',
]
const HERO_TOTAL_MS = 9000

// ---------------------------------------------------------------------------
// PHẦN 2 — How It Works (4 cổng an ninh + 5 lớp chống ảo giác)
// ---------------------------------------------------------------------------
const HOW_IT_WORKS_HOVER = [
  '#how-it-works >> ' + t('text=Quét Secrets', 'text=Secret Scan'),
  '#how-it-works >> ' + t('text=Kiểm tra Kiến trúc', 'text=Architecture Check'),
  '#how-it-works >> text=Semgrep Static',
  '#how-it-works >> ' + t('text=Kiểm tra Policy LLM', 'text=LLM Policy Verification'),
  '#how-it-works >> ' + t('text=chống Ảo giác', 'text=Against Hallucination'),
  '#how-it-works >> text=Structured Tool Schema',
  '#how-it-works >> text=Reasoning CoT First',
  '#how-it-works >> text=Evidence Grounding',
  '#how-it-works >> text=AST Annotation',
  '#how-it-works >> text=LLM-as-a-Judge',
]
const HOW_IT_WORKS_TOTAL_MS = 24000

// ---------------------------------------------------------------------------
// PHẦN 3 — Your Agent, With a Map
// ---------------------------------------------------------------------------
const AGENT_MAP_HOVER = [
  '#agent-with-map >> ' + t('text=Coding Agent Không Có Bản Đồ', 'text=Blind Coding Agent'),
  '#agent-with-map >> ' + t('text=Coding Agent Có Guardian Hướng Dẫn', 'text=Guardian-Guided Agent'),
]
const AGENT_MAP_TOTAL_MS = 14000

// ---------------------------------------------------------------------------
// PHẦN 4 — CI/CD Drift Gate
// ---------------------------------------------------------------------------
const DRIFT_CI_HOVER = [
  '#drift-in-ci >> text=guardian check --ci',
  '#drift-in-ci >> text=guardian-bot',
  '#drift-in-ci >> ' + t('text=KẾT LUẬN: CHẶN', 'text=VERDICT: BLOCK'),
  '#drift-in-ci >> text=aws.ts:14',
  '#drift-in-ci >> ' + t('text=Prompt sửa lỗi sẵn sàng dán', 'text=Ready-to-paste Prompt-as-a-Fix'),
]
const DRIFT_CI_TOTAL_MS = 17000

// ---------------------------------------------------------------------------
// PHẦN 5 — Evaluation & Benchmarks
// ---------------------------------------------------------------------------
const EVAL_HOVER = [
  '#evaluation-benchmarks >> text=96.1%',
  '#evaluation-benchmarks >> text=94.2%',
  '#evaluation-benchmarks >> text=6.1%',
  '#evaluation-benchmarks >> text=100',
  '#evaluation-benchmarks >> text=tp-01-aws-secret',
  '#evaluation-benchmarks >> text=fp-01-any-in-vietnamese-comment',
]
const EVAL_TOTAL_MS = 19000

// ---------------------------------------------------------------------------
// PHẦN 6 — What's in the Box
// ---------------------------------------------------------------------------
const BOX_HOVER = [
  '#whats-in-the-box >> text=CLI & Pre-push Hook',
  '#whats-in-the-box >> text=Web Dashboard',
  '#whats-in-the-box >> text=OpenFGA ReBAC & RBAC',
  '#whats-in-the-box >> ' + t('text=Động cơ Policy-as-Code', 'text=Policy-as-Code Engine'),
  '#whats-in-the-box >> ' + t('text=Bộ nhớ đệm SHA-256', 'text=SHA-256 Diff Caching'),
  '#whats-in-the-box >> ' + t('text=Bộ Test Đánh giá', 'text=Evaluation Suite'),
]
const BOX_TOTAL_MS = 19000

// ---------------------------------------------------------------------------
// PHẦN 7 — Footer & CTA (không có id riêng -> cuộn tới thẻ <footer>)
// ---------------------------------------------------------------------------
const FOOTER_HOVER = [
  'footer >> ' + t('text=Hệ thống Hoạt động Tốt', 'text=System Operational'),
  'header >> text=Star on GitHub',
  'header >> ' + t('text=Đăng nhập', 'text=Login'),
]
const FOOTER_TOTAL_MS = 11000

const SECTIONS = [
  { id: null, caption: t('Giới thiệu chung', 'Overview'), hover: HERO_HOVER, totalMs: HERO_TOTAL_MS },
  { id: 'self-analysis-demo', caption: t('Pre-push Security Gate', 'Pre-push Security Gate'), terminal: true },
  { id: 'how-it-works', caption: t('4 Cổng an ninh & 5 lớp chống ảo giác', '4 Security Gates & 5 Anti-Hallucination Layers'), hover: HOW_IT_WORKS_HOVER, totalMs: HOW_IT_WORKS_TOTAL_MS },
  { id: 'agent-with-map', caption: t('Bản đồ ngữ cảnh kiến trúc', 'Architectural Context Map'), hover: AGENT_MAP_HOVER, totalMs: AGENT_MAP_TOTAL_MS },
  { id: 'drift-in-ci', caption: t('Cổng kiểm soát CI/CD', 'CI/CD Drift Gate'), hover: DRIFT_CI_HOVER, totalMs: DRIFT_CI_TOTAL_MS },
  { id: 'evaluation-benchmarks', caption: t('Benchmark & Độ chính xác Engine', 'Benchmark & Engine Accuracy'), hover: EVAL_HOVER, totalMs: EVAL_TOTAL_MS },
  { id: 'whats-in-the-box', caption: t('Hệ thống bao gồm', "What's in the Box"), hover: BOX_HOVER, totalMs: BOX_TOTAL_MS },
  { id: 'FOOTER', caption: t('Bắt đầu ngay', 'Get Started'), hover: FOOTER_HOVER, totalMs: FOOTER_TOTAL_MS },
]

const SLATE_MARK = '<div class="demo-slate-mark">G</div>'
const SLATE_TITLE = '<div class="demo-slate-title">qwoang<span>·guardian</span></div>'

const INTRO_HTML = `
  ${SLATE_MARK}
  ${SLATE_TITLE}
  <div class="demo-slate-tagline">${t(
    'Ngữ cảnh kiến trúc &amp; Cổng an ninh cho AI Coding Agent — trình diễn tự động',
    'Architectural context &amp; security gates for your coding agents — automated walkthrough',
  )}</div>
`

const OUTRO_HTML = `
  ${SLATE_MARK}
  ${SLATE_TITLE}
  <div class="demo-slate-cmd"><span class="p">$</span> npm install -g ai-dev-guardian</div>
  <div class="demo-slate-link">github.com/dquangai/ai-dev-guardian</div>
`

async function scrollToSection(page, id) {
  if (id === null) return
  if (id === 'FOOTER') {
    await page.evaluate(() => document.querySelector('footer')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  } else {
    await page.evaluate((sectionId) => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, id)
  }
  await page.waitForTimeout(900) // đợi smooth-scroll chạy xong trước khi bắt đầu đếm pause đọc nội dung
}

/** PHẦN 1 — theo dõi từng cột mốc thật của terminal auto-run (không đoán thời gian). */
async function runTerminalMilestones(page) {
  const s = (text) => `#self-analysis-demo >> text=${text}`

  await hoverSequence(page, [s('AUTO RUN')], 900)

  await page.locator(s('git push origin main')).first().waitFor({ state: 'visible', timeout: 30_000 })
  await hoverSequence(page, [s('git push origin main')], 700)

  await page.locator(s('BLOCK')).first().waitFor({ state: 'visible', timeout: 15_000 })
  await hoverSequence(page, [s('BLOCK')], 900)

  await page.locator(s('sso-redirect.policy.md')).waitFor({ state: 'visible', timeout: 10_000 })
  await hoverSequence(page, [s('sso-redirect.policy.md')], 1300)

  await page.locator(s('jwt-session-verification.policy.md')).waitFor({ state: 'visible', timeout: 10_000 })
  await hoverSequence(page, [s('jwt-session-verification.policy.md')], 1300)

  const fixPrompts = page.locator(s('💬'))
  await fixPrompts.last().waitFor({ state: 'visible', timeout: 10_000 })
  const box = await fixPrompts.last().boundingBox()
  if (box) await moveCursor(page, box.x + box.width / 2, box.y + box.height / 2, 650)
  await page.waitForTimeout(900)

  await page.locator(s('PASS')).first().waitFor({ state: 'visible', timeout: 20_000 })
  await hoverSequence(page, [s('PASS')], 1000)

  // Cột mốc an toàn cuối cùng: xác nhận cả vòng auto-run đã thực sự kết thúc.
  await page.getByText(FINISHED_TEXT[LANG], { exact: false }).waitFor({ state: 'visible', timeout: 30_000 })
}

/** Kiểm tra khô: mọi selector trong SECTIONS + terminal milestones có thực sự resolve trên
 * trang thật hay không, KHÔNG quay video. Chạy trước khi record để không tốn ~2-3 phút quay
 * lại nếu một selector bị sai (đổi text, đổi ngôn ngữ, v.v.). */
async function runDryRun(page) {
  const { centerOf } = await import('./overlay.mjs')
  let missCount = 0

  for (const section of SECTIONS) {
    if (section.terminal) continue
    for (const selector of section.hover) {
      const c = await centerOf(page, selector)
      const status = c ? 'OK  ' : 'MISS'
      if (!c) missCount++
      console.log(`[dry-run] ${status} [${section.caption}] ${selector}`)
    }
  }

  // Terminal: đợi 1 vòng chạy xong (giữ nguyên các bước hiện trên DOM ~5s trước khi loop lại)
  // rồi kiểm tra toàn bộ text mốc từng xuất hiện trong lượt đó.
  console.log('[dry-run] Đợi 1 vòng terminal auto-run để kiểm tra các mốc bên trong...')
  await page.evaluate(() => document.getElementById('self-analysis-demo')?.scrollIntoView())
  await page.getByText(FINISHED_TEXT[LANG], { exact: false }).waitFor({ state: 'visible', timeout: 60_000 })
  const terminalChecks = [
    'AUTO RUN',
    'git push origin main',
    'BLOCK',
    'sso-redirect.policy.md',
    'jwt-session-verification.policy.md',
    '💬',
    'PASS',
  ]
  for (const text of terminalChecks) {
    const c = await centerOf(page, `#self-analysis-demo >> text=${text}`)
    const status = c ? 'OK  ' : 'MISS'
    if (!c) missCount++
    console.log(`[dry-run] ${status} [Terminal] text=${text}`)
  }

  console.log(missCount === 0 ? '[dry-run] Tất cả selector đều OK.' : `[dry-run] ${missCount} selector MISS — sửa trước khi quay thật.`)
  return missCount === 0
}

async function main() {
  const t0 = Date.now()
  await mkdir(OUTPUT_DIR, { recursive: true })

  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: DRY_RUN ? undefined : { dir: OUTPUT_DIR, size: VIEWPORT },
    // Máy dev đứng sau proxy doanh nghiệp (Vingroup CA) — Chromium không tự tin CA hệ thống
    // như Node/curl. Chỉ ảnh hưởng script quay demo này, không đụng code sản phẩm.
    ignoreHTTPSErrors: true,
  })
  const page = await context.newPage()

  console.log(`[record] Mở ${LOGIN_URL}`)
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' })

  if (DRY_RUN) {
    const { centerOf } = await import('./overlay.mjs')
    let missCount = 0
    for (const selector of [...LOGIN_HOVER, NOTEBOOK_BUTTON]) {
      const c = await centerOf(page, selector)
      console.log(`[dry-run] ${c ? 'OK  ' : 'MISS'} [Login] ${selector}`)
      if (!c) missCount++
    }
    await page.locator(NOTEBOOK_BUTTON).click()
    await page.waitForURL('**/notebook', { timeout: 15_000 }).catch(() => missCount++)

    if (LANG === 'en') {
      await page.locator('button[title="Switch to English"]').click()
      await page.waitForTimeout(300)
    }
    if (DARK) {
      await page.locator('button[title="Giao diện tối"], button[title="Dark Mode"]').first().click()
      await page.waitForTimeout(300)
    }

    const ok = (await runDryRun(page)) && missCount === 0
    await browser.close()
    process.exit(ok ? 0 : 1)
  }

  await injectOverlay(page)
  await setCursorPosition(page, VIEWPORT.width / 2, 30)

  console.log('[record] Intro slate')
  await showSlate(page, INTRO_HTML)
  await page.waitForTimeout(2400)
  await hideSlate(page)
  await page.waitForLoadState('networkidle')

  console.log('[record] Trang Login')
  await showCaption(page, t('Trang đăng nhập', 'Login Page'))
  await hoverSequence(page, LOGIN_HOVER, LOGIN_TOTAL_MS)
  await hideCaption(page)

  await cursorClick(page, NOTEBOOK_BUTTON)
  await page.waitForURL('**/notebook', { timeout: 15_000 })
  await page.waitForTimeout(500)

  if (LANG === 'en') {
    await cursorClick(page, 'button[title="Switch to English"]')
    await page.waitForTimeout(300)
  }
  if (DARK) {
    const clicked = await cursorClick(page, 'button[title="Giao diện tối"]')
    if (!clicked) await cursorClick(page, 'button[title="Dark Mode"]')
    await page.waitForTimeout(300)
  }

  for (const section of SECTIONS) {
    console.log(`[record] Section: ${section.caption}`)
    await scrollToSection(page, section.id)
    await showCaption(page, section.caption)

    if (section.terminal) {
      await runTerminalMilestones(page)
      await page.waitForTimeout(1200) // giữ khung hình cuối 1 chút cho dễ xem
    } else {
      await hoverSequence(page, section.hover, section.totalMs)
    }

    await hideCaption(page)
  }

  console.log('[record] Outro slate')
  await showSlate(page, OUTRO_HTML)
  await page.waitForTimeout(2800)

  await context.close()
  await browser.close()

  const elapsedSec = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`[record] Tổng thời gian chạy: ${elapsedSec}s`)

  // Playwright ghi video vào 1 file mới tinh (tên hash) mỗi lần context.close() — phải lọc theo
  // mtime gần nhất, không phải sort tên (dễ nhầm với file cũ đã có sẵn tên tương tự trong output/).
  const entries = await readdir(OUTPUT_DIR)
  const webmFiles = await Promise.all(
    entries
      .filter((f) => f.endsWith('.webm'))
      .map(async (f) => ({ name: f, mtime: (await stat(path.join(OUTPUT_DIR, f))).mtimeMs })),
  )
  const latest = webmFiles.sort((a, b) => b.mtime - a.mtime)[0]
  if (latest) {
    const finalName = `ai-dev-guardian-demo-${LANG}${DARK ? '-dark' : ''}.webm`
    const finalPath = path.join(OUTPUT_DIR, finalName)
    const latestPath = path.join(OUTPUT_DIR, latest.name)
    if (latestPath !== finalPath) await rename(latestPath, finalPath)
    console.log(`[record] Video đã lưu tại demo/site-recorder/output/${finalName}`)
  } else {
    console.warn('[record] Không tìm thấy file .webm nào trong output/ — kiểm tra lại lỗi phía trên.')
  }
}

main().catch((err) => {
  console.error('[record] Lỗi:', err)
  process.exit(1)
})
