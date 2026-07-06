// Screenshot rig: system Chrome headless → full-page captures at responsive widths.
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

const OUT = process.argv[2] || '/tmp/shots'
const ONLY = process.argv[3] // optional name-substring filter
mkdirSync(OUT, { recursive: true })

const BASE = 'http://localhost:8787'
const JOBS = [
  // [name, path, width, height, theme, action]
  ['home-390', '/', 390, 844],
  ['home-768', '/', 768, 1024],
  ['home-1440', '/', 1440, 900],
  ['home-light-390', '/', 390, 844, 'light'],
  ['browse-390', '/browse', 390, 844],
  ['browse-facet-390', '/browse?facet=auth-none', 390, 844],
  ['category-390', '/c/weather', 390, 844],
  ['detail-390', '/api/coingecko', 390, 844],
  ['detail-768', '/api/coingecko', 768, 1024],
  ['detail-dead-390', '/api/coindesk-bpi', 390, 844],
  ['graveyard-390', '/graveyard', 390, 844],
  ['graveyard-1440', '/graveyard', 1440, 900],
  ['agents-390', '/agents', 390, 844],
  ['agents-1440', '/agents', 1440, 900],
  ['methodology-390', '/methodology', 390, 844],
  ['submit-390', '/submit', 390, 844],
  ['signals-390', '/signals', 390, 844],
  ['compare-390', '/compare/open-meteo/sunrise-sunset', 390, 844],
  ['about-390', '/about', 390, 844],
  ['privacy-390', '/privacy', 390, 844],
  ['terms-390', '/terms', 390, 844],
  ['404-390', '/api/nope', 390, 844],
  ['menu-open-390', '/', 390, 844, null, 'menu'],
]

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
})

for (const [name, path, width, height, theme, action] of JOBS) {
  if (ONLY && !name.includes(ONLY)) continue
  // fresh incognito context per job — localStorage (theme) must not leak between shots
  const ctx = await browser.createBrowserContext()
  const page = await ctx.newPage()
  await page.setViewport({ width, height, deviceScaleFactor: 1 })
  if (theme === 'light') {
    await page.evaluateOnNewDocument(() => {
      try { localStorage.setItem('shipapis-theme', 'light') } catch {}
    })
  }
  await page.goto(BASE + path, { waitUntil: 'networkidle0', timeout: 20000 })
  await new Promise((r) => setTimeout(r, 900)) // fonts + count-up settle
  if (action === 'menu') {
    await page.click('#menu-btn')
    await new Promise((r) => setTimeout(r, 400))
  }
  // report horizontal overflow — the cardinal mobile sin
  const overflow = await page.evaluate(() => {
    const d = document.documentElement
    return d.scrollWidth > d.clientWidth ? `${d.scrollWidth}>${d.clientWidth}` : ''
  })
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: action !== 'menu' })
  console.log(`${name}.png${overflow ? `  ⚠ H-OVERFLOW ${overflow}` : ''}`)
  await ctx.close()
}

await browser.close()
console.log('done')
