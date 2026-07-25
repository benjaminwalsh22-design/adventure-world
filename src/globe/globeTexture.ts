/**
 * Procedurally paints a bright, cartoon-style equirectangular Earth texture
 * onto an offscreen canvas. Zero downloaded assets → instant load, works
 * offline, and the style matches the Adventure World palette exactly.
 *
 * Continents are hand-tuned, simplified outlines (this is a kids' cartoon
 * globe, not a GIS product) rendered as smooth blobs. Italy is drawn as its
 * own boot-shaped landmass so the Rome pin clearly sits on land.
 */

type LatLon = [lat: number, lon: number]

const TEX_W = 2048
const TEX_H = 1024

// Palette
const OCEAN_TOP = '#60a5fa'
const OCEAN_BOTTOM = '#2563eb'
const LAND_FILL = '#4ade80'
const LAND_EDGE = '#15803d'
const ICE_FILL = '#f0fdff'
const ICE_EDGE = '#bae6fd'

/* -- Simplified continent outlines (lat, lon), clockwise ------------------ */

const NORTH_AMERICA: LatLon[] = [
  [70, -165], [72, -155], [70, -125], [73, -95], [68, -75], [60, -65],
  [47, -52], [44, -66], [35, -75], [25, -80], [29, -95], [18, -95],
  [15, -92], [8, -80], [15, -97], [23, -110], [33, -120], [40, -124],
  [48, -125], [58, -137], [58, -152], [65, -168],
]

const SOUTH_AMERICA: LatLon[] = [
  [11, -75], [10, -62], [0, -50], [-8, -35], [-23, -42], [-35, -57],
  [-51, -69], [-55, -68], [-50, -74], [-37, -73], [-18, -70], [-5, -81],
  [7, -78],
]

const AFRICA: LatLon[] = [
  [35, -6], [37, 10], [32, 32], [31, 34], [15, 40], [11, 51], [0, 42],
  [-15, 40], [-26, 33], [-34, 20], [-33, 18], [-15, 12], [-5, 9], [4, 6],
  [6, -10], [14, -17], [21, -17], [28, -13],
]

const EURASIA: LatLon[] = [
  [43, -9], [48, -4], [51, 3], [54, 8], [58, 5], [63, 5], [68, 14],
  [71, 25], [70, 30], [66, 35], [65, 40], [68, 45], [73, 55], [77, 68],
  [76, 105], [72, 130], [70, 160], [66, 170], [64, 176], [60, 163],
  [52, 157], [58, 152], [54, 137], [45, 135], [38, 127], [35, 126],
  [30, 121], [23, 113], [21, 107], [10, 105], [1, 103], [8, 98],
  [15, 95], [20, 92], [22, 89], [15, 80], [8, 77], [15, 73], [21, 70],
  [25, 66], [25, 57], [24, 52], [17, 55], [13, 45], [21, 39], [28, 35],
  [31, 34], [36, 36], [36, 30], [39, 26], [41, 23], [40, 19], [44, 13],
  [43, 7], [42, 3], [40, 0], [38, -1], [36, -6], [37, -9],
]

const ITALY: LatLon[] = [
  [45.5, 7.5], [46, 12], [44, 13.5], [42, 14.5], [40, 18.5], [39.5, 16.5],
  [38, 15.5], [40, 15], [41.5, 12.5], [43, 10], [44, 8],
]

const UK: LatLon[] = [
  [58, -5], [57, -2], [53, 0], [51, 1], [50, -4], [53, -4.5], [56, -6],
]

const GREENLAND: LatLon[] = [
  [83, -40], [81, -20], [76, -20], [70, -23], [60, -43], [65, -52],
  [70, -55], [76, -60], [80, -55],
]

const JAPAN: LatLon[] = [
  [45, 142], [43, 145], [38, 141], [35, 140], [33, 131], [35, 133],
  [38, 138], [43, 140],
]

const MADAGASCAR: LatLon[] = [
  [-12, 49], [-16, 50], [-25, 47], [-22, 44], [-16, 44],
]

const AUSTRALIA: LatLon[] = [
  [-12, 131], [-12, 137], [-17, 140], [-11, 142], [-16, 146], [-25, 153],
  [-33, 152], [-38, 147], [-38, 140], [-35, 136], [-32, 132], [-34, 124],
  [-34, 116], [-31, 115], [-26, 113], [-22, 114], [-18, 122], [-14, 126],
]

const LANDMASSES: LatLon[][] = [
  NORTH_AMERICA, SOUTH_AMERICA, AFRICA, EURASIA, ITALY, UK, GREENLAND,
  JAPAN, MADAGASCAR, AUSTRALIA,
]

