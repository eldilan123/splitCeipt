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
