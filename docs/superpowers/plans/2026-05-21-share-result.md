# Share Result Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan. Single commit at the end per spec.

**Goal:** Add two ways to share a SplitCeipt result: (1) a base64-encoded URL that reconstructs the result when opened in another tab, (2) a downloadable PNG image generated via Canvas API. Native Web Share API used when available.

**Architecture:** Two new pure-DOM modules (`sharelink.js`, `exportimage.js`). State gains `lastShareURL` and `lastBreakdown`. Calculator generates URL after each `calculate()`. Main.js handles two new buttons and detects `?r=` on load to auto-restore. No external libraries.

**Tech Stack:** Vanilla JS, Canvas API, `btoa`/`atob` for base64, Web Share API with download fallback, Vitest for unit tests.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/state.js` | Modify | Add `lastShareURL` and `lastBreakdown` fields |
| `src/modules/sharelink.js` | Create | `encodeResultToURL`, `decodeResultFromURL`, `restoreFromPayload` |
| `src/modules/exportimage.js` | Create | `exportResultAsImage`, `downloadImage`, `shareImageNative` |
| `src/modules/calculator.js` | Modify | Import new modules, set `state.lastBreakdown` + `state.lastShareURL`, update share-grid HTML to 2×2 |
| `src/main.js` | Modify | Wire `#btn-share-link` and `#btn-share-image` handlers; detect `?r=` on load and auto-restore |
| `src/style.css` | Modify | Append `.shared-banner`, `.shared-banner-close`, `.share-grid-2x2` styles |
| `tests/sharelink.test.js` | Create | 6 tests covering encode/decode/restore round-trip |

**Expected total tests after this plan: 25** (19 existing + 6 new in sharelink.test.js — spec said 5 but the test file has 6 cases).

---

## Task 1: Update state.js

**Files:**
- Modify: `src/state.js`

- [ ] **Step 1: Add `lastShareURL` and `lastBreakdown` to state object**

Replace the entire file:

```js
export const state = {
  people: [],
  items: [],
  scanMode: null,
  imageBase64: null,
  imageType: null,
  aiExtracted: false,
  currentStep: 1,
  lastTotals: {},
  lastGrand: 0,
  lastShareURL: '',
  lastBreakdown: {}
}
```

---

## Task 2: Write failing tests for sharelink

**Files:**
- Create: `tests/sharelink.test.js`

- [ ] **Step 1: Create the test file**

