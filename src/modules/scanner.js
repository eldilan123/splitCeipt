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

    const itemCount = data.items?.length ?? 0
    if (itemCount === 0) {
      document.getElementById('scan-state-area').style.display = 'none'
      document.getElementById('drop-zone').style.display = 'block'
      document.getElementById('scan-actions').style.display = 'flex'
      showToast(data.notes ?? 'No se detectaron items. Intenta con modo manual.', 3500)
      return
    }

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

  const itemCount = state.items.length
  const summaryEl = document.getElementById('ai-detected-summary')
  summaryEl.style.display = 'block'
  summaryEl.innerHTML = `
    <div class="ai-summary">
      <div class="ai-summary-title">✦ IA detectó ${itemCount} items · ${data.notes ?? 'Revisa y edita si algo está mal'}</div>
      ${data.subtotal > 0 ? `<div class="ai-summary-row"><span>Subtotal detectado</span><span>${fmt(data.subtotal)}</span></div>` : ''}
      ${data.total > 0 ? `<div class="ai-summary-row"><span>Total detectado</span><span>${fmt(data.total)}</span></div>` : ''}
    </div>`

  showToast(`¡${itemCount} items detectados! Asigna quién pidió qué`, 3000)
}
