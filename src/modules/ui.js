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
  if (n > 1) {
    document.querySelector('.wrap').classList.add('hero-hidden')
  } else {
    document.querySelector('.wrap').classList.remove('hero-hidden')
  }
  window.scrollTo({ top: 0, behavior: 'smooth' })
  return true
}