```js
import { describe, it, expect } from 'vitest'
import { encodeResultToURL, decodeResultFromURL, restoreFromPayload } from '../src/modules/sharelink.js'

const mockPeople = [
  { id: 1, name: 'Dilan', color: '#E8450A' },
  { id: 2, name: 'Jessi', color: '#1A7A4A' }
]
const mockItems = [
  { id: 10, name: 'Pizza', price: 30000, assignees: [1, 2] },
  { id: 11, name: 'Jugo', price: 8000, assignees: [1] }
]
const mockTotals = { 1: 23000, 2: 15000 }
const mockExtras = { tipPct: 10, tipFixed: 0, discount: 0, taxPct: 0 }

describe('sharelink', () => {
  it('encodes result to a valid URL', () => {
    const url = encodeResultToURL(mockPeople, mockItems, mockTotals, 38000, mockExtras)
    expect(url).toContain('?r=')
    expect(url).toContain('splitceipt')
  })

  it('decoded payload has correct number of people', () => {
    const url = encodeResultToURL(mockPeople, mockItems, mockTotals, 38000, mockExtras)
    const r = new URL(url).searchParams.get('r')
    const json = decodeURIComponent(escape(atob(r)))
    const payload = JSON.parse(json)
    expect(payload.p).toHaveLength(2)
    expect(payload.p[0].n).toBe('Dilan')
  })

  it('decoded payload has correct number of items', () => {
    const url = encodeResultToURL(mockPeople, mockItems, mockTotals, 38000, mockExtras)
    const r = new URL(url).searchParams.get('r')
    const json = decodeURIComponent(escape(atob(r)))
    const payload = JSON.parse(json)
    expect(payload.i).toHaveLength(2)
    expect(payload.i[0].n).toBe('Pizza')
  })

  it('decodeResultFromURL returns null when no param', () => {
    const result = decodeResultFromURL()
    expect(result).toBeNull()
  })

  it('restoreFromPayload rebuilds people correctly', () => {
    const url = encodeResultToURL(mockPeople, mockItems, mockTotals, 38000, mockExtras)
    const r = new URL(url).searchParams.get('r')
    const json = decodeURIComponent(escape(atob(r)))
    const payload = JSON.parse(json)
    const mockState = { people: [], items: [] }
    restoreFromPayload(payload, mockState)
    expect(mockState.people).toHaveLength(2)
    expect(mockState.people[0].name).toBe('Dilan')
    expect(mockState.items).toHaveLength(2)
  })

  it('extras are preserved through encode/decode', () => {
    const url = encodeResultToURL(mockPeople, mockItems, mockTotals, 38000, mockExtras)
    const r = new URL(url).searchParams.get('r')
    const json = decodeURIComponent(escape(atob(r)))
    const payload = JSON.parse(json)
    expect(payload.t.tipPct).toBe(10)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `pnpm test`
Expected: 6 FAIL in `tests/sharelink.test.js` with message about missing module `../src/modules/sharelink.js`. The 19 existing tests must still pass.

---

## Task 3: Create sharelink.js

**Files:**
- Create: `src/modules/sharelink.js`

- [ ] **Step 1: Implement the three exports**

```js
export function encodeResultToURL(people, items, totals, grandTotal, extras) {
  const payload = {
    v: 1,
    p: people.map(p => ({ n: p.name, c: p.color })),
    i: items.map(it => ({
      n: it.name,
      p: it.price,
      a: it.assignees.map(aid => people.findIndex(p => p.id === aid))
    })),
    t: {
      tipPct: extras.tipPct,
      tipFixed: extras.tipFixed,
      discount: extras.discount,
      taxPct: extras.taxPct
    }
  }
  const json = JSON.stringify(payload)
  const b64 = btoa(unescape(encodeURIComponent(json)))
  return `${window.location.origin}?r=${b64}`
}

export function decodeResultFromURL() {
  try {
    const params = new URLSearchParams(window.location.search)
    const r = params.get('r')
    if (!r) return null
    const json = decodeURIComponent(escape(atob(r)))
    const payload = JSON.parse(json)
    if (!payload.v || !payload.p || !payload.i) return null
    return payload
  } catch {
    return null
  }
}

export function restoreFromPayload(payload, state) {
  state.people = payload.p.map((p, idx) => ({
    id: idx + 1,
    name: p.n,
    color: p.c
  }))
  state.items = payload.i.map((it, idx) => ({
    id: idx + 100,
    name: it.n,
    price: it.p,
    assignees: it.a.map(pIdx => pIdx + 1),
    aiAdded: false
  }))
  return payload.t
}
```

- [ ] **Step 2: Run tests to confirm all 25 pass**

Run: `pnpm test`
Expected: PASS — 25 tests passing (19 existing + 6 new).

---

## Task 4: Create exportimage.js

**Files:**
- Create: `src/modules/exportimage.js`

- [ ] **Step 1: Implement Canvas API export and share helpers**

```js
import { fmt } from '../utils.js'

