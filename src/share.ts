import type { Stats } from './universe'

const W = 1080
const H = 1350

function drawCard(game: HTMLCanvasElement, stats: Stats, modeLabel: string): HTMLCanvasElement {
  const card = document.createElement('canvas')
  card.width = W
  card.height = H
  const ctx = card.getContext('2d')!

  // background: cover-crop the live game canvas
  ctx.fillStyle = '#04060a'
  ctx.fillRect(0, 0, W, H)
  const scale = Math.max(W / game.width, H / game.height)
  const dw = game.width * scale
  const dh = game.height * scale
  ctx.drawImage(game, (W - dw) / 2, (H - dh) / 2, dw, dh)

  // legibility gradients top and bottom
  const top = ctx.createLinearGradient(0, 0, 0, 400)
  top.addColorStop(0, 'rgba(4,6,10,0.9)')
  top.addColorStop(1, 'rgba(4,6,10,0)')
  ctx.fillStyle = top
  ctx.fillRect(0, 0, W, 400)
  const bot = ctx.createLinearGradient(0, H - 560, 0, H)
  bot.addColorStop(0, 'rgba(4,6,10,0)')
  bot.addColorStop(1, 'rgba(4,6,10,0.95)')
  ctx.fillStyle = bot
  ctx.fillRect(0, H - 560, W, 560)

  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(230,237,243,0.7)'
  ctx.font = '600 34px system-ui, sans-serif'
  ctx.fillText('ONE BUTTON UNIVERSE', W / 2, 96)

  const title = stats.ending ? stats.ending.title : `${stats.phase}`
  ctx.fillStyle = '#f4f6fa'
  ctx.font = '700 84px Georgia, serif'
  ctx.fillText(title, W / 2, H - 400)

  if (stats.ending) {
    ctx.fillStyle = 'rgba(230,237,243,0.75)'
    ctx.font = '400 36px Georgia, serif'
    ctx.fillText(stats.ending.line, W / 2, H - 330, W - 120)
  }

  const cells: Array<[string, string]> = [
    ['AGE', `${stats.age} Gyr`],
    ['STARS', String(stats.stars)],
    ['BLACK HOLES', String(stats.holes)],
    ['ENTROPY', String(stats.entropy)],
  ]
  const cw = (W - 160) / cells.length
  cells.forEach(([label, value], i) => {
    const x = 80 + cw * i + cw / 2
    ctx.fillStyle = 'rgb(121,223,230)'
    ctx.font = '600 24px system-ui, sans-serif'
    ctx.fillText(label, x, H - 220)
    ctx.fillStyle = '#f4f6fa'
    ctx.font = '700 48px system-ui, sans-serif'
    ctx.fillText(value, x, H - 160)
  })

  ctx.fillStyle = 'rgba(240,182,97,0.85)'
  ctx.font = '500 28px system-ui, sans-serif'
  ctx.fillText(`${modeLabel} mode`, W / 2, H - 72)

  return card
}

export async function shareCard(game: HTMLCanvasElement, stats: Stats, modeLabel: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const card = drawCard(game, stats, modeLabel)
  const blob = await new Promise<Blob | null>((res) => card.toBlob(res, 'image/png'))
  if (!blob) throw new Error('card render failed')
  const file = new File([blob], 'one-button-universe.png', { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'One Button Universe' })
      return 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
      // real share failure: fall through to download
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'one-button-universe.png'
  a.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
  return 'downloaded'
}
