// Merge API candidates from every directory the user listed, dedupe against the live seed.
//
// Sources:
//   • scripts/candidates.json          — MIT public-apis/public-apis README
//   • https://free-apis.github.io      — via cached scripts/import/src-freeapis-publicapis.json
//   • https://publicapis.io            — same cache (scraped together)
//   • https://www.freepublicapis.com/  — live /api/apis
//   • https://apimap.dev/              — live /api/apis.json
//   • https://freeapihub.com/apis      — cached scripts/import/freeapihub-scraped.json (run seed:candidates:freeapihub)
//   • https://freeapihub.com           — legacy cache scripts/import/src-freeapihub-devto.json
//   • https://freeapi.watch/api/       — cached scripts/import/freeapiwatch-scraped.json (run seed:candidates:freeapiwatch)
//   • dev.to 100+ APIs list            — markdown file or cached hub JSON
//
// run:  node scripts/fetch-directory-sources.mjs
//       node scripts/fetch-directory-sources.mjs --check   # live-check docs links (slow)

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const CHECK = process.argv.includes('--check')
const OUT = fileURLToPath(new URL('./directory-candidates.json', import.meta.url))
const IMPORT_DIR = fileURLToPath(new URL('./import/', import.meta.url))
const SEED = fileURLToPath(new URL('../src/data/seed.ts', import.meta.url))
const IMPORTED = fileURLToPath(new URL('../src/data/seed-imported.ts', import.meta.url))
const CANDIDATES = fileURLToPath(new URL('./candidates.json', import.meta.url))
const DEVTO_DEFAULT = fileURLToPath(
  new URL('../../.cursor/projects/Users-ghost-Documents-APIs/uploads/100-free-apis-for-developers-in-2024-1jfi-1.md', import.meta.url),
)

const APIMAP_CAT = {
  ai: 'Machine Learning',
  payments: 'Business',
  search: 'Open Data',
  security: 'Security',
  ecommerce: 'Business',
  auth: 'Authentication',
  social: 'Social',
  communication: 'Social',
  weather: 'Weather',
  storage: 'Development',
  maps: 'Geocoding',
  finance: 'Finance',
  entertainment: 'Entertainment',
  developer: 'Development',
}

const UA = 'shipapis-import/1.0 (+https://shipapis.dev/methodology)'

function hostKey(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

function hostAliases(host) {
  const h = host.replace(/^www\./, '')
  const out = new Set([h])
  if (h.startsWith('api.')) out.add(h.slice(4))
  else out.add(`api.${h}`)
  return [...out]
}

const seedSrc = readFileSync(SEED, 'utf8') + readFileSync(IMPORTED, 'utf8')
const seedHosts = new Set()
for (const m of seedSrc.matchAll(/(?:docsUrl|baseUrl): '(https?:\/\/[^/']+)/g)) {
  try {
    for (const a of hostAliases(new URL(m[1]).hostname)) seedHosts.add(a)
  } catch { /* */ }
}

function hostsKnown(urlOrHost) {
  const h = urlOrHost.includes('://') ? hostKey(urlOrHost) : urlOrHost.replace(/^www\./, '')
  return hostAliases(h).some((a) => seedHosts.has(a))
}

const rows = []
const seen = new Set()
const bySource = {}

function bumpSource(name) {
  bySource[name] = (bySource[name] ?? 0) + 1
}

function mapAuth(raw) {
  if (!raw) return 'apiKey'
  const a = String(raw).toLowerCase()
  if (a === 'none' || a === 'no' || a === 'no-auth' || a === 'no auth') return 'none'
  if (a.includes('oauth')) return 'oauth'
  if (a.includes('user') && a.includes('agent')) return 'userAgent'
  return 'apiKey'
}

function add(r, source) {
  if (!r?.name || !r?.docsUrl) return
  let host
  try { host = hostKey(r.docsUrl) } catch { return }
  if (!host) return
  const key = host + '|' + r.name.toLowerCase()
  if (seen.has(key) || hostsKnown(host)) return
  seen.add(key)
  rows.push({
    name: r.name.trim(),
    docsUrl: r.docsUrl.trim(),
    description: (r.description ?? '').trim(),
    auth: mapAuth(r.auth),
    https: r.https !== false && r.docsUrl.startsWith('https'),
    cors: r.cors ?? 'unknown',
    sourceCategory: r.sourceCategory ?? 'Development',
    source,
    docsCheck: r.docsCheck,
  })
  bumpSource(source)
}

// --- 1. public-apis (primary) ---
const pool = JSON.parse(readFileSync(CANDIDATES, 'utf8'))
for (const c of pool.candidates) {
  add({ ...c, source: 'public-apis' }, 'public-apis')
}

