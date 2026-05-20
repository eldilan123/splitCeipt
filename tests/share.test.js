import { describe, it, expect } from 'vitest'
import { buildText } from '../src/modules/share.js'

describe('buildText', () => {
  it('includes each person name on its own line', () => {
    const people = [{ id: 1, name: 'Ana' }, { id: 2, name: 'Bob' }]
    const totals = { 1: 15000, 2: 20000 }
    const text = buildText(people, totals, 35000)
    const lines = text.split('\n')
    expect(lines.some(l => l.startsWith('Ana:'))).toBe(true)
    expect(lines.some(l => l.startsWith('Bob:'))).toBe(true)
  })

  it('includes grand total line', () => {
    const text = buildText([{ id: 1, name: 'Ana' }], { 1: 10000 }, 10000)
    expect(text).toMatch(/Total:/)
  })

  it('includes SplitCeipt branding', () => {
    const text = buildText([{ id: 1, name: 'Ana' }], { 1: 10000 }, 10000)
    expect(text).toContain('SplitCeipt')
  })

  it('header is the receipt emoji', () => {
    const text = buildText([{ id: 1, name: 'Ana' }], { 1: 5000 }, 5000)
    expect(text.startsWith('🧾')).toBe(true)
  })
})
