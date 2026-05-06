import { useEffect, useRef } from 'react'

/**
 * Hand-drawn-feeling canvas wheel with gradient slices, hairline gold dividers,
 * inner highlight ring, and embossed text. The wheel rotates via CSS transform
 * applied by the parent.
 */
export default function Wheel({ items, palette, rotation, spinning, size = 580 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = size * dpr
    canvas.height = size * dpr
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    draw(ctx, items, palette, size)
  }, [items, palette, size])

  return (
    <canvas
      ref={canvasRef}
      className="wheel-canvas"
      style={{
        transform: `rotate(${rotation}deg)`,
        transition: spinning
          ? 'transform 5.6s cubic-bezier(0.18, 0.86, 0.24, 1)'
          : 'none',
      }}
    />
  )
}

function draw(ctx, items, palette, size) {
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 4

  ctx.clearRect(0, 0, size, size)

  if (items.length === 0) {
    drawEmpty(ctx, cx, cy, r)
    return
  }

  const step = (Math.PI * 2) / items.length
  // start at -π/2 so the first slice is centered at the top (under the pointer)
  const start0 = -Math.PI / 2 - step / 2

  items.forEach((label, i) => {
    const a0 = start0 + step * i
    const a1 = a0 + step
    const color = palette[i % palette.length]

    // ---- slice fill with radial gradient (subtle 3D shading) ----
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, r, a0, a1)
    ctx.closePath()

    const grad = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r)
    grad.addColorStop(0, lighten(color, 0.18))
    grad.addColorStop(0.55, color)
    grad.addColorStop(1, darken(color, 0.18))
    ctx.fillStyle = grad
    ctx.fill()

    // glossy inner highlight (top arc-ish gradient overlay)
    ctx.globalCompositeOperation = 'source-atop'
    const gloss = ctx.createLinearGradient(cx, cy - r, cx, cy)
    gloss.addColorStop(0, 'rgba(255,255,255,0.18)')
    gloss.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gloss
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'
    ctx.restore()

    // ---- gold hairline divider ----
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(a0)
    const divGrad = ctx.createLinearGradient(0, 0, r, 0)
    divGrad.addColorStop(0, 'rgba(0,0,0,0.4)')
    divGrad.addColorStop(0.5, 'rgba(255, 230, 170, 0.55)')
    divGrad.addColorStop(1, 'rgba(255, 245, 225, 0.85)')
    ctx.strokeStyle = divGrad
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(r, 0)
    ctx.stroke()
    ctx.restore()

    // ---- text along slice ----
    drawSliceText(ctx, label, cx, cy, r, a0 + step / 2, color)
  })

  // ---- subtle dotted decorative ring near the rim ----
  ctx.save()
  ctx.strokeStyle = 'rgba(255, 245, 225, 0.22)'
  ctx.setLineDash([1, 5])
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(cx, cy, r - 14, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()

  // ---- inner halo ring (faint glow toward center) ----
  ctx.save()
  const halo = ctx.createRadialGradient(cx, cy, r * 0.05, cx, cy, r * 0.42)
  halo.addColorStop(0, 'rgba(0, 0, 0, 0.0)')
  halo.addColorStop(1, 'rgba(0, 0, 0, 0.35)')
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.42, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // ---- gold outer edge ----
  ctx.save()
  const rim = ctx.createLinearGradient(0, 0, size, size)
  rim.addColorStop(0, '#fff5e1')
  rim.addColorStop(0.5, '#b8975a')
  rim.addColorStop(1, '#fff5e1')
  ctx.strokeStyle = rim
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(cx, cy, r - 1, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

function drawSliceText(ctx, text, cx, cy, r, midAngle, sliceColor) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(midAngle)

  // text sits along the radius, reading outward
  // anchor near 65% of the radius
  const tr = r * 0.62

  // pick legible ink based on slice luminance
  const ink = isLight(sliceColor) ? '#1a0e2e' : '#fff8ec'
  const shadow = isLight(sliceColor)
    ? 'rgba(255,255,255,0.45)'
    : 'rgba(0,0,0,0.55)'

  // size scales with text length
  const baseSize = Math.min(22, Math.max(13, 26 - text.length * 0.6))
  ctx.font = `600 ${baseSize}px "Noto Sans TC", "PingFang TC", system-ui, sans-serif`
  ctx.fillStyle = ink
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = shadow
  ctx.shadowBlur = 3
  ctx.shadowOffsetY = 0.5

  // truncate gracefully
  let display = text
  const maxWidth = r * 0.5
  while (ctx.measureText(display).width > maxWidth && display.length > 1) {
    display = display.slice(0, -1)
  }
  if (display !== text) display = display.slice(0, -1) + '…'

  ctx.fillText(display, tr, 0)
  ctx.restore()
}

function drawEmpty(ctx, cx, cy, r) {
  ctx.save()
  ctx.fillStyle = '#1a1438'
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = 'rgba(255, 245, 225, 0.18)'
  ctx.setLineDash([4, 6])
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(cx, cy, r - 4, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])

  ctx.fillStyle = 'rgba(255, 245, 225, 0.5)'
  ctx.font = '500 18px "Noto Sans TC", system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('請先新增選項', cx, cy)
  ctx.restore()
}

/* ---------- color helpers ---------- */

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  const v =
    h.length === 3
      ? h.split('').map((c) => c + c).join('')
      : h
  const num = parseInt(v, 16)
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
}

function rgbToHex({ r, g, b }) {
  const c = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

function lighten(hex, t) {
  const { r, g, b } = hexToRgb(hex)
  return rgbToHex({ r: r + (255 - r) * t, g: g + (255 - g) * t, b: b + (255 - b) * t })
}

function darken(hex, t) {
  const { r, g, b } = hexToRgb(hex)
  return rgbToHex({ r: r * (1 - t), g: g * (1 - t), b: b * (1 - t) })
}

function isLight(hex) {
  const { r, g, b } = hexToRgb(hex)
  // perceived luminance
  const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return l > 0.62
}
