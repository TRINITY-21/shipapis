// Discover API candidates from sources not yet merged into directory-candidates.json.
// run: node scripts/discover-extra-sources.mjs
//      node scripts/discover-extra-sources.mjs --write   # append to extra-candidates.json

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const WRITE = process.argv.includes('--write')
const OUT = fileURLToPath(new URL('./extra-candidates.json', import.meta.url))
const SEED = fileURLToPath(new URL('../src/data/seed.ts', import.meta.url))
const IMPORTED = fileURLToPath(new URL('../src/data/seed-imported.ts', import.meta.url))
const IMPORT_DIR = fileURLToPath(new URL('./import/', import.meta.url))
const UA = 'shipapis-import/1.0 (+https://shipapis.dev/methodology)'

const APIMAP_CAT = {
  ai: 'Machine Learning', payments: 'Business', search: 'Open Data', security: 'Security',
  ecommerce: 'Business', auth: 'Authentication', social: 'Social', communication: 'Social',
  weather: 'Weather', storage: 'Development', maps: 'Geocoding', finance: 'Finance',
  entertainment: 'Entertainment', developer: 'Development',
}

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

function mapAuth(raw) {
  if (!raw) return 'apiKey'
  const a = String(raw).toLowerCase()
  if (a === 'none' || a === 'no' || a === 'no-auth' || a === 'no auth') return 'none'
  if (a.includes('oauth')) return 'oauth'
  if (a.includes('user') && a.includes('agent')) return 'userAgent'
  return 'apiKey'
}

function mapCors(raw) {
  if (!raw) return 'unknown'
  const c = String(raw).toLowerCase()
  if (c === 'yes' || c === 'true') return 'yes'
  if (c === 'no' || c === 'false') return 'no'
  return 'unknown'
}

// --- known hosts from seed + batches ---
const known = new Set()
function registerUrl(url) {
  try {
    for (const a of hostAliases(new URL(url).hostname)) known.add(a)
  } catch { /* */ }
}

for (const f of [SEED, IMPORTED]) {
  const src = readFileSync(f, 'utf8')
  for (const m of src.matchAll(/(?:docsUrl|baseUrl): ['"](https?:\/\/[^/'"]+)/g)) registerUrl(m[1])
}

import { readdirSync } from 'node:fs'
for (const f of readdirSync(IMPORT_DIR).filter((x) => /^batch-\d+\.json$/.test(x))) {
  const j = JSON.parse(readFileSync(IMPORT_DIR + f, 'utf8'))
  for (const v of j.verified ?? []) {
    registerUrl(v.baseUrl)
    if (v.docsUrl) registerUrl(v.docsUrl)
  }
}

const rows = []
const seen = new Set()
const bySource = {}

function bumpSource(name) { bySource[name] = (bySource[name] ?? 0) + 1 }

function add(r, source) {
  if (!r?.name || !r?.docsUrl) return false
  let host
  try { host = hostKey(r.docsUrl) } catch { return false }
  if (!host || host === 'github.com' || host === 'raw.githubusercontent.com') return false
  const key = host + '|' + r.name.toLowerCase()
  if (seen.has(key)) return false
  seen.add(key)
  if (hostAliases(host).some((h) => known.has(h))) return false
  rows.push({
    name: r.name.trim(),
    docsUrl: r.docsUrl.trim(),
    description: (r.description ?? '').trim(),
    auth: mapAuth(r.auth),
    https: r.https !== false && r.docsUrl.startsWith('https'),
    cors: mapCors(r.cors),
    sourceCategory: r.sourceCategory ?? 'Development',
    source,
  })
  bumpSource(source)
  return true
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' } })
  if (!res.ok) throw new Error(`${url} → ${res.status}`)
  return res.json()
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA } })
  if (!res.ok) throw new Error(`${url} → ${res.status}`)
  return res.text()
}

// --- 1. public-api-lists (730+ curated, MIT) ---
try {
  const j = await fetchJson('https://public-api-lists.github.io/public-api-lists/api/all.json')
  for (const e of j.entries ?? []) {
    add({
      name: e.name,
      docsUrl: e.url,
      description: e.description,
      auth: e.auth,
      https: e.https,
      cors: e.cors,
      sourceCategory: e.category,
    }, 'public-api-lists')
  }
  console.log('public-api-lists:', j.count ?? j.entries?.length)
} catch (e) { console.warn('public-api-lists:', e.message) }

