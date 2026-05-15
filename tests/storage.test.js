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
    // any past month that cannot equal the current month
    localStorage.setItem('sc_scans', JSON.stringify({ count: 3, resetDate: '2025-01' }))
    expect(getScanData().count).toBe(0)
    expect(hasScansRemaining()).toBe(true)
  })

  it('persists the reset to localStorage when month changes', () => {
    localStorage.setItem('sc_scans', JSON.stringify({ count: 3, resetDate: '2025-01' }))
    getScanData()
    const stored = JSON.parse(localStorage.getItem('sc_scans'))
    expect(stored.count).toBe(0)
  })

  it('returns safe defaults when localStorage contains corrupt data', () => {
    localStorage.setItem('sc_scans', 'not-valid-json')
    expect(getScanData().count).toBe(0)
    expect(hasScansRemaining()).toBe(true)
  })
})
