import { describe, it, expect } from 'vitest'
import { encodeResultToURL, decodeResultFromURL, restoreFromPayload } from '../src/modules/sharelink.js'

const mockPeople = [
  { id: 1, name: 'Dilan', color: '#E8450A' },
  { id: 2, name: 'Jessi', color: '#1A7A4A' }
]
const mockItems = [
  { id: 10, name: 'Pizza', price: 30000, assignees: [1, 2] },
  { id: 11, name: 'Jugo', price: 8000, assignees: [1] }
]
const mockTotals = { 1: 23000, 2: 15000 }
const mockExtras = { tipPct: 10, tipFixed: 0, discount: 0, taxPct: 0 }

describe('sharelink', () => {
  it('encodes result to a valid URL', () => {
    const url = encodeResultToURL(mockPeople, mockItems, mockTotals, 38000, mockExtras)
    expect(url).toContain('?r=')
    expect(url).toContain('splitceipt')
  })

  it('decoded payload has correct number of people', () => {
    const url = encodeResultToURL(mockPeople, mockItems, mockTotals, 38000, mockExtras)
    const r = new URL(url).searchParams.get('r')
    const json = decodeURIComponent(escape(atob(r)))
    const payload = JSON.parse(json)
    expect(payload.p).toHaveLength(2)
    expect(payload.p[0].n).toBe('Dilan')
  })

  it('decoded payload has correct number of items', () => {
    const url = encodeResultToURL(mockPeople, mockItems, mockTotals, 38000, mockExtras)
    const r = new URL(url).searchParams.get('r')
    const json = decodeURIComponent(escape(atob(r)))
    const payload = JSON.parse(json)
    expect(payload.i).toHaveLength(2)
    expect(payload.i[0].n).toBe('Pizza')
  })

  it('decodeResultFromURL returns null when no param', () => {
    const result = decodeResultFromURL()
    expect(result).toBeNull()
  })

  it('restoreFromPayload rebuilds people correctly', () => {
    const url = encodeResultToURL(mockPeople, mockItems, mockTotals, 38000, mockExtras)
    const r = new URL(url).searchParams.get('r')
    const json = decodeURIComponent(escape(atob(r)))
    const payload = JSON.parse(json)
    const mockState = { people: [], items: [] }
    restoreFromPayload(payload, mockState)
    expect(mockState.people).toHaveLength(2)
    expect(mockState.people[0].name).toBe('Dilan')
    expect(mockState.items).toHaveLength(2)
  })

  it('extras are preserved through encode/decode', () => {
    const url = encodeResultToURL(mockPeople, mockItems, mockTotals, 38000, mockExtras)
    const r = new URL(url).searchParams.get('r')
    const json = decodeURIComponent(escape(atob(r)))
    const payload = JSON.parse(json)
    expect(payload.t.tipPct).toBe(10)
  })
})
