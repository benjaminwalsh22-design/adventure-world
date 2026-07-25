/**
 * Deploy-gate smoke test. Runs against the PRODUCTION build (vite preview)
 * with the same base path the live site uses, on a touch-emulated iPhone
 * viewport. If any step fails, the deploy is blocked.
 *
 * Checks the whole critical path a kid takes on first launch:
 *   boot → globe renders → tap Rome pin → zoom → city hub → launch
 *   Matching Builder → board is playable → win a pair.
 *
 * Usage:
 *   npm run build && npm run smoke            (local, base "/")
 *   DEPLOY_BASE=/adventure-world/ npm run build && DEPLOY_BASE=/adventure-world/ npm run smoke
 *
 * Env:
 *   CHROME_PATH — optional explicit Chromium binary (used in the Cowork
 *   sandbox: /opt/pw-browsers/chromium). CI omits it and uses the browser
 *   from `npx playwright install chromium`.
 */

import { spawn } from 'node:child_process'
import process from 'node:process'
import { chromium } from 'playwright'

const BASE = process.env.DEPLOY_BASE ?? '/'
const PORT = 4173
const URL = `http://localhost:${PORT}${BASE}`
const BOOT_WAIT_MS = 2400

function fail(msg) {
  console.error(`SMOKE FAIL: ${msg}`)
  process.exitCode = 1
}

async function waitForServer(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error(`preview server did not come up at ${url}`)
}

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  env: process.env,
  stdio: 'ignore',
})

let browser
try {
  await waitForServer(URL)

  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
  })
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  })

  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(e.message))

  /* 1 — boot */
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForTimeout(BOOT_WAIT_MS)
  if (!(await page.locator('canvas').first().isVisible())) fail('globe canvas not visible')

  /* 2 — Rome pin opens the city hub */
  const label = await page.locator('text=Rome').first().boundingBox()
  if (!label) {
    fail('Rome label never appeared')
  } else {
    await page.touchscreen.tap(label.x + label.width / 2, label.y + label.height + 18)
    await page.waitForSelector('text=Gladiators', { timeout: 6000 }).catch(() => fail('city hub did not open'))
  }

  /* 3 — Matching Builder launches and deals a playable board */
  await page.locator('button:has-text("Matching Builder")').tap()
  await page
    .waitForSelector('text=Find the matching pairs!', { timeout: 10_000 })
    .catch(() => fail('matching board never became playable'))

  /* 4 — a pair can actually be matched */
  const cards = await page.$$('[data-pair]')
  if (cards.length < 4) fail(`expected ≥4 cards, found ${cards.length}`)
  const byPair = {}
  for (const c of cards) {
    const p = await c.getAttribute('data-pair')
    ;(byPair[p] ||= []).push(c)
  }
  const firstPair = Object.values(byPair)[0]
  await firstPair[0].tap()
  await page.waitForTimeout(150)
  await firstPair[1].tap()
  await page.waitForTimeout(700)
  const matchedCount = await page.locator('[data-state="matched"]').count()
  if (matchedCount < 2) fail('tapped a matching pair but no cards entered matched state')

  /* 5 — zero uncaught errors across the whole run */
  if (pageErrors.length > 0) fail(`uncaught page errors:\n${pageErrors.join('\n')}`)

  if (process.exitCode !== 1) console.log('SMOKE PASS')
} catch (err) {
  fail(err.message)
} finally {
  await browser?.close()
  server.kill()
}
