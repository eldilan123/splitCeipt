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