// --- 2b. cached publicapis.io scrape (run seed:candidates:publicapis-io) ---
const cachedPio = fileURLToPath(new URL('./import/publicapis-io-scraped.json', import.meta.url))
if (existsSync(cachedPio)) {
  const j = JSON.parse(readFileSync(cachedPio, 'utf8'))
  for (const a of j.apis ?? []) {
    add({
      name: a.name,
      docsUrl: a.docsUrl,
      description: a.description ?? '',
      auth: a.auth === 'unknown' ? 'apiKey' : a.auth,
      https: a.docsUrl?.startsWith('https'),
      sourceCategory: a.sourceCategory ?? 'Development',
    }, 'publicapis.io')
  }
}

// --- 2. cached free-apis.github.io + publicapis.io ---
const cachedFreeApis = fileURLToPath(new URL('./import/src-freeapis-publicapis.json', import.meta.url))
if (existsSync(cachedFreeApis)) {
  const j = JSON.parse(readFileSync(cachedFreeApis, 'utf8'))
  for (const c of j.candidates ?? []) {
    add({ ...c, https: c.docsUrl?.startsWith('https') }, 'free-apis.github.io')
  }
}

// --- 3. cached freeapihub.com/apis scrape (run seed:candidates:freeapihub) ---
const cachedFah = fileURLToPath(new URL('./import/freeapihub-scraped.json', import.meta.url))
if (existsSync(cachedFah)) {
  const j = JSON.parse(readFileSync(cachedFah, 'utf8'))
  for (const a of j.apis ?? []) {
    add({
      name: a.name,
      docsUrl: a.docsUrl,
      description: a.description ?? '',
      auth: a.auth ?? 'apiKey',
      https: a.docsUrl?.startsWith('https'),
      sourceCategory: a.sourceCategory ?? a.fahCategory ?? 'Development',
    }, 'freeapihub.com')
  }
}

// --- 3a. cached freeapi.watch JSON API (run seed:candidates:freeapiwatch) ---
const cachedFaw = fileURLToPath(new URL('./import/freeapiwatch-scraped.json', import.meta.url))
if (existsSync(cachedFaw)) {
  const j = JSON.parse(readFileSync(cachedFaw, 'utf8'))
  for (const a of j.apis ?? []) {
    add({
      name: a.name,
      docsUrl: a.docsUrl,
      description: a.description ?? '',
      auth: a.auth ?? 'apiKey',
      https: a.docsUrl?.startsWith('https'),
      sourceCategory: a.sourceCategory ?? 'Open Data',
    }, 'freeapi.watch')
  }
}

// --- 3b. legacy freeapihub + dev.to extras ---
const cachedHub = fileURLToPath(new URL('./import/src-freeapihub-devto.json', import.meta.url))
if (existsSync(cachedHub)) {
  const j = JSON.parse(readFileSync(cachedHub, 'utf8'))
  for (const c of j.candidates ?? []) {
    add({ ...c, https: c.docsUrl?.startsWith('https') }, 'freeapihub.com-legacy')
  }
}

// --- 4. cached freepublicapis + apimap scrape (fallback) ---
const cachedFpa = fileURLToPath(new URL('./import/src-freepublicapis-apimap.json', import.meta.url))
if (existsSync(cachedFpa)) {
  const j = JSON.parse(readFileSync(cachedFpa, 'utf8'))
  for (const c of j.candidates ?? []) {
    add({ ...c, https: c.docsUrl?.startsWith('https') }, 'freepublicapis.com-cache')
  }
}

// --- 5. live + cached freepublicapis.com (tags/all catalog) ---
const cachedFpaLive = fileURLToPath(new URL('./import/freepublicapis-scraped.json', import.meta.url))
if (existsSync(cachedFpaLive)) {
  const j = JSON.parse(readFileSync(cachedFpaLive, 'utf8'))
  for (const a of j.apis ?? []) {
    add({
      name: a.name,
      docsUrl: a.docsUrl,
      description: a.description ?? '',
      auth: 'none',
      https: a.docsUrl?.startsWith('https'),
      sourceCategory: a.sourceCategory ?? 'Open Data',
    }, 'freepublicapis.com')
  }
} else {
  try {
    const res = await fetch('https://www.freepublicapis.com/api/apis?limit=5000', {
      headers: { 'user-agent': UA, accept: 'application/json' },
    })
    if (res.ok) {
      const list = await res.json()
      for (const a of list) {
        add({
          name: a.title,
          docsUrl: a.documentation || a.source,
          description: a.description ?? '',
          auth: 'none',
          https: (a.documentation || a.source || '').startsWith('https'),
          sourceCategory: 'Open Data',
        }, 'freepublicapis.com')
      }
    }
  } catch (e) {
    console.warn('freepublicapis fetch failed:', e.message)
  }
}