// --- 2. APIs.guru OpenAPI directory (~2500 providers) ---
try {
  const j = await fetchJson('https://api.apis.guru/v2/list.json')
  let n = 0
  for (const [, prov] of Object.entries(j)) {
    const ver = prov.versions?.[prov.preferred]
    if (!ver?.info) continue
    const info = ver.info
    const docs =
      info.contact?.url ||
      ver['x-origin']?.[0]?.url ||
      info['x-origin']?.[0]?.url ||
      (info['x-providerName'] ? `https://${info['x-providerName']}` : null)
    if (!docs) continue
    const cats = info['x-apisguru-categories'] ?? []
    add({
      name: info.title || prov.preferred,
      docsUrl: docs,
      description: (info.description ?? '').slice(0, 240),
      auth: 'apiKey',
      https: docs.startsWith('https'),
      sourceCategory: cats[0] ? cats[0].replace(/^\w/, (c) => c.toUpperCase()) : 'Development',
    }, 'apis.guru')
    n++
  }
  console.log('apis.guru scanned:', n)
} catch (e) { console.warn('apis.guru:', e.message) }

// --- 3. n0shake/Public-APIs README table ---
try {
  const md = await fetchText('https://raw.githubusercontent.com/n0shake/Public-APIs/master/README.md')
  // | API | Description | Auth | HTTPS | CORS | Link |
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
  console.log('n0shake from README tables')
} catch (e) { console.warn('n0shake:', e.message) }

// --- 4. Manavarya09/public-apis-live verified list (raw README sections) ---
try {
  const md = await fetchText('https://raw.githubusercontent.com/Manavarya09/public-apis-live/main/README.md')
  // Table rows: | [Name](URL) | Description | Auth | HTTPS | CORS |
  for (const m of md.matchAll(/\|\s*\[([^\]]+)\]\((https?:\/\/[^)]+)\)\s*\|\s*([^|]*)\|\s*([^|]*)\|\s*([^|]*)\|\s*([^|]*)\|/g)) {
    add({
      name: m[1].trim(),
      docsUrl: m[2].trim(),
      description: m[3].trim(),
      auth: m[4].trim(),
      https: m[5].trim().toLowerCase() === 'yes',
      cors: m[6].trim(),
      sourceCategory: 'Development',
    }, 'public-apis-live')
  }
  console.log('public-apis-live from README')
} catch (e) { console.warn('public-apis-live:', e.message) }

// --- 5. trottt/public-api-lists alternative / anylist.dev ---
try {
  const md = await fetchText('https://raw.githubusercontent.com/anylist-io/anylist-api/main/README.md')
  for (const m of md.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g)) {
    add({
      name: m[1].replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim(),
      docsUrl: m[2],
      auth: 'apiKey',
      sourceCategory: 'Development',
    }, 'anylist-api')
  }
} catch { /* optional */ }

// --- 6. public-api-lists per-category slices (thin categories) ---
const THIN_CAT_SLUGS = [
  'animals', 'security', 'cryptocurrency', 'dictionaries', 'transportation', 'vehicle',
  'finance', 'weather', 'science--math', 'books', 'games--comics', 'health', 'government',
  'disasters', 'fraud-prevention', 'anime', 'personality', 'geocoding',
]
for (const slug of THIN_CAT_SLUGS) {
  try {
    const j = await fetchJson(`https://public-api-lists.github.io/public-api-lists/api/${slug}.json`)
    for (const e of j.entries ?? j.apis ?? (Array.isArray(j) ? j : [])) {
      add({
        name: e.name,
        docsUrl: e.url,
        description: e.description,
        auth: e.auth,
        https: e.https,
        cors: e.cors,
        sourceCategory: e.category ?? slug,
      }, 'public-api-lists-cat')
    }
  } catch { /* category may not exist */ }
}

// --- 7. germanter/apiEngine (574 validated, machine JSON) ---
try {
  const j = await fetchJson('https://raw.githubusercontent.com/germanter/apiEngine/main/api.json')
  const apis = Array.isArray(j) ? j : (j.apis ?? j.data ?? [])
  for (const a of apis) {
    add({
      name: a.name,
      docsUrl: a.url || a.u,
      description: (a.desc || a.d || '').slice(0, 240),
      auth: a.auth ?? a.a,
      sourceCategory: a.category || a.c || 'Development',
    }, 'apiEngine')
  }
  console.log('apiEngine:', apis.length)
} catch (e) { console.warn('apiEngine:', e.message) }

// --- 8. AIPMAndy/FreeAPI (1092 APIs, structured JSON) ---
try {
  const j = await fetchJson('https://raw.githubusercontent.com/AIPMAndy/FreeAPI/main/apis.json')
  for (const [cat, list] of Object.entries(j.categories ?? {})) {
    for (const e of list) {
      add({
        name: e.name,
        docsUrl: e.url,
        description: e.description ?? '',
        auth: e.auth,
        https: e.https,
        cors: e.cors,
        sourceCategory: cat,
      }, 'aipmandy-freeapi')
    }
  }
  console.log('aipmandy-freeapi:', j.total ?? Object.values(j.categories ?? {}).flat().length)
} catch (e) { console.warn('aipmandy-freeapi:', e.message) }