export function exportResultAsImage(people, totals, grandTotal, breakdown) {
  const canvas = document.createElement('canvas')
  const dpr = window.devicePixelRatio || 2
  const W = 400
  const rowH = 56
  const headerH = 120
  const footerH = 80
  const H = headerH + (people.length * rowH) + footerH + 40

  canvas.width = W * dpr
  canvas.height = H * dpr
  canvas.style.width = W + 'px'
  canvas.style.height = H + 'px'

  const ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)

  ctx.fillStyle = '#F5F2EC'
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = '#E8450A'
  ctx.fillRect(0, 0, W, 72)

  ctx.fillStyle = '#fff'
  ctx.font = 'bold 22px system-ui, sans-serif'
  ctx.fillText('Split', 24, 44)
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.font = 'bold 22px system-ui, sans-serif'
  ctx.fillText('Ceipt', 24 + ctx.measureText('Split').width, 44)

  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.font = '13px system-ui, sans-serif'
  ctx.fillText('divide sin dramas · splitceipt.app', 24, 62)

  ctx.fillStyle = '#1A1814'
  ctx.font = 'bold 16px system-ui, sans-serif'
  ctx.fillText('¡Todo dividido! 🎉', 24, 104)

  people.forEach((p, i) => {
    const y = headerH + (i * rowH)

    ctx.fillStyle = '#FDFBF7'
    roundRect(ctx, 16, y, W - 32, rowH - 8, 12)
    ctx.fill()

    ctx.fillStyle = p.color
    ctx.beginPath()
    ctx.arc(44, y + 22, 18, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#fff'
    ctx.font = 'bold 14px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(p.name[0].toUpperCase(), 44, y + 27)
    ctx.textAlign = 'left'

    ctx.fillStyle = '#1A1814'
    ctx.font = '500 15px system-ui, sans-serif'
    ctx.fillText(p.name, 72, y + 18)

    const items = breakdown[p.id] || []
    ctx.fillStyle = '#A8A49E'
    ctx.font = '12px system-ui, sans-serif'
    ctx.fillText(`${items.length} item${items.length !== 1 ? 's' : ''}`, 72, y + 34)

    ctx.fillStyle = p.color
    ctx.font = 'bold 18px system-ui, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(fmt(totals[p.id]), W - 28, y + 26)
    ctx.textAlign = 'left'
  })

  const totalY = headerH + (people.length * rowH) + 16
  ctx.fillStyle = '#1A1814'
  roundRect(ctx, 16, totalY, W - 32, 52, 12)
  ctx.fill()

  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = '12px system-ui, sans-serif'
  ctx.fillText('Total · COP', 28, totalY + 20)

  ctx.fillStyle = '#fff'
  ctx.font = 'bold 22px system-ui, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText(fmt(grandTotal), W - 28, totalY + 38)
  ctx.textAlign = 'left'

  ctx.fillStyle = '#A8A49E'
  ctx.font = '11px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('Generado con splitceipt.app · Divide sin dramas', W / 2, totalY + 76)
  ctx.textAlign = 'left'

  return canvas
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

export function downloadImage(canvas, filename = 'splitceipt.png') {
  const link = document.createElement('a')
  link.download = filename
  link.href = canvas.toDataURL('image/png')
  link.click()
}

export function shareImageNative(canvas, people, grandTotal) {
  canvas.toBlob(async (blob) => {
    const file = new File([blob], 'splitceipt.png', { type: 'image/png' })
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: 'SplitCeipt',
        text: `Total dividido: ${fmt(grandTotal)} entre ${people.map(p => p.name).join(', ')}`
      })
    } else {
      downloadImage(canvas)
    }
  })
}
```

- [ ] **Step 2: Confirm tests still pass after creating exportimage.js**

Run: `pnpm test`
Expected: PASS — 25 tests (no impact from this new module since nothing imports it yet).

---

## Task 5: Update calculator.js

**Files:**
- Modify: `src/modules/calculator.js`

- [ ] **Step 1: Add imports for new modules**

At the top of `src/modules/calculator.js`, add after the existing imports:

```js
import { encodeResultToURL } from './sharelink.js'
```

(Note: `exportimage.js` is imported in main.js, not here.)

- [ ] **Step 2: In `calculate()`, save breakdown to state and generate share URL**

After this line:
```js
const { totals, breakdown, grandTotal } = computeTotals(state.people, state.items, getExtras())
state.lastTotals = totals
state.lastGrand = grandTotal
```

Add:
```js
state.lastBreakdown = breakdown
state.lastShareURL = encodeResultToURL(state.people, state.items, totals, grandTotal, getExtras())
```

- [ ] **Step 3: Replace the existing `.share-grid` HTML with the new 2×2 button layout**

Find this block in `calculate()`:
```js
    <div class="share-grid">
      <button class="btn btn-secondary btn-full" id="btn-copy">Copiar resumen</button>
      <button class="btn btn-ghost btn-full" id="btn-whatsapp">WhatsApp</button>
    </div>`
```

