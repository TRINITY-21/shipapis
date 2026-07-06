// OG-image generator: system Chrome headless → 1200×630 PNGs into public/og/.
// Prereq: `npm run dev` on :8787. Rerun after seed/catalog changes.
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

const OUT = new URL('../public/og/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })

const BASE = 'http://localhost:8787'
const { apis } = await fetch(`${BASE}/data/apis.json`).then((r) => r.json())
const { results: cats } = await fetch(`${BASE}/api/v1/categories`).then((r) => r.json())

const jobs = [
  ['home', '/og-card/home'],
  ...apis.map((a) => [`api-${a.slug}`, `/og-card/api/${a.slug}`]),
  ...cats.map((c) => [`cat-${c.slug}`, `/og-card/cat/${c.slug}`]),
]

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
})
const page = await browser.newPage()
await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 })

for (const [name, path] of jobs) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle0' })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: `${OUT}${name}.png` })
  console.log(`og/${name}.png`)
}

await browser.close()
console.log(`done — ${jobs.length} cards`)
