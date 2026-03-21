/**
 * Client-only logo tile color from image URL (no CMS/API calls).
 * Uses **edge pixels** (typical “mat” / letterbox) — not full-image average — so
 * transparent PNGs, white-back logos, and solid mats read correctly.
 */

const MAX_SAMPLE = 56
const ALPHA_SOLID = 28

/** Share of edge pixels that are transparent → treat as transparent logo → white tile. */
const EDGE_TRANSPARENT_RATIO = 0.38

/** Opaque edge pixels this bright on average → snap tile to white. */
const WHITE_EDGE_MEAN_L = 240
/** Or: this fraction of opaque edge pixels are “light” → white tile. */
const WHITE_EDGE_LIGHT_FRAC = 0.78
const WHITE_EDGE_LIGHT_L = 226

function blend(c: number, target: number, t: number): number {
  return Math.round(c + (target - c) * t)
}

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

/** Unique edge cell indices (row-major i = y * w + x). */
function edgeFlatIndices(w: number, h: number): number[] {
  const seen = new Set<number>()
  const add = (y: number, x: number) => {
    if (y >= 0 && y < h && x >= 0 && x < w) seen.add(y * w + x)
  }
  for (let x = 0; x < w; x++) {
    add(0, x)
    add(h - 1, x)
  }
  for (let y = 0; y < h; y++) {
    add(y, 0)
    add(y, w - 1)
  }
  return [...seen]
}

type SampleOutcome = { type: 'solid'; color: string } | { type: 'transparent' } | null

function sampleLogoTileFromEdges(img: HTMLImageElement): SampleOutcome {
  const nw = img.naturalWidth
  const nh = img.naturalHeight
  if (!nw || !nh) return null

  const scale = Math.min(1, MAX_SAMPLE / Math.max(nw, nh))
  const w = Math.max(1, Math.round(nw * scale))
  const h = Math.max(1, Math.round(nh * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null

  let d: Uint8ClampedArray
  try {
    ctx.drawImage(img, 0, 0, w, h)
    d = ctx.getImageData(0, 0, w, h).data
  } catch {
    return null
  }

  const indices = edgeFlatIndices(w, h)
  const edgeCount = indices.length
  if (edgeCount < 4) return null

  let transparentEdges = 0
  const opaqueRs: number[] = []
  const opaqueGs: number[] = []
  const opaqueBs: number[] = []
  let lightOpaque = 0

  for (const i of indices) {
    const o = i * 4
    const a = d[o + 3]
    if (a < ALPHA_SOLID) {
      transparentEdges++
      continue
    }
    const r = d[o]
    const g = d[o + 1]
    const b = d[o + 2]
    opaqueRs.push(r)
    opaqueGs.push(g)
    opaqueBs.push(b)
    if (luminance(r, g, b) >= WHITE_EDGE_LIGHT_L) lightOpaque++
  }

  if (transparentEdges / edgeCount > EDGE_TRANSPARENT_RATIO) {
    return { type: 'transparent' }
  }

  const on = opaqueRs.length
  if (on < 3) return { type: 'transparent' }

  let sumL = 0
  for (let k = 0; k < on; k++) {
    sumL += luminance(opaqueRs[k], opaqueGs[k], opaqueBs[k])
  }
  const meanL = sumL / on

  if (meanL >= WHITE_EDGE_MEAN_L || lightOpaque / on >= WHITE_EDGE_LIGHT_FRAC) {
    return { type: 'solid', color: 'rgb(255,255,255)' }
  }

  let r = 0
  let g = 0
  let b = 0
  for (let k = 0; k < on; k++) {
    r += opaqueRs[k]
    g += opaqueGs[k]
    b += opaqueBs[k]
  }
  r = Math.round(r / on)
  g = Math.round(g / on)
  b = Math.round(b / on)

  const L = luminance(r, g, b)
  if (L < 36) {
    r = blend(r, 252, 0.08)
    g = blend(g, 252, 0.08)
    b = blend(b, 252, 0.08)
  } else if (L > 250) {
    return { type: 'solid', color: 'rgb(255,255,255)' }
  }

  return { type: 'solid', color: `rgb(${r},${g},${b})` }
}

let running = 0
const MAX_CONCURRENT = 2
const waitQueue: Array<() => void> = []

function acquireSlot(): Promise<void> {
  if (running < MAX_CONCURRENT) {
    running++
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    waitQueue.push(() => {
      running++
      resolve()
    })
  })
}

function releaseSlot(): void {
  running--
  const next = waitQueue.shift()
  if (next) next()
}

export type LogoBackgroundExtractResult =
  | { kind: 'solid'; color: string }
  | { kind: 'transparent' }
  | { kind: 'failed' }

export async function extractAverageLogoColorFromUrl(
  url: string,
  signal?: AbortSignal
): Promise<LogoBackgroundExtractResult> {
  await acquireSlot()
  try {
    if (signal?.aborted) return { kind: 'failed' }

    const img = new Image()
    img.crossOrigin = 'anonymous'

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('load'))
      img.src = url
    })

    if (signal?.aborted) return { kind: 'failed' }
    const sampled = sampleLogoTileFromEdges(img)
    if (sampled === null) return { kind: 'failed' }
    if (sampled.type === 'transparent') return { kind: 'transparent' }
    return { kind: 'solid', color: sampled.color }
  } catch {
    return { kind: 'failed' }
  } finally {
    releaseSlot()
  }
}