Replace with:
```js
    <div class="share-grid-2x2">
      <button class="btn btn-secondary" id="btn-copy">📋 Copiar texto</button>
      <button class="btn btn-secondary" id="btn-whatsapp">💬 WhatsApp</button>
      <button class="btn btn-secondary" id="btn-share-link">🔗 Copiar link</button>
      <button class="btn btn-ai" id="btn-share-image">📸 Guardar imagen</button>
    </div>`
```

- [ ] **Step 4: Run tests to confirm no regressions**

Run: `pnpm test`
Expected: 25/25 passing — `computeTotals` is a pure function so unaffected; HTML changes don't break unit tests.

---

## Task 6: Update main.js

**Files:**
- Modify: `src/main.js`

- [ ] **Step 1: Add new module imports at the top with other imports**

At the top of `src/main.js`, after the existing imports (do NOT re-import `calculate` — it is already imported), add:

```js
import { decodeResultFromURL, restoreFromPayload } from './modules/sharelink.js'
import { exportResultAsImage, shareImageNative } from './modules/exportimage.js'
```

- [ ] **Step 2: Add the two new button handlers to the result-content click listener**

Find the existing block:
```js
document.getElementById('result-content').addEventListener('click', e => {
  if (e.target.closest('#btn-copy')) copyText()
  if (e.target.closest('#btn-whatsapp')) shareWhatsApp()
  const header = e.target.closest('.person-result-header')
  if (header) {
    const breakdown = header.nextElementSibling
    breakdown.style.display = breakdown.style.display === 'block' ? 'none' : 'block'
  }
})
```

Replace with:
```js
document.getElementById('result-content').addEventListener('click', e => {
  if (e.target.closest('#btn-copy')) copyText()
  if (e.target.closest('#btn-whatsapp')) shareWhatsApp()
  if (e.target.closest('#btn-share-link')) {
    navigator.clipboard.writeText(state.lastShareURL)
      .then(() => showToast('¡Link copiado!'))
      .catch(() => showToast('No se pudo copiar'))
  }
  if (e.target.closest('#btn-share-image')) {
    const canvas = exportResultAsImage(
      state.people,
      state.lastTotals,
      state.lastGrand,
      state.lastBreakdown
    )
    shareImageNative(canvas, state.people, state.lastGrand)
  }
  const header = e.target.closest('.person-result-header')
  if (header) {
    const breakdown = header.nextElementSibling
    breakdown.style.display = breakdown.style.display === 'block' ? 'none' : 'block'
  }
})
```

**Note:** This adds `showToast` to the things needed. Check whether `showToast` is already imported in main.js — it was removed in an earlier cleanup. If not present, add it to the import from `./modules/ui.js`.

- [ ] **Step 3: Re-add `showToast` to the ui.js import**

Find the existing import:
```js
import { goStep } from './modules/ui.js'
```

Change to:
```js
import { showToast, goStep } from './modules/ui.js'
```

- [ ] **Step 4: At the very bottom of main.js, after the SW registration, add the URL-restore logic**

Append to the end of `src/main.js`:

```js
// ── SHARED RESULT VIA URL ──
const shared = decodeResultFromURL()
if (shared) {
  const extras = restoreFromPayload(shared, state)
  document.getElementById('tip-pct').value = extras.tipPct || 0
  document.getElementById('tip-fixed').value = extras.tipFixed || 0
  document.getElementById('discount').value = extras.discount || 0
  document.getElementById('tax-pct').value = extras.taxPct || 0
  calculate()
  const banner = document.createElement('div')
  banner.className = 'shared-banner'
  banner.innerHTML = `
    🔗 Resultado compartido ·
    <button onclick="this.parentElement.remove()" class="shared-banner-close">
      Nueva división
    </button>`
  document.querySelector('.wrap').prepend(banner)
}
```

- [ ] **Step 5: Run tests to confirm 25/25 still pass**

Run: `pnpm test`
Expected: 25/25 passing.

---

## Task 7: Add CSS rules

**Files:**
- Modify: `src/style.css`

- [ ] **Step 1: Append new styles at the end of style.css**

At the very end of `src/style.css`, append:

```css

