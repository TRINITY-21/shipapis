// Browser e2e smoke — boots `wrangler dev`, drives system Chrome via puppeteer-core, and checks
// each key page at desktop + mobile for: HTTP 200, no uncaught JS errors, exactly one <h1>, and
// no horizontal overflow on mobile (the regression the UI-verification note flags). Screenshots
// land in the scratchpad. Not part of `npm test` (needs a live server + Chrome).
//
//   node tests/e2e/browser-smoke.mjs
//
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'
import puppeteer from 'puppeteer-core'

const CHROME =
  process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const SHOTS = '/private/tmp/claude-501/-Users-ghost-Documents-APIs/618375a6-2e4e-401e-a62b-64f1a18cca79/scratchpad/shots'
const STARTUP_TIMEOUT_MS = 90_000

const PATHS = ['/', '/browse?facet=monitored', '/graveyard', '/state', '/changelog', '/agents']
const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844, isMobile: true },
]

const log = (...a) => console.log('·', ...a)
let failures = 0
const fail = (msg) => {
  failures++
  console.error('  ✗', msg)
}

function startServer() {
  const proc = spawn('npx', ['wrangler', 'dev', '--port', '8799', '--log-level', 'info'], {
    cwd: process.cwd(),
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
  })
  let base = null
  const onData = (buf) => {
    const s = buf.toString()
    const m = s.match(/https?:\/\/(?:localhost|127\.0\.0\.1):(\d+)/)
    if (m && !base) base = `http://localhost:${m[1]}`
  }
  proc.stdout.on('data', onData)
  proc.stderr.on('data', onData)
  return { proc, getBase: () => base }
}

async function waitReady(getBase, deadline) {
  while (Date.now() < deadline) {
    const base = getBase()
    if (base) {
      try {
        const res = await fetch(base + '/', { redirect: 'manual' })
        if (res.status < 500) return base
      } catch {
        /* not up yet */
      }
    }
    await sleep(500)
  }
  throw new Error('wrangler dev did not become ready in time')
}

async function main() {
  mkdirSync(SHOTS, { recursive: true })
  log('starting wrangler dev…')
  const { proc, getBase } = startServer()
  let base
  try {
    base = await waitReady(getBase, Date.now() + STARTUP_TIMEOUT_MS)
    log('server ready at', base)

    const browser = await puppeteer.launch({
      executablePath: CHROME,
      headless: 'new',
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    })
    try {
      for (const vp of VIEWPORTS) {
        const page = await browser.newPage()
        await page.setViewport({ width: vp.width, height: vp.height, isMobile: !!vp.isMobile })
        const jsErrors = []
        page.on('pageerror', (e) => jsErrors.push(String(e)))

        for (const path of PATHS) {
          jsErrors.length = 0
          const res = await page.goto(base + path, { waitUntil: 'networkidle2', timeout: 30_000 })
          const status = res?.status()
          if (status !== 200) fail(`${vp.name} ${path} → HTTP ${status}`)

          const h1s = await page.$$eval('h1', (els) => els.length)
          if (h1s !== 1) fail(`${vp.name} ${path} → ${h1s} <h1> (expected 1)`)

          if (jsErrors.length) fail(`${vp.name} ${path} → JS error: ${jsErrors[0]}`)

          if (vp.isMobile) {
            const overflow = await page.evaluate(
              () => document.documentElement.scrollWidth - window.innerWidth,
            )
            if (overflow > 1) fail(`${vp.name} ${path} → horizontal overflow ${overflow}px`)
          }

          const safe = path.replace(/[^a-z0-9]+/gi, '_') || 'root'
          await page.screenshot({ path: `${SHOTS}/${vp.name}${safe}.png` })
          log(`${vp.name} ${path} → ${status}, h1=${h1s}${vp.isMobile ? '' : ''}`)
        }
        await page.close()
      }
    } finally {
      await browser.close()
    }
  } finally {
    proc.kill('SIGTERM')
  }

  if (failures) {
    console.error(`\n✗ browser smoke: ${failures} check(s) failed`)
    process.exit(1)
  }
  console.log(`\n✓ browser smoke passed — screenshots in ${SHOTS}`)
}

main().catch((e) => {
  console.error('browser smoke crashed:', e)
  process.exit(1)
})
