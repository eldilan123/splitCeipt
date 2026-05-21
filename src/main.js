import { state } from './state.js'
import { goStep } from './modules/ui.js'
import { addPerson, removePerson, renderPeople, updateStep1Btn } from './modules/people.js'
import { addItem, removeItem, toggleAssignee, renameItem, repriceItem, renderItems } from './modules/items.js'
import { selectMode, loadFile, scanReceipt } from './modules/scanner.js'
import { calculate, updateExtrasPreview } from './modules/calculator.js'
import { copyText, shareWhatsApp } from './modules/share.js'

// ── STEP NAVIGATION ──
document.querySelectorAll('.step-tab').forEach((tab, i) => {
  tab.addEventListener('click', () => {
    const n = i + 1
    if (n === 5) return  // never navigate to result via tab
    if (n === 4) {
      const moved = goStep(n)
      if (moved) updateExtrasPreview()
      return
    }
    goStep(n)
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

// ── SERVICE WORKER ──
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}
