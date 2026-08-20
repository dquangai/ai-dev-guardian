// Hiệu ứng quay demo (con trỏ giả + ripple, caption section, slate intro/outro).
// Toàn bộ chỉ inject tạm thời vào trang lúc quay bằng addStyleTag/evaluate — không đụng
// tới source thật của web/src/pages/NoteBook.tsx, nên không ảnh hưởng trải nghiệm thật
// khi người xem tự mở link.

export const OVERLAY_CSS = `
#demo-cursor {
  position: fixed; top: 0; left: 0; width: 22px; height: 22px;
  pointer-events: none; z-index: 999998; will-change: transform;
}
#demo-cursor svg { filter: drop-shadow(0 2px 5px rgba(0,0,0,.5)); }

.demo-ripple {
  position: fixed; top: 0; left: 0; width: 40px; height: 40px;
  margin: -20px 0 0 -20px; border-radius: 50%;
  background: rgba(200,16,46,.5); border: 3px solid rgba(200,16,46,1);
  box-shadow: 0 0 0 1px rgba(255,255,255,.6), 0 0 18px rgba(200,16,46,.8);
  pointer-events: none; z-index: 999999;
  animation: demoRipple .9s cubic-bezier(.15,.7,.35,1) forwards;
}
@keyframes demoRipple {
  0%   { transform: scale(.25); opacity: 1; }
  40%  { opacity: .85; }
  100% { transform: scale(2.2); opacity: 0; }
}

#demo-caption {
  position: fixed; left: 28px; bottom: 28px; z-index: 999997;
  display: flex; align-items: center; gap: 8px;
  padding: 10px 16px; border-radius: 10px;
  background: rgba(10,15,29,.9); border: 1px solid rgba(200,16,46,.5);
  color: #F8FAFC; font-family: 'JetBrains Mono', monospace;
  font-size: 13px; font-weight: 700; letter-spacing: .01em;
  box-shadow: 0 10px 28px rgba(0,0,0,.4);
  opacity: 0; transform: translateY(10px); pointer-events: none;
  transition: opacity .45s ease, transform .45s ease;
}
#demo-caption.show { opacity: 1; transform: translateY(0); }
#demo-caption .demo-caption-dot {
  width: 7px; height: 7px; border-radius: 50%; background: #C8102E; flex: none;
}

#demo-slate {
  position: fixed; inset: 0; z-index: 9999999; display: none;
  align-items: center; justify-content: center; pointer-events: none;
  background: radial-gradient(circle at 30% 20%, #16213a 0%, #0A0F1D 55%, #05070d 100%);
  opacity: 0; transition: opacity .6s ease;
}
#demo-slate.show { opacity: 1; }
.demo-slate-inner { text-align: center; font-family: 'Inter', sans-serif; color: #F8FAFC; }
.demo-slate-mark {
  width: 56px; height: 56px; border-radius: 14px; background: #C8102E;
  display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;
  font-family: 'JetBrains Mono', monospace; font-weight: 800; font-size: 26px; color: #fff;
  box-shadow: 0 14px 34px rgba(200,16,46,.45);
}
.demo-slate-title { font-family: 'JetBrains Mono', monospace; font-size: 30px; font-weight: 800; letter-spacing: -.01em; }
.demo-slate-title span { color: #FF6B6B; }
.demo-slate-tagline { margin-top: 10px; font-size: 14px; color: #94A3B8; max-width: 520px; }
.demo-slate-cmd {
  margin-top: 26px; display: inline-flex; align-items: center; gap: 10px;
  font-family: 'JetBrains Mono', monospace; font-size: 14px; font-weight: 700;
  background: #111827; border: 1px solid #1F2937; padding: 10px 18px; border-radius: 10px; color: #F8FAFC;
}
.demo-slate-cmd .p { color: #3FB950; }
.demo-slate-link { margin-top: 16px; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #60A5FA; }
`

export async function injectOverlay(page) {
  await page.addStyleTag({ content: OVERLAY_CSS })
  await page.evaluate(() => {
    if (document.getElementById('demo-cursor')) return

    const cursor = document.createElement('div')
    cursor.id = 'demo-cursor'
    cursor.innerHTML =
      '<svg width="22" height="22" viewBox="0 0 22 22"><path d="M2 1 L2 18 L6.5 14.5 L9.5 20.5 L12 19.3 L9 13.3 L15 13 Z" fill="#F8FAFC" stroke="#0A0F1D" stroke-width="1.2" stroke-linejoin="round"/></svg>'
    document.body.appendChild(cursor)

    const caption = document.createElement('div')
    caption.id = 'demo-caption'
    caption.innerHTML = '<span class="demo-caption-dot"></span><span class="demo-caption-text"></span>'
    document.body.appendChild(caption)

    const slate = document.createElement('div')
    slate.id = 'demo-slate'
    slate.innerHTML = '<div class="demo-slate-inner"></div>'
    document.body.appendChild(slate)
  })
}