// --- 6. live apimap.dev full dataset ---
try {
  const res = await fetch('https://apimap.dev/api/apis.json', {
    headers: { 'user-agent': UA, accept: 'application/json' },
  })
  if (res.ok) {
    const j = await res.json()
    for (const a of j.apis ?? []) {
      const docs = a.docsUrl || a.baseUrl
      if (!docs) continue
      add({
        name: a.name,
        docsUrl: docs,
        description: a.description ?? a.longDescription ?? '',
        auth: a.authType,
        https: docs.startsWith('https'),
        sourceCategory: APIMAP_CAT[a.category] ?? 'Development',
      }, 'apimap.dev')
    }
  }
} catch (e) {
  console.warn('apimap fetch failed:', e.message)
}

// --- 7. awesome-no-auth-apis curated list ---
const awesomePath = fileURLToPath(new URL('./import/src-awesome-no-auth-apis.md', import.meta.url))
if (existsSync(awesomePath)) {
  const md = readFileSync(awesomePath, 'utf8')
  for (const m of md.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g)) {
    const name = m[1].replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim()
    if (!name || /python client|via /i.test(name)) continue
    add({
      name,
      docsUrl: m[2],
      description: '',
      auth: 'none',
      https: m[2].startsWith('https'),
      sourceCategory: 'Development',
    }, 'awesome-no-auth-apis')
  }
}

// --- 8. public-api-lists JSON (730+ curated, MIT) ---
try {
  const res = await fetch('https://public-api-lists.github.io/public-api-lists/api/all.json', {
    headers: { 'user-agent': UA, accept: 'application/json' },
  })
  if (res.ok) {
    const j = await res.json()
    for (const e of j.entries ?? []) {
      add({
        name: e.name,
        docsUrl: e.url,
        description: e.description ?? '',
        auth: e.auth,
        https: e.https,
        cors: e.cors,
        sourceCategory: e.category,
      }, 'public-api-lists')
    }
  }
} catch (e) {
  console.warn('public-api-lists fetch failed:', e.message)
}

// --- 9. n0shake/Public-APIs README table ---
try {
  const res = await fetch('https://raw.githubusercontent.com/n0shake/Public-APIs/master/README.md', {
    headers: { 'user-agent': UA },
  })
  if (res.ok) {
    const md = await res.text()
    for (const m of md.matchAll(/\|\s*\[([^\]]+)\]\((https?:\/\/[^)]+)\)\s*\|\s*([^|]*)\|\s*([^|]*)\|\s*([^|]*)\|\s*([^|]*)\|/g)) {
      add({
        name: m[1].trim(),
        docsUrl: m[2].trim(),
        description: m[3].trim(),
        auth: m[4].trim(),
        https: m[5].trim().toLowerCase() === 'yes',
        cors: m[6].trim(),
        sourceCategory: 'Development',
      }, 'n0shake-public-apis')
    }
  }
} catch (e) {
  console.warn('n0shake fetch failed:', e.message)
}

// --- 10. dev.to markdown links ---
const devtoPath = process.env.DEVTO_MD || DEVTO_DEFAULT
if (existsSync(devtoPath)) {
  const md = readFileSync(devtoPath, 'utf8')
  for (const m of md.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g)) {
    const name = m[1].replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim()
    add({
      name,
      docsUrl: m[2],
      description: '',
      auth: 'apiKey',
      https: m[2].startsWith('https'),
      sourceCategory: 'Development',
    }, 'dev.to')
  }
}

const score = (r) =>
  (r.auth === 'none' ? 5 : r.auth === 'userAgent' ? 3 : 0) +
  (r.https ? 2 : 0) +
  (r.cors === 'yes' ? 1 : 0) +
  (r.docsCheck === 200 ? 2 : 0) +
  (r.source === 'public-apis' ? 1 : 0)

rows.sort((a, b) => score(b) - score(a))

if (CHECK) {
  let done = 0
  const queue = rows.filter((r) => r.auth === 'none').slice(0, 200)
  const check = async (r) => {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 6000)
    try {
      const res = await fetch(r.docsUrl, {
        signal: ctrl.signal,
        redirect: 'follow',
        headers: { 'user-agent': UA },
      })
      r.docsCheck = res.status
    } catch {
      r.docsCheck = 0
    } finally {
      clearTimeout(t)
      if (++done % 25 === 0) console.log(`  checked ${done}/${queue.length}`)
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
        sources: [
          'public-apis',
          'free-apis.github.io',
          'publicapis.io',
          'freepublicapis.com',
          'apimap.dev',
          'freeapihub.com',
          'awesome-no-auth-apis',
          'public-api-lists',
          'n0shake-public-apis',
          'dev.to',
        ],
        ingestedBySource: bySource,
        afterDedupe: rows.length,
        skippedSeedHosts: seedHosts.size,
        ...byAuth,
        checked: CHECK,
      },
      candidates: rows,
    },
    null,
    2,
  ) + '\n',
)

console.log(`wrote ${OUT}`)
console.log(`  ${rows.length} candidates (${byAuth.none ?? 0} keyless)`)
console.log('  by source:', bySource)
