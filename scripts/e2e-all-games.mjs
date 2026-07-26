/**
 * Full-court e2e: plays every Rome game to a win state on a touch-emulated
 * iPhone viewport, then checks the Trophy Room shelves. Not part of the CI
 * gate (runtime ~3min) — run locally before shipping game changes.
 */
import { chromium } from 'playwright'

const URL = process.env.E2E_URL ?? 'http://localhost:4173'
const CHROME = process.env.CHROME_PATH || undefined
const results = []
const ok = (name) => {
  results.push(`✓ ${name}`)
  console.log(`✓ ${name}`)
}

const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true })
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(e.message))

async function openRome() {
  const label = await page.locator('text=Rome').first().boundingBox()
  await page.touchscreen.tap(label.x + label.width / 2, label.y + label.height + 18)
  await page.waitForSelector('text=Gladiators', { timeout: 8000 })
}

async function launchGame(name) {
  await page.locator(`button:has-text("${name}")`).tap()
}

async function backToRomeHub() {
  await page.locator('button:has-text("Back to Rome")').last().tap()
  await page.waitForSelector('text=Gladiators', { timeout: 8000 })
}

/* boot */
await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForTimeout(2400)
await openRome()
const playCount = await page.locator('span:has-text("PLAY")').count()
if (playCount < 6) throw new Error(`expected 6 playable games in Rome, found ${playCount}`)
ok(`Rome hub lists ${playCount} playable games`)

/* ---- Swim Races ---- */
await launchGame('Championship Swim Races')
await page.waitForSelector('text=ON YOUR MARK', { timeout: 10000 })
await page.locator('button:has-text("ON YOUR MARK")').tap()
await page.evaluate(() => {
  let last = 0
  window.__swimAuto = setInterval(() => {
    const e = window.__awSwim
    if (!e || e.getPhase() !== 'racing') return
    const m = e.getMarker()
    const c = (m.greenStart + m.greenEnd) / 2
    if (Math.abs(m.pos - c) < (m.greenEnd - m.greenStart) * 0.2 && Date.now() - last > 300) {
      last = Date.now()
      e.tap()
    }
  }, 25)
})
await page.waitForSelector('text=place', { timeout: 90000 })
await page.evaluate(() => clearInterval(window.__swimAuto))
await page.screenshot({ path: '/tmp/g-swim.png' })
ok('Swim race finished with placement overlay')
await backToRomeHub()

/* ---- Puzzle Quest (12pc, one real drag + fast-forward) ---- */
await launchGame('Puzzle Quest')
await page.waitForSelector('text=12 pieces', { timeout: 10000 })
await page.locator('button:has-text("12 pieces")').tap()
await page.waitForTimeout(800)
// one REAL pointer drag through the input pipeline — grab the TOPMOST
// unlocked piece (last in z-order) so overlapping pieces can't steal the grab
const info = await page.evaluate(() => {
  const e = window.__awPuzzle
  const unlocked = e.listPieces().filter((p) => !p.locked)
  const top = unlocked[unlocked.length - 1]
  return e.pieceScreenInfo(top.id)
})
{
  const { from, to } = info
  const steps = 12
  // Playwright's mouse emits the same pointer events the engine listens to
  await page.mouse.move(from[0], from[1])
  await page.mouse.down()
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(
      from[0] + ((to[0] - from[0]) * i) / steps,
      from[1] + ((to[1] - from[1]) * i) / steps,
    )
  }
  await page.mouse.up()
}
const dragLocked = await page.evaluate(() => window.__awPuzzle.listPieces().filter((p) => p.locked).length)
if (dragLocked < 1) throw new Error('drag-to-snap did not lock a piece')
ok(`Puzzle drag-snap locked a piece (${dragLocked} placed)`)
await page.evaluate(() => window.__awPuzzle.autoSolve())
await page.waitForSelector('text=Puzzle complete!', { timeout: 8000 })
await page.screenshot({ path: '/tmp/g-puzzle.png' })
ok('12-piece puzzle completed')
await backToRomeHub()

/* ---- Jungle Adventure Dash ---- */
await launchGame('Jungle Adventure Dash')
await page.waitForSelector('text=GO!', { timeout: 10000 })
await page.evaluate(() => {
  window.__dashAuto = setInterval(() => {
    const e = window.__awDash
    if (!e || e.getPhase() !== 'running') return
    const p = e.peek()
    if (!p) {
      e.duckUp()
      return
    }
    if (p.kind === 'duck') {
      if (p.dx < 300) e.duckDown()
    } else {
      e.duckUp()
      if (p.dx < 150 && p.dx > 0) e.jump()
    }
  }, 40)
})
await page.locator('button:has-text("GO!")').tap()
await page.waitForTimeout(3500)
await page.screenshot({ path: '/tmp/g-jungle.png' })
await page.waitForSelector('text=You made it!', { timeout: 60000 })
await page.evaluate(() => clearInterval(window.__dashAuto))
ok('Jungle Dash run completed')
await backToRomeHub()

