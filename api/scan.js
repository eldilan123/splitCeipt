export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') {
    return res.status(405).json({ error: true, message: 'Method not allowed' })
  }

  const { image, mediaType } = req.body ?? {}
  if (!image || !mediaType) {
    return res.status(400).json({ error: true, message: 'image y mediaType son requeridos' })
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
              text: `Analiza este recibo/cuenta de restaurante y extrae TODA la información.
Responde SOLO con JSON válido, sin markdown, sin texto extra, exactamente así:
{
  "items": [{"name": "nombre del item", "price": 12500}],
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
- Si hay items con cantidades (ej "2x Coca-Cola"), créalos como entradas separadas
- Si detectas propina como porcentaje, ponla en tip_pct. Si es monto fijo, en tip_fixed
- Si la imagen no es un recibo, responde con items vacíos y notes explicando
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
    return res.status(200).json(parsed)
  } catch (err) {
    console.error('scan error:', err)
    return res.status(500).json({ error: true, message: 'Error al procesar el recibo. Intenta de nuevo.' })
  }
}
