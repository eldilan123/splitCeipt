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
      const reset = { count: 0, resetDate: getCurrentMonth() }
      localStorage.setItem(SCAN_KEY, JSON.stringify(reset))
      return reset
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