/** Small islands drawn as simple ellipses: [lat, lon, rx°, ry°, rotationRad] */
const ISLAND_ELLIPSES: Array<[number, number, number, number, number]> = [
  [37.5, 14, 1.6, 1.1, 0], // Sicily
  [53, -8, 1.8, 2.2, 0], // Ireland
  [22, -79, 4.0, 1.0, -0.3], // Cuba
  [0, 101, 6.0, 2.0, 0.9], // Sumatra
  [0.5, 114, 4.5, 3.5, 0], // Borneo
  [-7, 110, 5.0, 1.2, 0.1], // Java
  [-5, 141, 6.5, 2.8, 0.15], // New Guinea
  [-39, 175, 1.6, 3.2, 0.2], // NZ North Island
  [-44, 170, 1.7, 3.4, 0.35], // NZ South Island
  [-19, 47, 0, 0, 0], // (placeholder slot, zero-size = skipped)
  [64, -19, 2.4, 1.4, 0], // Iceland
]

/* -- Projection helpers --------------------------------------------------- */

function toXY([lat, lon]: LatLon): [number, number] {
  return [((lon + 180) / 360) * TEX_W, ((90 - lat) / 180) * TEX_H]
}

/**
 * Draws a closed smooth blob through the points using midpoint quadratic
 * curves — turns a coarse polygon into a friendly rounded cartoon shape.
 */
function blobPath(ctx: CanvasRenderingContext2D, points: LatLon[]): void {
  const pts = points.map(toXY)
  const n = pts.length
  const mid = (a: [number, number], b: [number, number]): [number, number] => [
    (a[0] + b[0]) / 2,
    (a[1] + b[1]) / 2,
  ]
  ctx.beginPath()
  const start = mid(pts[n - 1], pts[0])
  ctx.moveTo(start[0], start[1])
  for (let i = 0; i < n; i++) {
    const curr = pts[i]
    const next = pts[(i + 1) % n]
    const m = mid(curr, next)
    ctx.quadraticCurveTo(curr[0], curr[1], m[0], m[1])
  }
  ctx.closePath()
}

export function createGlobeTextureCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = TEX_W
  canvas.height = TEX_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Adventure World: 2D canvas context unavailable')

  /* Ocean */
  const ocean = ctx.createLinearGradient(0, 0, 0, TEX_H)
  ocean.addColorStop(0, OCEAN_TOP)
  ocean.addColorStop(0.5, OCEAN_BOTTOM)
  ocean.addColorStop(1, OCEAN_TOP)
  ctx.fillStyle = ocean
  ctx.fillRect(0, 0, TEX_W, TEX_H)

  /* Sparkly ocean dots for texture (deterministic pattern) */
  ctx.fillStyle = 'rgba(255, 255, 255, 0.07)'
  for (let i = 0; i < 260; i++) {
    const x = (i * 733) % TEX_W
    const y = (i * 389) % TEX_H
    const r = 3 + (i % 4) * 2
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  /* Continents */
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  for (const land of LANDMASSES) {
    blobPath(ctx, land)
    ctx.fillStyle = LAND_FILL
    ctx.fill()
    ctx.strokeStyle = LAND_EDGE
    ctx.lineWidth = 5
    ctx.stroke()
  }

  /* Island ellipses */
  for (const [lat, lon, rxDeg, ryDeg, rot] of ISLAND_ELLIPSES) {
    if (rxDeg === 0) continue
    const [cx, cy] = toXY([lat, lon])
    const rx = (rxDeg / 360) * TEX_W
    const ry = (ryDeg / 180) * TEX_H
    ctx.beginPath()
    ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2)
    ctx.fillStyle = LAND_FILL
    ctx.fill()
    ctx.strokeStyle = LAND_EDGE
    ctx.lineWidth = 4
    ctx.stroke()
  }

  /* Antarctica — wavy ice shelf along the bottom edge */
  ctx.beginPath()
  ctx.moveTo(0, TEX_H)
  ctx.lineTo(0, TEX_H * 0.94)
  for (let x = 0; x <= TEX_W; x += TEX_W / 24) {
    const wave = Math.sin((x / TEX_W) * Math.PI * 6) * TEX_H * 0.012
    ctx.lineTo(x, TEX_H * 0.94 + wave)
  }
  ctx.lineTo(TEX_W, TEX_H)
  ctx.closePath()
  ctx.fillStyle = ICE_FILL
  ctx.fill()
  ctx.strokeStyle = ICE_EDGE
  ctx.lineWidth = 5
  ctx.stroke()

  /* Arctic ice cap along the top edge */
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, TEX_H * 0.045)
  for (let x = 0; x <= TEX_W; x += TEX_W / 24) {
    const wave = Math.sin((x / TEX_W) * Math.PI * 8 + 1) * TEX_H * 0.01
    ctx.lineTo(x, TEX_H * 0.045 + wave)
  }
  ctx.lineTo(TEX_W, 0)
  ctx.closePath()
  ctx.fillStyle = ICE_FILL
  ctx.fill()

  return canvas
}
