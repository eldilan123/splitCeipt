# SplitCeipt — Vite Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `splitceipt-v2.html` (single-file prototype with non-functional AI scan) to a production-ready Vite project that securely proxies the Anthropic API through a Vercel serverless function.

**Architecture:** Split the monolithic HTML into focused ES modules sharing a central `state` object. Move the Anthropic API call from the browser into `/api/scan.js` so the API key never reaches the client. Unit-test pure logic (calculator, storage, share) before wiring the DOM. Remove all inline event handlers from HTML; wire everything via `addEventListener` in `main.js`.

**Tech Stack:** Vite 5, Vanilla JS (ESM modules), Vercel Serverless (Node.js), Anthropic `claude-haiku-4-5-20251001`, Vitest 2 + jsdom, PWA (manifest + service worker).

---

## File Map

| File | Responsibility |
|------|----------------|
| `package.json` | npm scripts, devDependencies |
| `vite.config.js` | root=src, build outDir=dist, dev proxy to API |
| `vitest.config.js` | test env=jsdom, include tests/** |
| `.gitignore` | node_modules, dist, .env, .vercel |
| `.env.example` | document ANTHROPIC_API_KEY |
| `vercel.json` | route /api/* → serverless, /* → SPA |
| `api/scan.js` | Anthropic API proxy (key never reaches client) |
| `tests/storage.test.js` | unit tests: scan counter logic |
| `tests/calculator.test.js` | unit tests: split math (computeTotals) |
| `tests/share.test.js` | unit tests: buildText output structure |
| `src/utils.js` | fmt, escH, COLORS, getColor |
| `src/state.js` | shared mutable app state object |
| `src/modules/storage.js` | localStorage scan counter + freemium gate |
| `src/modules/ui.js` | showToast, goStep (returns bool) |
| `src/modules/people.js` | addPerson, removePerson, renderPeople, updateStep1Btn |
| `src/modules/items.js` | addItem, removeItem, toggleAssignee, renameItem, repriceItem, renderItems, updateStep4Btn |
| `src/modules/scanner.js` | selectMode, loadFile, scanReceipt → POST /api/scan |
| `src/modules/calculator.js` | computeTotals (pure), getExtras, updateExtrasPreview, calculate |
| `src/modules/share.js` | buildText (pure), copyText, shareWhatsApp |
| `src/style.css` | all CSS extracted verbatim from v2.html |
| `src/index.html` | entry HTML — no inline scripts or event handlers |
| `src/main.js` | imports all modules, wires all addEventListener |
| `public/manifest.json` | PWA manifest |
| `public/sw.js` | service worker |

**Key security fix:** The MVP calls `https://api.anthropic.com/v1/messages` directly from the browser with no API key (always fails 401). This plan routes all AI calls through `/api/scan.js` which reads `process.env.ANTHROPIC_API_KEY` server-side.

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `vitest.config.js`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `vercel.json`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "splitceipt",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run"
  },
  "devDependencies": {
    "vite": "^5.4.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, `package-lock.json` generated, no errors.

- [ ] **Step 3: Create `vite.config.js`**

```js
import { defineConfig } from 'vite'

export default defineConfig({
  root: 'src',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000'
    }
  }
})
```

> Note: The proxy routes `/api/*` to port 3000 where `vercel dev` runs. Use `vercel dev` for full-stack local testing. `npm run dev` alone works for all non-AI features.

- [ ] **Step 4: Create `vitest.config.js`**

```js
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.js']
  }
})
```

- [ ] **Step 5: Create `.gitignore`**

```
node_modules/
dist/
.env
.vercel/
```

- [ ] **Step 6: Create `.env.example`**

```
# Vercel serverless — never set this in the frontend
ANTHROPIC_API_KEY=sk-ant-api03-...
```

- [ ] **Step 7: Create `vercel.json`**

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

- [ ] **Step 8: Commit**

```bash
git init
git add package.json package-lock.json vite.config.js vitest.config.js .gitignore .env.example vercel.json
git commit -m "feat: initialize Vite project scaffold"
```

---

## Task 2: Backend API

**Files:**
- Create: `api/scan.js`

- [ ] **Step 1: Create `api/scan.js`**

```js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') {
    return res.status(405).json({ error: true, message: 'Method not allowed' })
  }

  const { image, mediaType } = req.body ?? {}
  if (!image || !mediaType) {
    return res.status(400).json({ error: true, message: 'image y mediaType son requeridos' })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: true, message: 'API key no configurada en el servidor' })
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: image }
            },
            {
              type: 'text',
              text: `Analiza este recibo/cuenta de restaurante y extrae TODA la información.
Responde SOLO con JSON válido, sin markdown, sin texto extra, exactamente así:
{
  "items": [{"name": "nombre del item", "price": 12500}],
  "tip_pct": 0,
  "tip_fixed": 0,
  "tax_pct": 0,
  "discount": 0,
  "subtotal": 0,
  "total": 0,
  "currency": "COP",
  "notes": "observación breve"
}
Reglas:
- Todos los precios como números sin puntos ni comas ni símbolos de moneda
- Si hay items con cantidades (ej "2x Coca-Cola"), créalos como entradas separadas
- Si detectas propina como porcentaje, ponla en tip_pct. Si es monto fijo, en tip_fixed
- Si la imagen no es un recibo, responde con items vacíos y notes explicando
- Si hay texto ilegible en algún item, usa tu mejor estimación con el nombre "[ilegible]"`
            }
          ]
        }]
      })
    })

    const data = await response.json()
    if (data.error) {
      return res.status(500).json({ error: true, message: data.error.message })
    }

    const text = data.content?.find(b => b.type === 'text')?.text ?? ''
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    return res.status(200).json(parsed)
  } catch (err) {
    console.error('scan error:', err)
    return res.status(500).json({ error: true, message: 'Error al procesar el recibo. Intenta de nuevo.' })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add api/scan.js
git commit -m "feat: add /api/scan serverless — secure Anthropic proxy"
```

---

## Task 3: Shared Utils + State

**Files:**
- Create: `src/utils.js`
- Create: `src/state.js`

- [ ] **Step 1: Create `src/utils.js`**

```js
export const COLORS = ['#E8450A', '#1A7A4A', '#7B5CF5', '#C4861A', '#1A6B9A', '#A3459A', '#2E8B57', '#CC3A4A']

export function getColor(index) {
  return COLORS[index % COLORS.length]
}

export function fmt(n) {
  return '$' + Math.round(n).toLocaleString('es-CO')
}

export function escH(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
```

- [ ] **Step 2: Create `src/state.js`**

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
  lastGrand: 0
}
```

- [ ] **Step 3: Commit**

```bash
git add src/utils.js src/state.js
git commit -m "feat: add shared state object and utility helpers"
```

---

## Task 4: Storage Module (TDD)

**Files:**
- Create: `tests/storage.test.js`
- Create: `src/modules/storage.js`

- [ ] **Step 1: Write failing tests — create `tests/storage.test.js`**

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { getScanData, incrementScan, hasScansRemaining } from '../src/modules/storage.js'

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns count 0 when nothing stored', () => {
    expect(getScanData().count).toBe(0)
  })

  it('increments scan count on each call', () => {
    incrementScan()
    incrementScan()
    expect(getScanData().count).toBe(2)
  })

  it('hasScansRemaining returns true when under limit', () => {
    incrementScan()
    incrementScan()
    expect(hasScansRemaining()).toBe(true)
  })

  it('hasScansRemaining returns false when limit of 3 reached', () => {
    incrementScan()
    incrementScan()
    incrementScan()
    expect(hasScansRemaining()).toBe(false)
  })

  it('resets count when stored month differs from current month', () => {
    localStorage.setItem('sc_scans', JSON.stringify({ count: 3, resetDate: '2025-01' }))
    expect(getScanData().count).toBe(0)
    expect(hasScansRemaining()).toBe(true)
  })
})
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/modules/storage.js'`

- [ ] **Step 3: Implement `src/modules/storage.js`**

Create directory first: `mkdir src\modules`

```js
const SCAN_KEY = 'sc_scans'
const FREE_LIMIT = 3

function getCurrentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function getScanData() {
  try {
    const raw = localStorage.getItem(SCAN_KEY)
    if (!raw) return { count: 0, resetDate: getCurrentMonth() }
    const data = JSON.parse(raw)
    if (data.resetDate !== getCurrentMonth()) {
      return { count: 0, resetDate: getCurrentMonth() }
    }
    return data
  } catch {
    return { count: 0, resetDate: getCurrentMonth() }
  }
}

export function incrementScan() {
  const data = getScanData()
  data.count++
  localStorage.setItem(SCAN_KEY, JSON.stringify(data))
  return data.count
}

export function hasScansRemaining() {
  return getScanData().count < FREE_LIMIT
}
```

- [ ] **Step 4: Run to confirm pass**

Run: `npm test`
Expected: PASS — 5 tests passing in `storage` suite

- [ ] **Step 5: Commit**

```bash
git add tests/storage.test.js src/modules/storage.js
git commit -m "feat: add storage module with monthly scan counter (TDD)"
```

---

## Task 5: Calculator Module (TDD)

**Files:**
- Create: `tests/calculator.test.js`
- Create: `src/modules/calculator.js`

- [ ] **Step 1: Write failing tests — create `tests/calculator.test.js`**

```js
import { describe, it, expect } from 'vitest'
import { computeTotals } from '../src/modules/calculator.js'

const people = (ids) => ids.map(id => ({ id, name: `P${id}` }))

describe('computeTotals', () => {
  it('splits an item evenly between two people', () => {
    const { totals, grandTotal } = computeTotals(
      people([1, 2]),
      [{ id: 10, name: 'Pizza', price: 30000, assignees: [1, 2] }],
      { tipPct: 0, tipFixed: 0, discount: 0, taxPct: 0 }
    )
    expect(totals[1]).toBe(15000)
    expect(totals[2]).toBe(15000)
    expect(grandTotal).toBe(30000)
  })

  it('assigns the full item to one person', () => {
    const { totals } = computeTotals(
      people([1, 2]),
      [
        { id: 10, name: 'Burger', price: 20000, assignees: [1] },
        { id: 11, name: 'Salad', price: 15000, assignees: [2] }
      ],
      { tipPct: 0, tipFixed: 0, discount: 0, taxPct: 0 }
    )
    expect(totals[1]).toBe(20000)
    expect(totals[2]).toBe(15000)
  })

  it('applies tip percentage proportionally', () => {
    const { totals } = computeTotals(
      people([1]),
      [{ id: 10, name: 'Burger', price: 20000, assignees: [1] }],
      { tipPct: 10, tipFixed: 0, discount: 0, taxPct: 0 }
    )
    expect(totals[1]).toBeCloseTo(22000)
  })

  it('applies fixed tip to grand total', () => {
    const { grandTotal } = computeTotals(
      people([1, 2]),
      [{ id: 10, name: 'Pizza', price: 20000, assignees: [1, 2] }],
      { tipPct: 0, tipFixed: 4000, discount: 0, taxPct: 0 }
    )
    expect(grandTotal).toBe(24000)
  })

  it('subtracts discount from total', () => {
    const { totals } = computeTotals(
      people([1]),
      [{ id: 10, name: 'Burger', price: 20000, assignees: [1] }],
      { tipPct: 0, tipFixed: 0, discount: 5000, taxPct: 0 }
    )
    expect(totals[1]).toBe(15000)
  })

  it('applies tax percentage', () => {
    const { totals } = computeTotals(
      people([1]),
      [{ id: 10, name: 'Burger', price: 20000, assignees: [1] }],
      { tipPct: 0, tipFixed: 0, discount: 0, taxPct: 8 }
    )
    expect(totals[1]).toBeCloseTo(21600)
  })

  it('includes breakdown with item name and adjusted amount', () => {
    const { breakdown } = computeTotals(
      people([1]),
      [{ id: 10, name: 'Pizza', price: 30000, assignees: [1] }],
      { tipPct: 0, tipFixed: 0, discount: 0, taxPct: 0 }
    )
    expect(breakdown[1]).toHaveLength(1)
    expect(breakdown[1][0].name).toBe('Pizza')
    expect(breakdown[1][0].adjusted).toBe(30000)
  })

  it('returns zero totals for empty items list', () => {
    const { grandTotal } = computeTotals(
      people([1, 2]),
      [],
      { tipPct: 10, tipFixed: 0, discount: 0, taxPct: 0 }
    )
    expect(grandTotal).toBe(0)
  })
})
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/modules/calculator.js'`

- [ ] **Step 3: Implement `src/modules/calculator.js`**

```js
import { state } from '../state.js'
import { fmt, escH } from '../utils.js'
import { showToast, goStep } from './ui.js'

export function computeTotals(people, items, extras) {
  const { tipPct, tipFixed, discount, taxPct } = extras
  const subtotal = items.reduce((s, i) => s + i.price, 0)
  const tip = subtotal * (tipPct / 100) + tipFixed
  const tax = subtotal * (taxPct / 100)
  const extraFactor = subtotal > 0 ? (subtotal + tip + tax - discount) / subtotal : 1

  const totals = {}
  const breakdown = {}
  people.forEach(p => { totals[p.id] = 0; breakdown[p.id] = [] })

  items.forEach(item => {
    const share = item.price / item.assignees.length
    item.assignees.forEach(pid => {
      const adjusted = share * extraFactor
      totals[pid] += adjusted
      breakdown[pid].push({ name: item.name, adjusted })
    })
  })

  const grandTotal = Object.values(totals).reduce((s, v) => s + v, 0)
  return { totals, breakdown, grandTotal }
}

export function getExtras() {
  return {
    tipPct: parseFloat(document.getElementById('tip-pct').value) || 0,
    tipFixed: parseFloat(document.getElementById('tip-fixed').value) || 0,
    discount: parseFloat(document.getElementById('discount').value) || 0,
    taxPct: parseFloat(document.getElementById('tax-pct').value) || 0
  }
}

export function updateExtrasPreview() {
  const subtotal = state.items.reduce((s, i) => s + i.price, 0)
  const { tipPct, tipFixed, discount, taxPct } = getExtras()
  const tip = subtotal * (tipPct / 100) + tipFixed
  const tax = subtotal * (taxPct / 100)
  const total = subtotal + tip + tax - discount
  document.getElementById('extras-preview').innerHTML = `
    <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>Subtotal</span><span style="font-weight:500;">${fmt(subtotal)}</span></div>
    ${tip > 0 ? `<div style="display:flex;justify-content:space-between;margin-bottom:4px;color:var(--green);"><span>Propina</span><span>+${fmt(tip)}</span></div>` : ''}
    ${tax > 0 ? `<div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>Impuesto</span><span>+${fmt(tax)}</span></div>` : ''}
    ${discount > 0 ? `<div style="display:flex;justify-content:space-between;margin-bottom:4px;color:var(--green);"><span>Descuento</span><span>−${fmt(discount)}</span></div>` : ''}
    <hr class="divider"/>
    <div style="display:flex;justify-content:space-between;font-weight:600;font-size:15px;"><span>Total estimado</span><span>${fmt(total)}</span></div>`
}

export function calculate() {
  const unassigned = state.items.filter(i => i.assignees.length === 0)
  if (unassigned.length > 0) {
    showToast(`"${unassigned[0].name}" no tiene nadie asignado`)
    goStep(3)
    return
  }

  const { totals, breakdown, grandTotal } = computeTotals(state.people, state.items, getExtras())
  state.lastTotals = totals
  state.lastGrand = grandTotal
  state.currentStep = 5

  document.querySelectorAll('.panel').forEach(p => p.classList.remove('visible'))
  document.getElementById('panel-5').classList.add('visible')
  document.querySelectorAll('.step-tab').forEach((t, i) => {
    t.classList.remove('active', 'done')
    if (i + 1 === 5) t.classList.add('active')
    else t.classList.add('done')
  })

  document.getElementById('result-content').innerHTML = `
    <div class="result-header">
      <div class="result-icon">✓</div>
      <div>
        <div class="result-title">¡Todo dividido!</div>
        <div class="result-sub">${state.people.length} personas · ${state.items.length} items${state.aiExtracted ? ' · ✦ escaneado con IA' : ''}</div>
      </div>
    </div>
    ${state.people.map(p => `
      <div class="person-result">
        <div class="person-result-header" data-person-id="${p.id}">
          <div class="person-result-left">
            <div class="person-avatar" style="background:${p.color};width:32px;height:32px;font-size:13px;">${p.name[0].toUpperCase()}</div>
            <span class="person-result-name">${escH(p.name)}</span>
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <span class="person-total" style="color:${p.color}">${fmt(totals[p.id])}</span>
            <span style="color:var(--ink3);font-size:12px;">▾</span>
          </div>
        </div>
        <div class="person-result-items">
          ${breakdown[p.id].map(it => `
            <div class="result-item-line">
              <span>${escH(it.name)}</span>
              <span class="result-item-amount">${fmt(it.adjusted)}</span>
            </div>`).join('')}
        </div>
      </div>`).join('')}
    <div class="total-bar">
      <div><div class="total-bar-label">Total del recibo</div></div>
      <div class="total-bar-amount">${fmt(grandTotal)}</div>
    </div>
    <div class="share-grid">
      <button class="btn btn-secondary btn-full" id="btn-copy">Copiar resumen</button>
      <button class="btn btn-ghost btn-full" id="btn-whatsapp">WhatsApp</button>
    </div>`

  window.scrollTo({ top: 0, behavior: 'smooth' })
}
```

- [ ] **Step 4: Run to confirm pass**

Run: `npm test`
Expected: PASS — all 8 tests passing (5 storage + 8 calculator)

- [ ] **Step 5: Commit**

```bash
git add tests/calculator.test.js src/modules/calculator.js
git commit -m "feat: add calculator module with pure computeTotals (TDD)"
```

---

## Task 6: UI Module

**Files:**
- Create: `src/modules/ui.js`

- [ ] **Step 1: Create `src/modules/ui.js`**

```js
import { state } from '../state.js'

export function showToast(msg, dur = 2200) {
  const t = document.getElementById('toast')
  t.textContent = msg
  t.classList.add('show')
  setTimeout(() => t.classList.remove('show'), dur)
}

export function goStep(n) {
  if (n > 1 && state.people.length < 2) {
    showToast('Agrega al menos 2 personas')
    return false
  }
  if (n > 3 && state.items.length === 0) {
    showToast('Agrega al menos un item')
    return false
  }
  state.currentStep = n
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('visible'))
  document.getElementById('panel-' + n).classList.add('visible')
  document.querySelectorAll('.step-tab').forEach((t, i) => {
    t.classList.remove('active', 'done')
    if (i + 1 === n) t.classList.add('active')
    else if (i + 1 < n) t.classList.add('done')
  })
  window.scrollTo({ top: 0, behavior: 'smooth' })
  return true
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/ui.js
git commit -m "feat: add ui module — showToast, goStep"
```

---

## Task 7: People Module

**Files:**
- Create: `src/modules/people.js`

- [ ] **Step 1: Create `src/modules/people.js`**

```js
import { state } from '../state.js'
import { escH, getColor } from '../utils.js'
import { showToast } from './ui.js'

export function addPerson() {
  const input = document.getElementById('person-input')
  const name = input.value.trim()
  if (!name) return
  if (state.people.find(p => p.name.toLowerCase() === name.toLowerCase())) {
    showToast('Ya está en la lista')
    return
  }
  if (state.people.length >= 10) {
    showToast('Máximo 10 personas')
    return
  }
  state.people.push({ id: Date.now(), name, color: getColor(state.people.length) })
  input.value = ''
  renderPeople()
  updateStep1Btn()
}

export function removePerson(id) {
  state.people = state.people.filter(p => p.id !== id)
  state.items.forEach(item => {
    item.assignees = item.assignees.filter(a => a !== id)
  })
  renderPeople()
  updateStep1Btn()
}

export function renderPeople() {
  document.getElementById('people-list').innerHTML = state.people.map(p => `
    <div class="person-chip" data-person-id="${p.id}">
      <div class="person-avatar" style="background:${p.color}">${p.name[0].toUpperCase()}</div>
      <span>${escH(p.name)}</span>
      <button class="remove" aria-label="Quitar">×</button>
    </div>`).join('')
}

export function updateStep1Btn() {
  document.getElementById('btn-step2').disabled = state.people.length < 2
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/people.js
git commit -m "feat: add people module"
```

---

## Task 8: Items Module

**Files:**
- Create: `src/modules/items.js`

- [ ] **Step 1: Create `src/modules/items.js`**

```js
import { state } from '../state.js'
import { escH } from '../utils.js'
import { showToast } from './ui.js'

export function addItem() {
  const nameEl = document.getElementById('item-name-input')
  const priceEl = document.getElementById('item-price-input')
  const name = nameEl.value.trim()
  const price = parseFloat(priceEl.value)
  if (!name || isNaN(price) || price <= 0) {
    showToast('Escribe nombre y precio')
    return
  }
  state.items.push({ id: Date.now(), name, price, assignees: [], aiAdded: false })
  nameEl.value = ''
  priceEl.value = ''
  nameEl.focus()
  renderItems()
  updateStep4Btn()
}

export function removeItem(id) {
  state.items = state.items.filter(i => i.id !== id)
  renderItems()
  updateStep4Btn()
}

export function toggleAssignee(itemId, personId) {
  const item = state.items.find(i => i.id === itemId)
  if (!item) return
  const idx = item.assignees.indexOf(personId)
  if (idx === -1) item.assignees.push(personId)
  else item.assignees.splice(idx, 1)
  renderItems()
}

export function renameItem(id, val) {
  const item = state.items.find(x => x.id === id)
  if (item) item.name = val.trim()
}

export function repriceItem(id, val) {
  const item = state.items.find(x => x.id === id)
  if (item && parseFloat(val) > 0) item.price = parseFloat(val)
}

export function renderItems() {
  const list = document.getElementById('items-list')
  if (state.items.length === 0) {
    list.innerHTML = '<div class="empty"><div class="empty-icon">🧾</div><div class="empty-text">Agrega el primer item</div></div>'
    return
  }
  list.innerHTML = state.items.map(item => `
    <div class="item-row ${item.aiAdded ? 'ai-added' : ''}" data-item-id="${item.id}">
      <div class="item-main">
        <div style="display:flex;align-items:center;gap:0;">
          <input class="item-name-input" value="${escH(item.name)}" type="text" maxlength="40" style="flex:1;"/>
          ${item.aiAdded ? '<span class="ai-badge">✦ IA</span>' : ''}
        </div>
        <div class="currency-input" style="position:relative;">
          <span style="position:absolute;left:8px;top:50%;transform:translateY(-50%);color:var(--ink3);font-size:12px;">$</span>
          <input class="item-price-input" value="${item.price}" type="number" min="0" style="padding-left:20px;font-size:13px;padding-top:6px;padding-bottom:6px;"/>
        </div>
        <button class="item-remove" aria-label="Eliminar">×</button>
      </div>
      <div class="item-assignees">
        ${state.people.map(p => {
          const assigned = item.assignees.includes(p.id)
          return `<button class="assignee-btn ${assigned ? 'assigned' : ''}" data-person-id="${p.id}" style="${assigned ? 'background:' + p.color + ';border-color:' + p.color : ''}">
            <span class="assignee-dot" style="background:${assigned ? 'rgba(255,255,255,0.7)' : p.color}"></span>
            ${escH(p.name)}
          </button>`
        }).join('')}
        <span style="font-size:11px;color:var(--ink3);align-self:center;margin-left:4px;">
          ${item.assignees.length === 0 ? 'sin asignar' : item.assignees.length + ' pers.'}
        </span>
      </div>
    </div>`).join('')
}

export function updateStep4Btn() {
  document.getElementById('btn-step4').disabled = state.items.length === 0
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/items.js
git commit -m "feat: add items module — uses data attributes for event delegation"
```

---

## Task 9: Scanner Module

**Files:**
- Create: `src/modules/scanner.js`

- [ ] **Step 1: Create `src/modules/scanner.js`**

```js
import { state } from '../state.js'
import { showToast, goStep } from './ui.js'
import { renderItems, updateStep4Btn } from './items.js'
import { hasScansRemaining, incrementScan } from './storage.js'
import { fmt } from '../utils.js'

export function selectMode(mode) {
  state.scanMode = mode
  document.getElementById('opt-scan').classList.toggle('active', mode === 'scan')
  document.getElementById('opt-manual').classList.toggle('active', mode === 'manual')
  document.getElementById('scan-area').style.display = mode === 'scan' ? 'block' : 'none'
  const btn = document.getElementById('btn-step3-from2')
  btn.textContent = mode === 'manual' ? 'Continuar manual →' : 'Continuar sin escanear →'
}

export function loadFile(file) {
  if (!file.type.startsWith('image/')) {
    showToast('Solo imágenes (JPG, PNG, WEBP)')
    return
  }
  if (file.size > 10 * 1024 * 1024) {
    showToast('Imagen muy grande, máx 10MB')
    return
  }
  const reader = new FileReader()
  reader.onload = (e) => {
    const dataUrl = e.target.result
    state.imageBase64 = dataUrl.split(',')[1]
    state.imageType = file.type
    const img = document.getElementById('preview-img')
    img.src = dataUrl
    img.style.display = 'block'
    document.getElementById('scan-actions').style.display = 'flex'
    document.getElementById('btn-scan').disabled = false
    document.querySelector('.drop-icon').style.display = 'none'
    document.querySelector('.drop-text').style.display = 'none'
    document.querySelector('.drop-sub').style.display = 'none'
  }
  reader.readAsDataURL(file)
}

export async function scanReceipt() {
  if (!state.imageBase64) return

  if (!hasScansRemaining()) {
    showToast('Alcanzaste el límite de 3 scans gratuitos este mes 😅', 3500)
    return
  }

  document.getElementById('scan-actions').style.display = 'none'
  document.getElementById('drop-zone').style.display = 'none'
  document.getElementById('scan-state-area').style.display = 'block'

  const msgs = [
    ['Detectando items del recibo...', 'Identificando productos y precios'],
    ['Calculando totales...', 'Buscando propina, descuentos e impuestos'],
    ['Casi listo...', 'Organizando la información']
  ]
  let mi = 0
  const interval = setInterval(() => {
    mi = (mi + 1) % msgs.length
    document.getElementById('scan-msg').textContent = msgs[mi][0]
    document.getElementById('scan-submsg').textContent = msgs[mi][1]
  }, 1800)

  try {
    const res = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: state.imageBase64, mediaType: state.imageType })
    })
    clearInterval(interval)

    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.message ?? 'Error del servidor')
    }

    const data = await res.json()
    if (data.error) throw new Error(data.message)

    incrementScan()
    applyAIResult(data)
  } catch (err) {
    clearInterval(interval)
    document.getElementById('scan-state-area').style.display = 'none'
    document.getElementById('drop-zone').style.display = 'block'
    document.getElementById('scan-actions').style.display = 'flex'
    showToast('Error al escanear. Intenta de nuevo o usa modo manual.', 3500)
    console.error(err)
  }
}

function applyAIResult(data) {
  document.getElementById('scan-state-area').style.display = 'none'

  if (data.items?.length > 0) {
    state.items = data.items.map(it => ({
      id: Date.now() + Math.random(),
      name: it.name || 'Item',
      price: parseFloat(it.price) || 0,
      assignees: [],
      aiAdded: true
    }))
    state.aiExtracted = true
  }

  if (data.tip_pct > 0) document.getElementById('tip-pct').value = data.tip_pct
  if (data.tip_fixed > 0) document.getElementById('tip-fixed').value = data.tip_fixed
  if (data.tax_pct > 0) document.getElementById('tax-pct').value = data.tax_pct
  if (data.discount > 0) document.getElementById('discount').value = data.discount

  const hasExtras = data.tip_pct > 0 || data.tip_fixed > 0 || data.tax_pct > 0 || data.discount > 0
  if (hasExtras) {
    const parts = []
    if (data.tip_pct > 0) parts.push(`propina ${data.tip_pct}%`)
    if (data.tip_fixed > 0) parts.push(`propina fija ${fmt(data.tip_fixed)}`)
    if (data.tax_pct > 0) parts.push(`impuesto ${data.tax_pct}%`)
    if (data.discount > 0) parts.push(`descuento ${fmt(data.discount)}`)
    const noteEl = document.getElementById('ai-extras-note')
    noteEl.style.display = 'block'
    noteEl.textContent = `✦ La IA detectó: ${parts.join(', ')}. Verifica que sean correctos.`
  }

  renderItems()
  updateStep4Btn()
  goStep(3)

  const summaryEl = document.getElementById('ai-detected-summary')
  summaryEl.style.display = 'block'
  summaryEl.innerHTML = `
    <div class="ai-summary">
      <div class="ai-summary-title">✦ IA detectó ${data.items.length} items · ${data.notes ?? 'Revisa y edita si algo está mal'}</div>
      ${data.subtotal > 0 ? `<div class="ai-summary-row"><span>Subtotal detectado</span><span>${fmt(data.subtotal)}</span></div>` : ''}
      ${data.total > 0 ? `<div class="ai-summary-row"><span>Total detectado</span><span>${fmt(data.total)}</span></div>` : ''}
    </div>`

  showToast(`¡${data.items.length} items detectados! Asigna quién pidió qué`, 3000)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/scanner.js
git commit -m "feat: add scanner module — calls /api/scan (never exposes API key)"
```

---

## Task 10: Share Module (TDD)

**Files:**
- Create: `tests/share.test.js`
- Create: `src/modules/share.js`

- [ ] **Step 1: Write failing tests — create `tests/share.test.js`**

```js
import { describe, it, expect } from 'vitest'
import { buildText } from '../src/modules/share.js'

describe('buildText', () => {
  it('includes each person name on its own line', () => {
    const people = [{ id: 1, name: 'Ana' }, { id: 2, name: 'Bob' }]
    const totals = { 1: 15000, 2: 20000 }
    const text = buildText(people, totals, 35000)
    const lines = text.split('\n')
    expect(lines.some(l => l.startsWith('Ana:'))).toBe(true)
    expect(lines.some(l => l.startsWith('Bob:'))).toBe(true)
  })

  it('includes grand total line', () => {
    const text = buildText([{ id: 1, name: 'Ana' }], { 1: 10000 }, 10000)
    expect(text).toMatch(/Total:/)
  })

  it('includes SplitCeipt branding', () => {
    const text = buildText([{ id: 1, name: 'Ana' }], { 1: 10000 }, 10000)
    expect(text).toContain('SplitCeipt')
  })

  it('header is the receipt emoji', () => {
    const text = buildText([{ id: 1, name: 'Ana' }], { 1: 5000 }, 5000)
    expect(text.startsWith('🧾')).toBe(true)
  })
})
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/modules/share.js'`

- [ ] **Step 3: Implement `src/modules/share.js`**

```js
import { state } from '../state.js'
import { fmt } from '../utils.js'
import { showToast } from './ui.js'

export function buildText(people, totals, grandTotal) {
  let txt = '🧾 SplitCeipt\n\n'
  people.forEach(p => { txt += `${p.name}: ${fmt(totals[p.id])}\n` })
  txt += `\nTotal: ${fmt(grandTotal)}\nHecho con SplitCeipt`
  return txt
}

export function copyText() {
  const text = buildText(state.people, state.lastTotals, state.lastGrand)
  navigator.clipboard.writeText(text)
    .then(() => showToast('¡Copiado!'))
    .catch(() => showToast('No se pudo copiar'))
}

export function shareWhatsApp() {
  const text = buildText(state.people, state.lastTotals, state.lastGrand)
  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank')
}
```

- [ ] **Step 4: Run to confirm all tests pass**

Run: `npm test`
Expected: PASS — all tests passing (storage + calculator + share)

- [ ] **Step 5: Commit**

```bash
git add tests/share.test.js src/modules/share.js
git commit -m "feat: add share module with pure buildText (TDD)"
```

---

## Task 11: CSS

**Files:**
- Create: `src/style.css`

- [ ] **Step 1: Create `src/style.css`** by extracting the entire `<style>` block from `splitceipt-v2.html` lines 10–196

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg: #F5F2EC; --surface: #FDFBF7; --surface2: #F0EDE5;
  --ink: #1A1814; --ink2: #6B6760; --ink3: #A8A49E;
  --accent: #E8450A; --accent2: #FF6B35;
  --green: #1A7A4A; --green-bg: #E8F5EE;
  --purple: #7B5CF5; --purple-bg: #F0EEFF;
  --border: rgba(26,24,20,0.1); --border2: rgba(26,24,20,0.06);
  --radius: 16px; --radius-sm: 10px;
  --shadow: 0 2px 12px rgba(26,24,20,0.08);
}
html { scroll-behavior: smooth; }
body { font-family: 'DM Sans', sans-serif; background: var(--bg); color: var(--ink); min-height: 100vh; font-size: 15px; }
body::before {
  content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 0; opacity: 0.4;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
}
.wrap { max-width: 640px; margin: 0 auto; padding: 0 16px; position: relative; z-index: 1; }

/* HEADER */
header { padding: 36px 0 28px; display: flex; align-items: center; justify-content: space-between; }
.logo { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
.logo span { color: var(--accent); }
.logo-sub { font-size: 12px; color: var(--ink3); font-weight: 400; margin-top: 1px; }

/* HERO */
.hero { padding: 8px 0 40px; }
.hero h1 { font-family: 'Syne', sans-serif; font-size: clamp(32px, 7vw, 52px); font-weight: 800; line-height: 1.08; letter-spacing: -1.5px; }
.hero h1 em { color: var(--accent); font-style: normal; }
.hero p { margin-top: 14px; font-size: 16px; color: var(--ink2); font-weight: 300; line-height: 1.6; max-width: 440px; }

/* STEPS */
.steps-nav { display: flex; margin-bottom: 32px; border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; background: var(--surface); }
.step-tab { flex: 1; padding: 14px 8px; text-align: center; font-size: 12px; font-weight: 500; color: var(--ink3); cursor: pointer; transition: all 0.2s; border-right: 1px solid var(--border); }
.step-tab:last-child { border-right: none; }
.step-tab.active { background: var(--ink); color: #fff; }
.step-tab.done { color: var(--green); }
.step-tab .step-num { display: block; font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 700; margin-bottom: 2px; }

/* PANELS */
.panel { display: none; }
.panel.visible { display: block; animation: fadeUp 0.3s ease; }
@keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }

/* CARDS */
.card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px; margin-bottom: 16px; box-shadow: var(--shadow); }
.card-title { font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink3); margin-bottom: 16px; }

