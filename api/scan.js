// Pass 2: deterministic math so the AI never miscalculates prices.
// The AI (Pass 1) copies raw numbers from the receipt columns verbatim.
// This function does all division — precio_unitario = valor / cantidad.
function expandRows(rows) {
  const items = []
  for (const row of rows) {
    const cantidad = Math.max(1, parseInt(row.cantidad) || 1)
    const valor = parseFloat(row.valor) || 0
    const esTotal = row.valor_es_total === true
    const precioUnitario = esTotal
      ? Math.round(valor / cantidad)
      : valor
    for (let i = 0; i < cantidad; i++) {
      items.push({ name: row.name, price: precioUnitario })
    }
  }
  return items
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') {
    return res.status(405).json({ error: true, message: 'Method not allowed' })
  }

  const ALLOWED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  const MAX_IMAGE_B64_LENGTH = 14_000_000 // ~10 MB base64

  const { image, mediaType } = req.body ?? {}
  if (!image || !mediaType) {
    return res.status(400).json({ error: true, message: 'image y mediaType son requeridos' })
  }
  if (!ALLOWED_MEDIA_TYPES.includes(mediaType)) {
    return res.status(400).json({ error: true, message: 'Tipo de imagen no soportado. Usa JPG, PNG, WEBP o GIF.' })
  }
  if (image.length > MAX_IMAGE_B64_LENGTH) {
    return res.status(400).json({ error: true, message: 'Imagen muy grande. Máximo 10MB.' })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: true, message: 'API key no configurada en el servidor' })
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: image }
            },
            {
              type: 'text',
              // PROMPT MAINTENANCE: Pass 1 — AI reads raw receipt columns verbatim,
              // no math. Pass 2 (expandRows in JS) does all price calculation.
              // The AI must NOT divide, multiply, or modify any number it reads.
              // "valor_es_total" tells expandRows whether to divide by cantidad.
              text: `Analiza este recibo/cuenta de restaurante y extrae TODA la información.
Responde SOLO con JSON válido, sin markdown, sin texto extra, exactamente así:
{
  "rows": [
    {"name": "Bandeja Paisa", "cantidad": 1, "valor": 32000, "valor_es_total": true},
    {"name": "Limonada de coco", "cantidad": 2, "valor": 18000, "valor_es_total": true}
  ],
  "tip_pct": 0,
  "tip_fixed": 0,
  "tax_pct": 0,
  "discount": 0,
  "subtotal": 0,
  "total": 0,
  "currency": "COP",
  "notes": "observación breve"
}
Reglas:
- Todos los precios como números sin puntos ni comas ni símbolos de moneda
- "valor" es EXACTAMENTE el número que aparece en la columna del recibo — no hagas ningún cálculo, cópialo textual.
- "cantidad" es el número en la columna Cant. — cópialo textual.
- "valor_es_total": true si el valor de la columna es el total de esa línea (cantidad × unitario). false si es precio unitario. Pista: si hay una columna llamada "Total", "Valor", "Importe" → true. Si dice "P.Unit", "Unitario", "Precio" → false. Si no hay columna de cantidad visible → false (cada línea es 1 item).
- NO dividas, NO multipliques, NO modifiques ningún número.
- "PROPINA", "PROPINA SUGERIDA", "TIP", "GRATUITY" siempre van en tip_pct o tip_fixed, NUNCA en tax_pct. "IMPUESTO", "IVA", "TAX" van en tax_pct. Si ves un porcentaje sugerido al final del recibo antes del total, es propina — no impuesto.
- Si detectas propina como porcentaje, ponla en tip_pct. Si es monto fijo, en tip_fixed
- Si la imagen no es un recibo, responde con rows vacío y notes explicando
- Si hay texto ilegible en algún item, usa tu mejor estimación con el nombre "[ilegible]"`
            }
          ]
        }]
      })
    })

    const data = await response.json()
    if (data.error) {
      return res.status(500).json({ error: true, message: data.error.message })
    }

    const text = data.content?.find(b => b.type === 'text')?.text ?? ''
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)

    // Pass 2: JS expands rows into individual items with correct unit prices
    const items = expandRows(parsed.rows || [])

    items.forEach(item => {
      if (!item.price || item.price === 0) {
        console.warn('scan: item con precio 0 o nulo:', item.name)
      }
    })

    // Sanity check: sum of expanded items vs AI-reported subtotal
    const sumItems = items.reduce((s, i) => s + i.price, 0)
    const expectedSubtotal = parsed.subtotal || 0
    if (expectedSubtotal > 0) {
      const ratio = sumItems / expectedSubtotal
      if (ratio < 0.85 || ratio > 1.15) {
        console.warn('Price sanity check failed:', {
          sumItems, expectedSubtotal, ratio, rows: parsed.rows
        })
      }
    }

    return res.status(200).json({
      items,
      tip_pct: parsed.tip_pct || 0,
      tip_fixed: parsed.tip_fixed || 0,
      tax_pct: parsed.tax_pct || 0,
      discount: parsed.discount || 0,
      subtotal: parsed.subtotal || 0,
      total: parsed.total || 0,
      currency: parsed.currency || 'COP',
      notes: parsed.notes || ''
    })
  } catch (err) {
    console.error('scan error:', err)
    return res.status(500).json({ error: true, message: 'Error al procesar el recibo. Intenta de nuevo.' })
  }
}