export async function setCursorPosition(page, x, y) {
  await page.evaluate(
    ({ x, y }) => {
      const el = document.getElementById('demo-cursor')
      if (!el) return
      el.style.transform = `translate(${x}px, ${y}px)`
      el.dataset.x = String(x)
      el.dataset.y = String(y)
    },
    { x, y },
  )
}

/** Animate cursor toward (x, y) with cubic ease-out. Resolves when the animation completes. */
export async function moveCursor(page, x, y, duration = 700) {
  await page.evaluate(
    ({ x, y, duration }) => {
      return new Promise((resolve) => {
        const el = document.getElementById('demo-cursor')
        if (!el) return resolve(undefined)
        const startX = parseFloat(el.dataset.x || String(x))
        const startY = parseFloat(el.dataset.y || String(y))
        const t0 = performance.now()
        const ease = (t) => 1 - Math.pow(1 - t, 3)
        function frame(now) {
          const t = Math.min(1, (now - t0) / duration)
          const et = ease(t)
          const cx = startX + (x - startX) * et
          const cy = startY + (y - startY) * et
          el.style.transform = `translate(${cx}px, ${cy}px)`
          el.dataset.x = String(cx)
          el.dataset.y = String(cy)
          if (t < 1) requestAnimationFrame(frame)
          else resolve(undefined)
        }
        requestAnimationFrame(frame)
      })
    },
    { x, y, duration },
  )
}

export async function clickRipple(page, x, y) {
  await page.evaluate(
    ({ x, y }) => {
      // Vị trí đặt qua left/top, KHÔNG dùng transform: @keyframes demoRipple set transform
      // (scale) trực tiếp và sẽ ghi đè hoàn toàn transform inline, xoá luôn phần translate.
      const r = document.createElement('div')
      r.className = 'demo-ripple'
      r.style.left = `${x}px`
      r.style.top = `${y}px`
      document.body.appendChild(r)
      setTimeout(() => r.remove(), 950)
    },
    { x, y },
  )
}

/** Bounding-box center of the first match, in viewport coordinates. null if not found/visible. */
export async function centerOf(page, selector) {
  const box = await page
    .locator(selector)
    .first()
    .boundingBox()
    .catch(() => null)
  if (!box) return null
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

/** Move the cursor to a real element and click it for real, with a ripple at the click point. */
export async function cursorClick(page, selector) {
  const c = await centerOf(page, selector)
  if (!c) return false
  await moveCursor(page, c.x, c.y, 550)
  await page.waitForTimeout(150)
  await clickRipple(page, c.x, c.y)
  await page.locator(selector).first().click()
  return true
}

/** Visit a sequence of selectors with the cursor, spreading roughly totalMs across them. */
export async function hoverSequence(page, selectors, totalMs) {
  const targets = (selectors ?? []).filter(Boolean)
  if (targets.length === 0) {
    await page.waitForTimeout(totalMs)
    return
  }
  const perStep = Math.max(700, Math.floor(totalMs / targets.length))
  for (const sel of targets) {
    const c = await centerOf(page, sel)
    if (c) await moveCursor(page, c.x, c.y, 650)
    await page.waitForTimeout(Math.max(0, perStep - 650))
  }
}

export async function showCaption(page, text) {
  await page.evaluate((text) => {
    const el = document.getElementById('demo-caption')
    if (!el) return
    el.querySelector('.demo-caption-text').textContent = text
    el.classList.remove('show')
    void el.offsetWidth // force reflow so the fade-in transition restarts
    el.classList.add('show')
  }, text)
}

export async function hideCaption(page) {
  await page.evaluate(() => {
    document.getElementById('demo-caption')?.classList.remove('show')
  })
}

export async function showSlate(page, html) {
  await page.evaluate((html) => {
    const el = document.getElementById('demo-slate')
    el.querySelector('.demo-slate-inner').innerHTML = html
    el.style.display = 'flex'
    void el.offsetWidth
    el.classList.add('show')
  }, html)
}

export async function hideSlate(page) {
  await page.evaluate(() => {
    document.getElementById('demo-slate')?.classList.remove('show')
  })
  await page.waitForTimeout(650) // đợi hết transition opacity trước khi ẩn hẳn
  await page.evaluate(() => {
    const el = document.getElementById('demo-slate')
    if (el) el.style.display = 'none'
  })
}
