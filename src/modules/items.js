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