/* SHARED RESULT BANNER */
.shared-banner {
  background: var(--purple-bg);
  border: 1px solid rgba(123,92,245,0.2);
  border-radius: var(--radius-sm);
  padding: 10px 16px;
  font-size: 13px;
  color: var(--purple);
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.shared-banner-close {
  background: var(--purple);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  padding: 4px 12px;
  font-size: 12px;
  cursor: pointer;
  font-family: 'DM Sans', sans-serif;
}

/* SHARE GRID 2x2 */
.share-grid-2x2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 16px;
}

@media (max-width: 380px) {
  .share-grid-2x2 {
    grid-template-columns: 1fr;
  }
}
```

---

## Task 8: Validate, commit, and deploy

- [ ] **Step 1: Run build**

Run: `pnpm build`
Expected: exit 0, 13 modules transformed (now 15 — sharelink + exportimage).

- [ ] **Step 2: Run full test suite**

Run: `pnpm test`
Expected: **25/25 tests passing** across 4 test files (storage, calculator, share, sharelink).

- [ ] **Step 3: Verify nothing else was changed**

Run: `git status --short`
Expected: Only the files listed in the File Map above are modified. No unexpected changes.

- [ ] **Step 4: Stage and commit**

```bash
git add -A
git commit -m "feat: share result via link (base64 URL) and export as image (Canvas API)"
```

- [ ] **Step 5: Apply verification-before-completion skill**

Run fresh verification:
- `pnpm build` exit 0
- `pnpm test` 25/25
- `git status` clean

- [ ] **Step 6: Push and deploy**

```bash
git push origin master
vercel --prod
```

- [ ] **Step 7: Manual smoke test (post-deploy)**

After Vercel reports `readyState: READY`:
1. Open https://www.splitceipt.app
2. Add 2 people, add 2 items, assign each, set tip, click "Ver resultado"
3. Click "🔗 Copiar link" → confirm toast "¡Link copiado!"
4. Open the copied URL in a new tab/incognito → confirm result auto-loads with purple "Resultado compartido" banner
5. Click "📸 Guardar imagen" → confirm browser downloads `splitceipt.png` (desktop) or shows native share sheet (mobile)

---

## Known limitations (acknowledged, not bugs)

1. **URL length cap:** Base64-encoded payloads for very large bills (20+ items × 10 people) may exceed common URL length limits (~2 KB). Acceptable for typical use cases.
2. **Inline onclick in shared banner:** `onclick="this.parentElement.remove()"` violates the project's event-delegation pattern but is harmless under default CSP. Spec-prescribed.
3. **"Nueva división" button in banner only dismisses the banner.** It does not call `resetAll()`. The label may mislead users; the actual reset still requires the bottom-nav "Nueva división" button. Spec-prescribed.
4. **No unit tests for `exportimage.js`:** Canvas API rendering is DOM-coupled and jsdom's Canvas support is incomplete. The Web Share API path is also impossible to test in jsdom. Visual smoke test in Step 7 above is the verification.
