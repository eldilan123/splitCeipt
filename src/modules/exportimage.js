import { fmt } from '../utils.js'

export function exportResultAsImage(people, totals, grandTotal, breakdown) {
  const canvas = document.createElement('canvas')
  const dpr = window.devicePixelRatio || 2
  const W = 400
  const rowH = 56
  const headerH = 120
  const footerH = 80
  const H = headerH + (people.length * rowH) + footerH + 40

  canvas.width = W * dpr
  canvas.height = H * dpr
  canvas.style.width = W + 'px'
  canvas.style.height = H + 'px'

  const ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)

  ctx.fillStyle = '#F5F2EC'
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = '#E8450A'
  ctx.fillRect(0, 0, W, 72)

  ctx.fillStyle = '#fff'
  ctx.font = 'bold 22px system-ui, sans-serif'
  ctx.fillText('Split', 24, 44)
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.font = 'bold 22px system-ui, sans-serif'
  ctx.fillText('Ceipt', 24 + ctx.measureText('Split').width, 44)

  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.font = '13px system-ui, sans-serif'
  ctx.fillText('divide sin dramas · splitceipt.app', 24, 62)

  ctx.fillStyle = '#1A1814'
  ctx.font = 'bold 16px system-ui, sans-serif'
  ctx.fillText('¡Todo dividido! 🎉', 24, 104)

  people.forEach((p, i) => {
    const y = headerH + (i * rowH)

    ctx.fillStyle = '#FDFBF7'
    roundRect(ctx, 16, y, W - 32, rowH - 8, 12)
    ctx.fill()

    ctx.fillStyle = p.color
    ctx.beginPath()
    ctx.arc(44, y + 22, 18, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#fff'
    ctx.font = 'bold 14px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(p.name[0].toUpperCase(), 44, y + 27)
    ctx.textAlign = 'left'

    ctx.fillStyle = '#1A1814'
    ctx.font = '500 15px system-ui, sans-serif'
    ctx.fillText(p.name, 72, y + 18)

    const items = breakdown[p.id] || []
    ctx.fillStyle = '#A8A49E'
    ctx.font = '12px system-ui, sans-serif'
    ctx.fillText(`${items.length} item${items.length !== 1 ? 's' : ''}`, 72, y + 34)

    ctx.fillStyle = p.color
    ctx.font = 'bold 18px system-ui, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(fmt(totals[p.id]), W - 28, y + 26)
    ctx.textAlign = 'left'
  })

  const totalY = headerH + (people.length * rowH) + 16
  ctx.fillStyle = '#1A1814'
  roundRect(ctx, 16, totalY, W - 32, 52, 12)
  ctx.fill()

  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = '12px system-ui, sans-serif'
  ctx.fillText('Total · COP', 28, totalY + 20)

  ctx.fillStyle = '#fff'
  ctx.font = 'bold 22px system-ui, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText(fmt(grandTotal), W - 28, totalY + 38)
  ctx.textAlign = 'left'

  ctx.fillStyle = '#A8A49E'
  ctx.font = '11px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('Generado con splitceipt.app · Divide sin dramas', W / 2, totalY + 76)
  ctx.textAlign = 'left'

  return canvas
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

export function downloadImage(canvas, filename = 'splitceipt.png') {
  const link = document.createElement('a')
  link.download = filename
  link.href = canvas.toDataURL('image/png')
  link.click()
}

export function shareImageNative(canvas, people, grandTotal) {
  canvas.toBlob(async (blob) => {
    const file = new File([blob], 'splitceipt.png', { type: 'image/png' })
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: 'SplitCeipt',
        text: `Total dividido: ${fmt(grandTotal)} entre ${people.map(p => p.name).join(', ')}`
      })
    } else {
      downloadImage(canvas)
    }
  })
}