// --- 9. spinov001-art no-auth curated lists ---
for (const [repo, source] of [
  ['spinov001-art/free-apis-list', 'spinov-free-apis-list'],
  ['spinov001-art/awesome-no-auth-apis', 'spinov-awesome-no-auth'],
]) {
  try {
    const md = await fetchText(`https://raw.githubusercontent.com/${repo}/main/README.md`)
    for (const m of md.matchAll(/\|\s*\[([^\]]+)\]\((https?:\/\/[^)]+)\)\s*\|\s*([^|]*)\|\s*([^|]*)\|\s*([^|`|]*)/g)) {
      add({
        name: m[1].trim(),
        docsUrl: m[2].trim(),
        description: m[3].trim(),
        auth: 'none',
        sourceCategory: 'Development',
      }, source)
    }
    console.log(source)
  } catch (e) { console.warn(source, e.message) }
}

// --- 10. FreeAPI.watch sitemap / known no-key page (scrape links) ---
try {
  const html = await fetchText('https://freeapi.watch/no-api-key')
  for (const m of html.matchAll(/href="(https?:\/\/[^"]+)"[^>]*>([^<]{3,80})</g)) {
    const url = m[1]
    if (/freeapi\.watch|twitter|github|cloudflare|google/i.test(url)) continue
    add({
      name: m[2].trim(),
      docsUrl: url,
      auth: 'none',
      sourceCategory: 'Development',
    }, 'freeapi.watch-no-key')
  }
  console.log('freeapi.watch no-key page')
} catch (e) { console.warn('freeapi.watch:', e.message) }

// --- 11. awesome-public-apis alternatives on GitHub ---
const AWESOME_REPOS = [
  'public-api-lists/public-api-lists',
  'abhishekbanthia/Public-APIs',
  'TonnyL/Awesome_APIs',
]
for (const repo of AWESOME_REPOS) {
  try {
    const md = await fetchText(`https://raw.githubusercontent.com/${repo}/master/README.md`)
    for (const m of md.matchAll(/\|\s*\[([^\]]+)\]\((https?:\/\/[^)]+)\)\s*\|\s*([^|]*)\|\s*([^|]*)\|\s*([^|]*)\|\s*([^|]*)\|/g)) {
      add({
        name: m[1].trim(),
        docsUrl: m[2].trim(),
        description: m[3].trim(),
        auth: m[4].trim(),
        https: m[5].trim().toLowerCase() === 'yes',
        cors: m[6].trim(),
        sourceCategory: 'Development',
      }, `awesome:${repo.split('/')[1]}`)
    }
  } catch { /* repo may not exist or differ format */ }
}

// --- 12. Merge existing directory-candidates NOT in seed (for reporting overlap) ---
const dirPath = fileURLToPath(new URL('./directory-candidates.json', import.meta.url))
if (existsSync(dirPath)) {
  const dir = JSON.parse(readFileSync(dirPath, 'utf8')).candidates ?? []
  for (const c of dir) add({ ...c }, 'directory-candidates-residual')
}

const score = (r) =>
  (r.auth === 'none' ? 5 : r.auth === 'userAgent' ? 3 : 0) +
  (r.https ? 2 : 0) +
  (r.cors === 'yes' ? 1 : 0) +
  (r.description?.length > 20 ? 1 : 0)

rows.sort((a, b) => score(b) - score(a))

const byAuth = Object.fromEntries(
  ['none', 'userAgent', 'apiKey', 'oauth'].map((a) => [a, rows.filter((r) => r.auth === a).length]),
)

const payload = {
  meta: {
    discoveredAt: new Date().toISOString(),
    sources: Object.keys(bySource),
    ingestedBySource: bySource,
    netNew: rows.length,
    knownHosts: known.size,
    ...byAuth,
  },
  candidates: rows,
}

if (WRITE) {
  writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n')
  console.log(`\nwrote ${OUT}`)
} else {
  writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n')
}

console.log(`\n=== DISCOVERY SUMMARY ===`)
console.log(`Net-new candidates: ${rows.length}`)
console.log(`  keyless (none): ${byAuth.none ?? 0}`)
console.log(`  userAgent: ${byAuth.userAgent ?? 0}`)
console.log(`  apiKey: ${byAuth.apiKey ?? 0}`)
console.log(`  oauth: ${byAuth.oauth ?? 0}`)
console.log('By source:', bySource)
console.log('\nTop 30 keyless:')
for (const r of rows.filter((x) => x.auth === 'none').slice(0, 30)) {
  console.log(`  • ${r.name} — ${r.docsUrl} [${r.source}]`)
}
