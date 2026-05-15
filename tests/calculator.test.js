import { describe, it, expect } from 'vitest'
import { computeTotals } from '../src/modules/calculator.js'

const people = (ids) => ids.map(id => ({ id, name: `P${id}` }))

describe('computeTotals', () => {
  it('splits an item evenly between two people', () => {
    const { totals, grandTotal } = computeTotals(
      people([1, 2]),
      [{ id: 10, name: 'Pizza', price: 30000, assignees: [1, 2] }],
      { tipPct: 0, tipFixed: 0, discount: 0, taxPct: 0 }
    )
    expect(totals[1]).toBe(15000)
    expect(totals[2]).toBe(15000)
    expect(grandTotal).toBe(30000)
  })

  it('assigns the full item to one person', () => {
    const { totals } = computeTotals(
      people([1, 2]),
      [
        { id: 10, name: 'Burger', price: 20000, assignees: [1] },
        { id: 11, name: 'Salad', price: 15000, assignees: [2] }
      ],
      { tipPct: 0, tipFixed: 0, discount: 0, taxPct: 0 }
    )
    expect(totals[1]).toBe(20000)
    expect(totals[2]).toBe(15000)
  })

  it('applies tip percentage proportionally', () => {
    const { totals } = computeTotals(
      people([1]),
      [{ id: 10, name: 'Burger', price: 20000, assignees: [1] }],
      { tipPct: 10, tipFixed: 0, discount: 0, taxPct: 0 }
    )
    expect(totals[1]).toBeCloseTo(22000)
  })

  it('applies fixed tip to grand total', () => {
    const { grandTotal } = computeTotals(
      people([1, 2]),
      [{ id: 10, name: 'Pizza', price: 20000, assignees: [1, 2] }],
      { tipPct: 0, tipFixed: 4000, discount: 0, taxPct: 0 }
    )
    expect(grandTotal).toBe(24000)
  })

  it('subtracts discount from total', () => {
    const { totals } = computeTotals(
      people([1]),
      [{ id: 10, name: 'Burger', price: 20000, assignees: [1] }],
      { tipPct: 0, tipFixed: 0, discount: 5000, taxPct: 0 }
    )
    expect(totals[1]).toBe(15000)
  })

  it('applies tax percentage', () => {
    const { totals } = computeTotals(
      people([1]),
      [{ id: 10, name: 'Burger', price: 20000, assignees: [1] }],
      { tipPct: 0, tipFixed: 0, discount: 0, taxPct: 8 }
    )
    expect(totals[1]).toBeCloseTo(21600)
  })

  it('includes breakdown with item name and adjusted amount', () => {
    const { breakdown } = computeTotals(
      people([1]),
      [{ id: 10, name: 'Pizza', price: 30000, assignees: [1] }],
      { tipPct: 0, tipFixed: 0, discount: 0, taxPct: 0 }
    )
    expect(breakdown[1]).toHaveLength(1)
    expect(breakdown[1][0].name).toBe('Pizza')
    expect(breakdown[1][0].adjusted).toBe(30000)
  })

  it('returns zero totals for empty items list', () => {
    const { grandTotal } = computeTotals(
      people([1, 2]),
      [],
      { tipPct: 10, tipFixed: 0, discount: 0, taxPct: 0 }
    )
    expect(grandTotal).toBe(0)
  })
})
