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
- El campo "Valor" o "Total" en recibos colombianos es siempre el precio TOTAL de esa línea (cantidad × precio unitario). Para crear items individuales: precio_unitario = Valor / Cantidad. NUNCA multipliques el Valor por la cantidad — ya está multiplicado. Ejemplo: "3 Cerveza $24.000" → tres items de $8.000 cada uno. Ejemplo: "1 Papas fritas $12.000" → un item de $12.000 exacto.
- Si un item tiene cantidad mayor a 1 (ej: "2 Limonada de coco $18.000" donde $18.000 es el total), divide el precio total entre la cantidad y crea UNA entrada por unidad con el precio unitario. Ejemplo: 2x Limonada $18.000 → dos items de $9.000 cada uno. NUNCA pongas precio 0 en un item detectado.
- Si el precio mostrado ya es unitario (ej: "Coca-Cola x2 $4.500 c/u"), multiplica por cantidad para el total y divide de vuelta: cada entrada = $4.500
- Si la cantidad es 1 (o no hay cantidad indicada), el precio del item es exactamente el que aparece en el recibo — NUNCA lo dupliques ni lo modifiques.
- "PROPINA", "PROPINA SUGERIDA", "TIP", "GRATUITY" siempre van en tip_pct o tip_fixed, NUNCA en tax_pct. "IMPUESTO", "IVA", "TAX" van en tax_pct. Si ves un porcentaje sugerido al final del recibo antes del total, es propina — no impuesto.
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

    if (Array.isArray(parsed.items)) {
      parsed.items.forEach(item => {
        if (!item.price || item.price === 0) {
          console.warn('scan: item con precio 0 o nulo:', item.name)
        }
      })
    }

    return res.status(200).json(parsed)
  } catch (err) {
    console.error('scan error:', err)
    return res.status(500).json({ error: true, message: 'Error al procesar el recibo. Intenta de nuevo.' })
  }
}
