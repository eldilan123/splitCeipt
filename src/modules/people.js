import { state } from '../state.js'
import { escH, getColor } from '../utils.js'
import { showToast } from './ui.js'
import { renderItems } from './items.js'

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
  renderItems()
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
