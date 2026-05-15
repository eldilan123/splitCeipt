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
    localStorage.setItem('sc_scans', JSON.stringify({ count: 3, resetDate: '2025-01' }))
    expect(getScanData().count).toBe(0)
    expect(hasScansRemaining()).toBe(true)
  })
})