/* PEOPLE */
.people-list { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; min-height: 40px; }
.person-chip { display: flex; align-items: center; gap: 6px; background: var(--surface2); border: 1px solid var(--border); border-radius: 99px; padding: 6px 12px 6px 8px; font-size: 13px; font-weight: 500; }
.person-avatar { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #fff; flex-shrink: 0; }
.person-chip .remove { background: none; border: none; cursor: pointer; color: var(--ink3); font-size: 14px; padding: 0 0 0 2px; }
.person-chip .remove:hover { color: var(--accent); }
.add-row { display: flex; gap: 8px; }

/* INPUTS */
input[type=text], input[type=number] {
  width: 100%; padding: 11px 14px; border: 1px solid var(--border);
  border-radius: var(--radius-sm); background: var(--bg);
  font-family: 'DM Sans', sans-serif; font-size: 14px; color: var(--ink);
  outline: none; transition: border-color 0.15s;
}
input:focus { border-color: var(--accent); }
input::placeholder { color: var(--ink3); }

/* BUTTONS */
.btn { display: inline-flex; align-items: center; gap: 6px; padding: 11px 20px; border-radius: var(--radius-sm); border: none; cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500; transition: all 0.15s; }
.btn-primary { background: var(--accent); color: #fff; }
.btn-primary:hover { background: var(--accent2); transform: translateY(-1px); }
.btn-secondary { background: var(--surface2); color: var(--ink); border: 1px solid var(--border); }
.btn-secondary:hover { background: var(--surface); border-color: var(--ink3); }
.btn-ghost { background: transparent; color: var(--ink2); border: 1px solid var(--border); font-size: 13px; padding: 8px 14px; }
.btn-ghost:hover { background: var(--surface2); }
.btn-ai { background: var(--purple); color: #fff; }
.btn-ai:hover { background: #6A4EE0; transform: translateY(-1px); }
.btn-full { width: 100%; justify-content: center; padding: 14px; font-size: 15px; }
.btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none !important; }

/* SCAN ZONE */
.scan-choice { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 0; }
.scan-option {
  border: 1.5px dashed var(--border); border-radius: var(--radius); padding: 24px 16px;
  text-align: center; cursor: pointer; transition: all 0.2s; background: var(--surface);
}
.scan-option:hover { border-color: var(--purple); background: var(--purple-bg); }
.scan-option.active { border-color: var(--purple); border-style: solid; background: var(--purple-bg); }
.scan-icon { font-size: 28px; margin-bottom: 8px; }
.scan-label { font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700; margin-bottom: 4px; }
.scan-desc { font-size: 12px; color: var(--ink3); line-height: 1.4; }

/* UPLOAD DROP ZONE */
.drop-zone {
  border: 1.5px dashed var(--border); border-radius: var(--radius); padding: 32px 20px;
  text-align: center; cursor: pointer; transition: all 0.2s; position: relative; overflow: hidden;
}
.drop-zone:hover, .drop-zone.dragover { border-color: var(--purple); background: var(--purple-bg); }
.drop-zone input[type=file] { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.drop-icon { font-size: 36px; margin-bottom: 10px; }
.drop-text { font-size: 14px; font-weight: 500; margin-bottom: 4px; }
.drop-sub { font-size: 12px; color: var(--ink3); }
.preview-img { width: 100%; max-height: 220px; object-fit: contain; border-radius: var(--radius-sm); margin-top: 12px; border: 1px solid var(--border); }

/* AI SCANNING STATE */
.scan-state { text-align: center; padding: 32px 20px; }
.scan-spinner { width: 48px; height: 48px; margin: 0 auto 16px; position: relative; }
.scan-spinner::before, .scan-spinner::after {
  content: ''; position: absolute; border-radius: 50%; border: 3px solid transparent;
}
.scan-spinner::before { inset: 0; border-top-color: var(--purple); animation: spin 0.9s linear infinite; }
.scan-spinner::after { inset: 6px; border-top-color: var(--accent); animation: spin 0.7s linear infinite reverse; }
@keyframes spin { to { transform: rotate(360deg); } }
.scan-msg { font-size: 14px; color: var(--ink2); }
.scan-submsg { font-size: 12px; color: var(--ink3); margin-top: 4px; }

/* ITEMS */
.items-list { display: flex; flex-direction: column; gap: 10px; }
.item-row { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); }
.item-row.ai-added { border-color: rgba(123,92,245,0.3); }
.item-main { display: grid; grid-template-columns: 1fr 90px 36px; gap: 8px; align-items: center; padding: 10px 12px; }
.item-name-input { border: none; background: transparent; padding: 0; font-size: 14px; font-weight: 500; color: var(--ink); }
.item-name-input:focus { outline: none; color: var(--accent); }
.item-price-input { border: 1px solid var(--border2); background: var(--bg); border-radius: 8px; text-align: right; padding: 7px 10px; font-size: 14px; }
.item-remove { background: none; border: none; cursor: pointer; color: var(--ink3); font-size: 18px; width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
.item-remove:hover { background: var(--surface2); color: var(--accent); }
.item-assignees { padding: 8px 12px 10px; border-top: 1px solid var(--border2); display: flex; flex-wrap: wrap; gap: 6px; }
.assignee-btn { padding: 4px 10px; border-radius: 99px; border: 1px solid var(--border); background: var(--bg); font-size: 12px; cursor: pointer; transition: all 0.15s; display: flex; align-items: center; gap: 4px; color: var(--ink2); }
.assignee-btn.assigned { border-color: transparent; color: #fff; font-weight: 500; }
.assignee-dot { width: 8px; height: 8px; border-radius: 50%; }
.ai-badge { display: inline-flex; align-items: center; gap: 3px; font-size: 10px; background: var(--purple-bg); color: var(--purple); border-radius: 6px; padding: 2px 6px; margin-left: 6px; font-weight: 600; }
.add-item-row { display: grid; grid-template-columns: 1fr 90px auto; gap: 8px; align-items: center; margin-top: 12px; }

/* EXTRAS */
.extras-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.extra-field label { display: block; font-size: 12px; color: var(--ink3); margin-bottom: 5px; font-weight: 500; }
.currency-input { position: relative; }
.currency-input span { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--ink3); font-size: 13px; }
.currency-input input { padding-left: 24px; }

/* RESULT */
.result-header { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
.result-icon { width: 44px; height: 44px; background: var(--green-bg); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px; }
.result-title { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; }
.result-sub { font-size: 13px; color: var(--ink2); }
.person-result { border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; margin-bottom: 10px; }
.person-result-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; cursor: pointer; }
.person-result-left { display: flex; align-items: center; gap: 10px; }
.person-result-name { font-weight: 500; font-size: 15px; }
.person-total { font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 700; }
.person-result-items { padding: 0 16px 12px; border-top: 1px solid var(--border2); display: none; }
.result-item-line { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; color: var(--ink2); border-bottom: 1px solid var(--border2); }
.result-item-line:last-child { border-bottom: none; }
.result-item-amount { font-weight: 500; color: var(--ink); }
.total-bar { background: var(--ink); color: #fff; border-radius: var(--radius-sm); padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; margin-top: 16px; }
.total-bar-label { font-size: 13px; opacity: 0.7; }
.total-bar-amount { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 700; }
.share-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 16px; }

/* MISC */
.empty { text-align: center; padding: 28px; color: var(--ink3); }
.empty-icon { font-size: 32px; margin-bottom: 8px; }
.empty-text { font-size: 13px; }
.bottom-nav { display: flex; gap: 8px; margin-top: 24px; padding-bottom: 48px; }
.tag { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; }
.tag-green { background: var(--green-bg); color: var(--green); }
.tag-purple { background: var(--purple-bg); color: var(--purple); }
.toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%) translateY(80px); background: var(--ink); color: #fff; padding: 12px 20px; border-radius: 99px; font-size: 13px; font-weight: 500; z-index: 1000; transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1); pointer-events: none; white-space: nowrap; }
.toast.show { transform: translateX(-50%) translateY(0); }
.info-box { background: var(--purple-bg); border: 1px solid rgba(123,92,245,0.2); border-radius: var(--radius-sm); padding: 12px 16px; font-size: 12px; color: #5A3ECC; line-height: 1.5; margin-bottom: 16px; }
.warn-box { background: #FEF9F0; border: 1px solid #F5D49A; border-radius: var(--radius-sm); padding: 12px 16px; font-size: 12px; color: #8A6A1A; line-height: 1.5; margin-bottom: 16px; }
hr.divider { border: none; border-top: 1px solid var(--border2); margin: 14px 0; }

/* AI DETECTED SUMMARY */
.ai-summary { background: var(--purple-bg); border: 1px solid rgba(123,92,245,0.25); border-radius: var(--radius-sm); padding: 14px 16px; margin-bottom: 14px; }
.ai-summary-title { font-size: 12px; font-weight: 600; color: var(--purple); margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
.ai-summary-row { display: flex; justify-content: space-between; font-size: 13px; padding: 3px 0; }
.ai-summary-row span:last-child { font-weight: 500; }

@media (max-width: 480px) {
  .scan-choice { grid-template-columns: 1fr; }
  .extras-grid { grid-template-columns: 1fr; }
  .share-grid { grid-template-columns: 1fr; }
  .add-item-row { grid-template-columns: 1fr 80px auto; }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/style.css
git commit -m "feat: extract CSS into src/style.css"
```

---

## Task 12: HTML Entry Point

**Files:**
- Create: `src/index.html`

- [ ] **Step 1: Create `src/index.html`**

All `onclick`, `onkeydown`, `oninput`, `ondragover`, `ondragleave`, `ondrop` handlers removed. Event wiring happens in `main.js`.

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>SplitCeipt — Divide el recibo sin dramas</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet"/>
  <link rel="stylesheet" href="./style.css"/>
  <link rel="manifest" href="/manifest.json"/>
  <meta name="theme-color" content="#E8450A"/>
</head>
<body>
<div class="wrap">
  <header>
    <div>
      <div class="logo">Split<span>Ceipt</span></div>
      <div class="logo-sub">divide sin dramas</div>
    </div>
    <span class="tag tag-green">✓ Sin registro</span>
  </header>

  <section class="hero">
    <h1>El recibo.<br/><em>Dividido.</em><br/>En segundos.</h1>
    <p>Toma foto del recibo, la IA extrae todo automáticamente — o ingrésalo manual. Tú solo dices quién pidió qué.</p>
  </section>

  <div class="steps-nav">
    <div class="step-tab active" id="tab-1"><span class="step-num">1</span>Personas</div>
    <div class="step-tab" id="tab-2"><span class="step-num">2</span>Recibo</div>
    <div class="step-tab" id="tab-3"><span class="step-num">3</span>Items</div>
    <div class="step-tab" id="tab-4"><span class="step-num">4</span>Extras</div>
    <div class="step-tab" id="tab-5"><span class="step-num">5</span>Resultado</div>
  </div>

  <!-- STEP 1: PERSONAS -->
  <div class="panel visible" id="panel-1">
    <div class="card">
      <div class="card-title">¿Quiénes van a dividir?</div>
      <div class="people-list" id="people-list"></div>
      <div class="add-row">
        <input type="text" id="person-input" placeholder="Nombre (ej. Dilan, Jessi, Carlos...)" maxlength="20"/>
        <button class="btn btn-primary" id="btn-add-person">+ Agregar</button>
      </div>
    </div>
    <div class="bottom-nav">
      <button class="btn btn-primary btn-full" id="btn-step2" disabled>Continuar →</button>
    </div>
  </div>

  <!-- STEP 2: RECIBO -->
  <div class="panel" id="panel-2">
    <div class="card">
      <div class="card-title">¿Cómo quieres ingresar el recibo?</div>
      <div class="scan-choice">
        <div class="scan-option" id="opt-scan">
          <div class="scan-icon">📸</div>
          <div class="scan-label">Escanear recibo</div>
          <div class="scan-desc">Toma foto o sube imagen — la IA extrae los items automáticamente</div>
        </div>
        <div class="scan-option" id="opt-manual">
          <div class="scan-icon">✏️</div>
          <div class="scan-label">Ingresar manual</div>
          <div class="scan-desc">Escribe los items y precios uno por uno</div>
        </div>
      </div>
      <div id="scan-area" style="display:none; margin-top:16px;">
        <div class="info-box">La IA detectará items, precios, propina, impuestos y descuentos del recibo. Puedes editar todo después.</div>
        <div class="drop-zone" id="drop-zone">
          <input type="file" id="file-input" accept="image/*" capture="environment"/>
          <div class="drop-icon">🧾</div>
          <div class="drop-text">Toca para tomar foto o subir imagen</div>
          <div class="drop-sub">JPG, PNG, WEBP · máx 10MB</div>
          <img id="preview-img" class="preview-img" style="display:none;" alt=""/>
        </div>
        <div id="scan-state-area" style="display:none;">
          <div class="scan-state">
            <div class="scan-spinner"></div>
            <div class="scan-msg" id="scan-msg">Analizando recibo...</div>
            <div class="scan-submsg" id="scan-submsg">La IA está leyendo los items y precios</div>
          </div>
        </div>
        <div style="margin-top:12px;display:flex;gap:8px;" id="scan-actions">
          <button class="btn btn-ai btn-full" id="btn-scan" disabled>✦ Extraer con IA</button>
        </div>
      </div>
    </div>
    <div class="bottom-nav">
      <button class="btn btn-secondary" id="btn-back-to-1">← Atrás</button>
      <button class="btn btn-primary" style="flex:1;justify-content:center;" id="btn-step3-from2">Continuar manual →</button>
    </div>
  </div>

  <!-- STEP 3: ITEMS -->
  <div class="panel" id="panel-3">
    <div class="card">
      <div class="card-title">Items del recibo</div>
      <div id="ai-detected-summary" style="display:none;"></div>
      <div class="warn-box" id="items-hint">Selecciona quién pidió cada item. Si fue compartido, selecciona a todos — se divide automáticamente.</div>
      <div class="items-list" id="items-list">
        <div class="empty"><div class="empty-icon">🧾</div><div class="empty-text">Agrega el primer item</div></div>
      </div>
      <div class="add-item-row">
        <input type="text" id="item-name-input" placeholder="Nombre del item" maxlength="40"/>
        <div class="currency-input">
          <span>$</span>
          <input type="number" id="item-price-input" class="item-price-input" placeholder="0" min="0" step="100"/>
        </div>
        <button class="btn btn-primary" id="btn-add-item">+</button>
      </div>
    </div>
    <div class="bottom-nav">
      <button class="btn btn-secondary" id="btn-back-to-2">← Atrás</button>
      <button class="btn btn-primary" style="flex:1;justify-content:center;" id="btn-step4" disabled>Continuar →</button>
    </div>
  </div>

  <!-- STEP 4: EXTRAS -->
  <div class="panel" id="panel-4">
    <div class="card">
      <div class="card-title">Extras</div>
      <div id="ai-extras-note" style="display:none;" class="info-box"></div>
      <div class="extras-grid">
        <div class="extra-field">
          <label>Propina %</label>
          <input type="number" id="tip-pct" placeholder="0" min="0" max="100" value="0"/>
        </div>
        <div class="extra-field">
          <label>Propina fija $</label>
          <div class="currency-input"><span>$</span>
            <input type="number" id="tip-fixed" placeholder="0" min="0" value="0"/>
          </div>
        </div>
        <div class="extra-field">
          <label>Descuento $</label>
          <div class="currency-input"><span>$</span>
            <input type="number" id="discount" placeholder="0" min="0" value="0"/>
          </div>
        </div>
        <div class="extra-field">
          <label>Impuesto %</label>
          <input type="number" id="tax-pct" placeholder="0" min="0" max="50" value="0"/>
        </div>
      </div>
      <hr class="divider"/>
      <div id="extras-preview" style="font-size:13px;color:var(--ink2);"></div>
    </div>
    <div class="bottom-nav">
      <button class="btn btn-secondary" id="btn-back-to-3">← Atrás</button>
      <button class="btn btn-primary" style="flex:1;justify-content:center;" id="btn-calculate">Ver resultado →</button>
    </div>
  </div>

  <!-- STEP 5: RESULTADO -->
  <div class="panel" id="panel-5">
    <div id="result-content"></div>
    <div style="display:flex;gap:8px;margin-top:8px;padding-bottom:48px;">
      <button class="btn btn-secondary" style="flex:1;justify-content:center;" id="btn-edit-result">← Editar</button>
      <button class="btn btn-ghost" style="flex:1;justify-content:center;" id="btn-reset">Nueva división</button>
    </div>
  </div>
</div>

<div class="toast" id="toast"></div>
<script type="module" src="./main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add src/index.html
git commit -m "feat: add src/index.html — clean entry point, no inline handlers"
```

---

## Task 13: Main Wiring

**Files:**
- Create: `src/main.js`

- [ ] **Step 1: Create `src/main.js`**

```js
import { state } from './state.js'
import { showToast, goStep } from './modules/ui.js'
import { addPerson, removePerson, renderPeople, updateStep1Btn } from './modules/people.js'
import { addItem, removeItem, toggleAssignee, renameItem, repriceItem, renderItems, updateStep4Btn } from './modules/items.js'
import { selectMode, loadFile, scanReceipt } from './modules/scanner.js'
import { calculate, updateExtrasPreview } from './modules/calculator.js'
import { copyText, shareWhatsApp } from './modules/share.js'

// ── STEP NAVIGATION ──
document.querySelectorAll('.step-tab').forEach((tab, i) => {
  tab.addEventListener('click', () => {
    const n = i + 1
    if (n === 5) {
      calculate()
    } else {
      const moved = goStep(n)
      if (moved && n === 4) updateExtrasPreview()
    }
  })
})

document.getElementById('btn-step2').addEventListener('click', () => goStep(2))
document.getElementById('btn-back-to-1').addEventListener('click', () => goStep(1))
document.getElementById('btn-step3-from2').addEventListener('click', () => goStep(3))
document.getElementById('btn-back-to-2').addEventListener('click', () => goStep(2))
document.getElementById('btn-step4').addEventListener('click', () => {
  if (goStep(4)) updateExtrasPreview()
})
document.getElementById('btn-back-to-3').addEventListener('click', () => goStep(3))
document.getElementById('btn-calculate').addEventListener('click', calculate)
document.getElementById('btn-edit-result').addEventListener('click', () => goStep(3))
document.getElementById('btn-reset').addEventListener('click', resetAll)

// ── PEOPLE ──
document.getElementById('btn-add-person').addEventListener('click', addPerson)
document.getElementById('person-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') addPerson()
})
document.getElementById('people-list').addEventListener('click', e => {
  const chip = e.target.closest('.person-chip')
  if (e.target.closest('.remove') && chip) {
    removePerson(Number(chip.dataset.personId))
  }
})

// ── ITEMS ──
document.getElementById('btn-add-item').addEventListener('click', addItem)
document.getElementById('item-name-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('item-price-input').focus()
})
document.getElementById('item-price-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') addItem()
})
document.getElementById('items-list').addEventListener('click', e => {
  const row = e.target.closest('.item-row')
  if (!row) return
  const itemId = Number(row.dataset.itemId)
  if (e.target.closest('.item-remove')) {
    removeItem(itemId)
    return
  }
  const btn = e.target.closest('.assignee-btn')
  if (btn) toggleAssignee(itemId, Number(btn.dataset.personId))
})
document.getElementById('items-list').addEventListener('change', e => {
  const row = e.target.closest('.item-row')
  if (!row) return
  const itemId = Number(row.dataset.itemId)
  if (e.target.classList.contains('item-name-input')) renameItem(itemId, e.target.value)
  if (e.target.classList.contains('item-price-input')) repriceItem(itemId, e.target.value)
})

// ── SCANNER ──
document.getElementById('opt-scan').addEventListener('click', () => selectMode('scan'))
document.getElementById('opt-manual').addEventListener('click', () => selectMode('manual'))
document.getElementById('file-input').addEventListener('change', e => {
  if (e.target.files[0]) loadFile(e.target.files[0])
})
const dropZone = document.getElementById('drop-zone')
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover') })
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'))
dropZone.addEventListener('drop', e => {
  e.preventDefault()
  dropZone.classList.remove('dragover')
  if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0])
})
document.getElementById('btn-scan').addEventListener('click', scanReceipt)

// ── EXTRAS ──
;['tip-pct', 'tip-fixed', 'discount', 'tax-pct'].forEach(id => {
  document.getElementById(id).addEventListener('input', updateExtrasPreview)
})

// ── RESULT (event delegation — buttons rendered by calculate()) ──
document.getElementById('result-content').addEventListener('click', e => {
  if (e.target.closest('#btn-copy')) copyText()
  if (e.target.closest('#btn-whatsapp')) shareWhatsApp()
  const header = e.target.closest('.person-result-header')
  if (header) {
    const breakdown = header.nextElementSibling
    breakdown.style.display = breakdown.style.display === 'block' ? 'none' : 'block'
  }
})

// ── RESET ──
function resetAll() {
  if (!confirm('¿Nueva división? Se borrará todo.')) return
  state.people = []
  state.items = []
  state.scanMode = null
  state.imageBase64 = null
  state.imageType = null
  state.aiExtracted = false
  state.lastTotals = {}
  state.lastGrand = 0

  renderPeople()
  renderItems()
  ;['tip-pct', 'tip-fixed', 'discount', 'tax-pct'].forEach(id => {
    document.getElementById(id).value = 0
  })
  document.getElementById('extras-preview').innerHTML = ''
  document.getElementById('ai-detected-summary').style.display = 'none'
  document.getElementById('ai-extras-note').style.display = 'none'
  document.getElementById('scan-area').style.display = 'none'
  document.getElementById('scan-state-area').style.display = 'none'
  document.getElementById('drop-zone').style.display = 'block'
  document.getElementById('preview-img').style.display = 'none'
  document.querySelector('.drop-icon').style.display = 'block'
  document.querySelector('.drop-text').style.display = 'block'
  document.querySelector('.drop-sub').style.display = 'block'
  document.getElementById('opt-scan').classList.remove('active')
  document.getElementById('opt-manual').classList.remove('active')
  document.getElementById('btn-scan').disabled = true
  updateStep1Btn()
  goStep(1)
}

// ── INIT ──
renderPeople()
renderItems()
document.getElementById('person-input').focus()
```

- [ ] **Step 2: Run tests to confirm nothing regressed**

Run: `npm test`
Expected: PASS — all tests still passing

- [ ] **Step 3: Commit**

```bash
git add src/main.js
git commit -m "feat: add main.js — wire all event listeners, complete app integration"
```

---

## Task 14: PWA + Dev Verification

**Files:**
- Create: `public/manifest.json`
- Create: `public/sw.js`

- [ ] **Step 1: Create `public/manifest.json`**

```json
{
  "name": "SplitCeipt",
  "short_name": "SplitCeipt",
  "description": "Divide el recibo sin dramas",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#F5F2EC",
  "theme_color": "#E8450A",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

- [ ] **Step 2: Create `public/sw.js`**

```js
const CACHE = 'splitceipt-v1'
const STATIC = ['/', '/style.css', '/main.js']

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).catch(() => {})
  )
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  if (e.request.url.includes('/api/')) return
  e.respondWith(
    caches.match(e.request).then(cached => cached ?? fetch(e.request))
  )
})
```

- [ ] **Step 3: Register service worker in `src/main.js`**

Add this block at the very bottom of `src/main.js`, after the `// ── INIT ──` section:

```js
// ── SERVICE WORKER ──
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}
```

- [ ] **Step 4: Run the dev server and verify the app**

Run: `npm run dev`
Expected: Vite dev server starts at `http://localhost:5173`

Open the browser and verify:
1. **Step 1 — Personas:** Add 2+ people, "Continuar →" enables, removing works
2. **Step 2 — Recibo:** Both scan/manual options highlight on click, manual continues to step 3
3. **Step 3 — Items:** Add items with name + price, assign people via colored buttons, "Continuar →" enables when items exist
4. **Step 4 — Extras:** Propina/impuesto/descuento update the preview totals in real time
5. **Step 5 — Resultado:** Totals display correctly per person, accordion toggles, "Copiar resumen" copies plain text, "WhatsApp" opens wa.me link
6. **"Nueva división"** resets everything back to step 1
7. Step tabs at the top navigate between completed steps

- [ ] **Step 5: Run final test suite**

Run: `npm test`
Expected: PASS — all tests passing

- [ ] **Step 6: Commit**

```bash
git add public/manifest.json public/sw.js src/main.js
git commit -m "feat: add PWA manifest, service worker, complete project scaffold"
```

---

## Post-Migration Checklist

Before deploying to Vercel:

- [ ] Copy `.env.example` to `.env`, fill in `ANTHROPIC_API_KEY`
- [ ] Run `vercel dev` to test full-stack (AI scan requires this)
- [ ] Add `ANTHROPIC_API_KEY` to Vercel dashboard: Settings → Environment Variables
- [ ] Run `vercel --prod` to deploy
- [ ] Add PNG icons at `public/icon-192.png` and `public/icon-512.png` (orange background, white "S", Syne font)
- [ ] Verify AI scan works end-to-end on the deployed URL

---

## Scope: What This Plan Does NOT Include

The following are in the CLAUDE.md roadmap but deliberately out of scope for this migration (v1.1+):

- Upgrade modal when scan limit is reached (storage module has the gate, modal is wired in scanner.js as a toast for now)
- Wompi payment integration
- AdSense banner
- Historial de divisiones
- Capacitor.js Play Store build