/* ---- Reading Quest (first story, known answers) ---- */
await launchGame('Reading Quest')
await page.waitForSelector('text=The Mighty Colosseum', { timeout: 10000 })
await page.locator('button:has-text("The Mighty Colosseum")').tap()
await page.waitForSelector('text=ready for the questions', { timeout: 8000 })
await page.screenshot({ path: '/tmp/g-reading.png' })
await page.locator('button:has-text("ready for the questions")').tap()
for (const answer of [1, 0, 2]) {
  await page.waitForSelector('text=Question', { timeout: 6000 })
  await page.locator(`[data-choice="${answer}"]`).tap()
  await page.waitForTimeout(400)
}
await page.waitForSelector('text=Perfect reading!', { timeout: 8000 })
const bookmarkShown = await page.locator('text=New bookmark!').isVisible()
if (!bookmarkShown) throw new Error('bookmark not awarded for perfect quiz')
await page.screenshot({ path: '/tmp/g-reading-done.png' })
ok('Reading Quest: perfect quiz → bookmark awarded')
await backToRomeHub()

/* ---- Target Cannon (simulate-then-fire autopilot) ---- */
await launchGame('Target Cannon')
await page.waitForTimeout(1500)
let noSolutionStrikes = 0
for (let shot = 0; shot < 16; shot++) {
  const solved = await page.evaluate(() => {
    const e = window.__awCannon
    if (!e || e.W === 0) return 'not-ready'
    if (!e.canFire()) return 'busy'
    if (e.targetsLeft() === 0) return 'done'
    for (let a = 16; a <= 79; a += 2) {
      for (let p = 22; p <= 100; p += 2) {
        if (e.simulate(a, p)) {
          e.setAngle(a)
          e.setPower(p)
          e.fire()
          return 'fired'
        }
      }
    }
    return 'nosolution'
  })
  if (solved === 'nosolution' || solved === 'not-ready') {
    // transient: engine may still be measuring, or a ball just resolved
    if (++noSolutionStrikes > 4) {
      const diag = await page.evaluate(() => {
        const e = window.__awCannon
        if (!e) return { noEngine: true }
        let fine = 0
        for (let a = 16; a <= 79; a += 1)
          for (let p = 22; p <= 100; p += 1) if (e.simulate(a, p)) fine++
        return {
          W: e.W,
          H: e.H,
          shotsLeft: e.shotsLeft,
          done: e.done,
          fineGridSolutions: fine,
          muzzle: e.muzzle(),
          groundY: e.groundY(),
          targets: e.targets.map((t) => ({ k: t.kind, alive: t.alive, pos: e.targetPos(t) })),
        }
      })
      console.error('CANNON DIAG:', JSON.stringify(diag))
      throw new Error(`cannon autopilot stuck (${solved})`)
    }
    await page.waitForTimeout(900)
    continue
  }
  noSolutionStrikes = 0
  if (solved === 'done') break
  await page.waitForTimeout(2000) // ball flight
  const cleared = await page.locator('text=All targets down!').isVisible().catch(() => false)
  if (cleared) break
}
await page.waitForSelector('text=All targets down!', { timeout: 15000 })
await page.screenshot({ path: '/tmp/g-cannon.png' })
ok('Cannon level cleared via physics simulation')
await backToRomeHub()

/* ---- Trophy Room shows the loot ---- */
await page.locator('[aria-label="Close"]').tap()
await page.waitForTimeout(500)
await page.locator('[aria-label="My Trophy Room"]').tap()
await page.waitForTimeout(900)
const store = await page.evaluate(() => JSON.parse(localStorage.getItem('aw:rewards:v1')).state)
if (store.medals.length < 1) throw new Error('no medal recorded from swim race')
if (store.bookmarks.length < 1) throw new Error('no bookmark recorded from reading quest')
await page.screenshot({ path: '/tmp/g-trophy.png' })
ok(`Trophy Room: ${store.medals.length} medal(s), ${store.bookmarks.length} bookmark(s), ${store.stickers.length} sticker(s), ${store.coins} coins`)

if (pageErrors.length) throw new Error(`page errors:\n${pageErrors.join('\n')}`)
ok('zero uncaught page errors across all games')

console.log('\nALL GAMES PASS')
await browser.close()
