export function encodeResultToURL(people, items, totals, grandTotal, extras) {
  const payload = {
    v: 1,
    p: people.map(p => ({ n: p.name, c: p.color })),
    i: items.map(it => ({
      n: it.name,
      p: it.price,
      a: it.assignees.map(aid => people.findIndex(p => p.id === aid))
    })),
    t: {
      tipPct: extras.tipPct,
      tipFixed: extras.tipFixed,
      discount: extras.discount,
      taxPct: extras.taxPct
    }
  }
  const json = JSON.stringify(payload)
  const b64 = btoa(unescape(encodeURIComponent(json)))
  return `${window.location.origin}?r=${b64}`
}

export function decodeResultFromURL() {
  try {
    const params = new URLSearchParams(window.location.search)
    const r = params.get('r')
    if (!r) return null
    const json = decodeURIComponent(escape(atob(r)))
    const payload = JSON.parse(json)
    if (!payload.v || !payload.p || !payload.i) return null
    return payload
  } catch {
    return null
  }
}

export function restoreFromPayload(payload, state) {
  state.people = payload.p.map((p, idx) => ({
    id: idx + 1,
    name: p.n,
    color: p.c
  }))
  state.items = payload.i.map((it, idx) => ({
    id: idx + 100,
    name: it.n,
    price: it.p,
    assignees: it.a.map(pIdx => pIdx + 1),
    aiAdded: false
  }))
  return payload.t
}
