// Merge API candidates from multiple directory sources, dedupe against the live seed.
// run: node scripts/fetch-multi-candidates.mjs [--check]
//
// Sources:
//   • scripts/candidates.json (MIT public-apis list — primary pool)
//   • dev.to list (uploaded markdown in repo or DEVTO_MD env)
//   • apimap.dev/api/index.json (names + categories only — no URLs; used for gap hints)

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const CHECK = process.argv.includes('--check')
const OUT = fileURLToPath(new URL('./multi-candidates.json', import.meta.url))
const SEED = fileURLToPath(new URL('../src/data/seed.ts', import.meta.url))
const IMPORTED = fileURLToPath(new URL('../src/data/seed-imported.ts', import.meta.url))
const CANDIDATES = fileURLToPath(new URL('./candidates.json', import.meta.url))
const DEVTO_DEFAULT = fileURLToPath(
  new URL('../../.cursor/projects/Users-ghost-Documents-APIs/uploads/100-free-apis-for-developers-in-2024-1jfi-1.md', import.meta.url),
)

const seedSrc = readFileSync(SEED, 'utf8') + readFileSync(IMPORTED, 'utf8')
const seedHosts = new Set(
  [...seedSrc.matchAll(/(?:docsUrl|baseUrl): '(https?:\/\/[^/']+)/g)].map((m) => {
    try { return new URL(m[1]).hostname.replace(/^www\./, '') } catch { return '' }
  }).filter(Boolean),
)
const seedNames = new Set(
  [...seedSrc.matchAll(/(?:name|\"name\"): ['"]([^'"]+)/g)].map((m) => m[1].toLowerCase()),
)

const rows = []
const seen = new Set()

const add = (r) => {
  if (!r.docsUrl || !r.name) return
  let host
  try { host = new URL(r.docsUrl).hostname.replace(/^www\./, '') } catch { return }
  const key = host + '|' + r.name.toLowerCase()
  if (seen.has(key) || seedHosts.has(host)) return
  seen.add(key)
  rows.push(r)
}

// --- public-apis pool (already ranked keyless-first)
const pool = JSON.parse(readFileSync(CANDIDATES, 'utf8'))
for (const c of pool.candidates) {
  add({
    name: c.name,
    docsUrl: c.docsUrl,
    description: c.description,
    auth: c.auth,
    https: c.https,
    cors: c.cors,
    sourceCategory: c.sourceCategory,
    source: 'public-apis',
    docsCheck: c.docsCheck,
  })
}

// --- dev.to markdown links (mostly docs landing pages — triage only)
const devtoPath = process.env.DEVTO_MD || DEVTO_DEFAULT
if (existsSync(devtoPath)) {
  const md = readFileSync(devtoPath, 'utf8')
  for (const m of md.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g)) {
    const name = m[1].replace(/\s*🌐|🚀|📊|🌏|🌎|🦠|🗺️|📚|🌦️|🌩️|🌊|🌤️|⛅|📰|🌍|🔥|🗞|🪙|📈|💱|🔐|🧠|🤖|🗣️|⚙️|🖼️|📘|🎽|🏀|⚽|📺|🍔|🎮|🛠️|🎵|🛒|🎓/gu, '').trim()
    add({
      name,
      docsUrl: m[2],
      description: '',
      auth: 'apiKey', // dev.to list is mostly keyed — rank lower
      https: m[2].startsWith('https'),
      cors: 'unknown',
      sourceCategory: 'Development',
      source: 'dev.to',
    })
  }
}

// --- apimap index (gap detection — names we might be missing)
let apimapCount = 0
try {
  const res = await fetch('https://apimap.dev/api/index.json', {
    headers: { 'user-agent': 'shipapis-import/1.0 (+https://shipapis.dev/methodology)' },
  })
  if (res.ok) {
    const j = await res.json()
    for (const a of j.apis ?? []) {
      if (a.authType !== 'none' && a.authType !== 'no-auth') continue
      apimapCount++
      // apimap has no docs URL in slim index — skip add (name-only signal)
      if (!seedNames.has(a.name.toLowerCase())) {
        // leave as metadata; real URLs come from public-apis pool
      }
    }
  }
} catch { /* offline — fine */ }

const score = (r) =>
  (r.auth === 'none' ? 5 : r.auth === 'userAgent' ? 3 : 0) +
  (r.https ? 2 : 0) +
  (r.cors === 'yes' ? 1 : 0) +
  (r.docsCheck === 200 ? 2 : 0) +
  (r.source === 'public-apis' ? 1 : 0)

rows.sort((a, b) => score(b) - score(a))

if (CHECK) {
  let done = 0
  const queue = rows.filter((r) => r.auth === 'none').slice(0, 120)
  const check = async (r) => {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 6000)
    try {
      const res = await fetch(r.docsUrl, {
        signal: ctrl.signal,
        redirect: 'follow',
        headers: { 'user-agent': 'shipapisbot/1.0 (+https://shipapis.dev/methodology)' },
      })
      r.docsCheck = res.status
    } catch {
      r.docsCheck = 0
    } finally {
      clearTimeout(t)
      if (++done % 20 === 0) console.log(`  checked ${done}/${queue.length}`)
    }
  }
  const work = [...queue]
  await Promise.all(Array.from({ length: 16 }, async () => {
    for (let r; (r = work.shift()); ) await check(r)
  }))
}

const byAuth = Object.fromEntries(
  ['none', 'userAgent', 'apiKey', 'oauth'].map((a) => [a, rows.filter((r) => r.auth === a).length]),
)
writeFileSync(
  OUT,
  JSON.stringify(
    {
      meta: {
        sources: ['public-apis', 'dev.to', 'apimap-index-names'],
        apimapKeylessSeen: apimapCount,
        afterDedupe: rows.length,
        ...byAuth,
        checked: CHECK,
      },
      candidates: rows,
    },
    null,
    2,
  ) + '\n',
)
console.log(`wrote ${OUT} — ${rows.length} candidates (${byAuth.none ?? 0} keyless)`)
