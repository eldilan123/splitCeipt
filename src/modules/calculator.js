import { state } from '../state.js'
import { fmt, escH } from '../utils.js'
import { showToast, goStep } from './ui.js'
import { encodeResultToURL } from './sharelink.js'

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
    showToast(`Asigna quién pidió "${unassigned[0].name}" primero`)
    document.querySelectorAll('.item-row').forEach(row => {
      const itemId = Number(row.dataset.itemId)
      const item = state.items.find(i => i.id === itemId)
      if (item && item.assignees.length === 0) {
        row.style.border = '2px solid var(--accent)'
        row.style.boxShadow = '0 0 0 3px rgba(232,69,10,0.15)'
        setTimeout(() => {
          row.style.border = ''
          row.style.boxShadow = ''
        }, 3000)
      }
    })
    goStep(3)
    return
  }

  const { totals, breakdown, grandTotal } = computeTotals(state.people, state.items, getExtras())
  state.lastTotals = totals
  state.lastGrand = grandTotal
  state.lastBreakdown = breakdown
  state.lastShareURL = encodeResultToURL(state.people, state.items, totals, grandTotal, getExtras())
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
      <div><div class="total-bar-label">Total · COP</div></div>
      <div class="total-bar-amount">${fmt(grandTotal)}</div>
    </div>
    <div class="share-grid-2x2">
      <button class="btn btn-secondary" id="btn-copy">📋 Copiar texto</button>
      <button class="btn btn-secondary" id="btn-whatsapp">💬 WhatsApp</button>
      <button class="btn btn-secondary" id="btn-share-link">🔗 Copiar link</button>
      <button class="btn btn-ai" id="btn-share-image">📸 Guardar imagen</button>
    </div>`

  window.scrollTo({ top: 0, behavior: 'smooth' })
}
