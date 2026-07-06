// Probe apis.guru OpenAPI specs for keyless GET JSON endpoints — high-yield scale path.
//
// run:  node scripts/probe-apis-guru.mjs
//       node scripts/probe-apis-guru.mjs --from-batch 45 --limit 800 --concurrency 16

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  UA,
  emojiFor,
  isPostmanCollection,
  slugify,
  splitBaseAndEndpoint,
  trimJson,
  writeCopy,
} from './lib/probe-utils.mjs'

const IMPORT_DIR = fileURLToPath(new URL('./import/', import.meta.url))
const SEED = fileURLToPath(new URL('../src/data/seed.ts', import.meta.url))
const IMPORTED = fileURLToPath(new URL('../src/data/seed-imported.ts', import.meta.url))

const FROM_BATCH = Number(process.argv.find((a, i) => process.argv[i - 1] === '--from-batch') || '45')
const LIMIT = Number(process.argv.find((a, i) => process.argv[i - 1] === '--limit') || '600')
const CONCURRENCY = Number(process.argv.find((a, i) => process.argv[i - 1] === '--concurrency') || '14')
const BATCH_SIZE = 25

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
const doneHosts = new Set()
for (const m of seedSrc.matchAll(/(?:docsUrl|baseUrl)"?\s*:\s*["'](https?:\/\/[^/"']+)/g)) {
  try {
    for (const a of hostAliases(new URL(m[1]).hostname)) doneHosts.add(a)
  } catch { /* */ }
}
for (const f of readdirSync(IMPORT_DIR).filter((x) => /^batch-\d+\.json$/.test(x))) {
  const j = JSON.parse(readFileSync(IMPORT_DIR + f, 'utf8'))
  for (const v of j.verified ?? []) {
    try {
      for (const a of hostAliases(new URL(v.baseUrl).hostname)) doneHosts.add(a)
    } catch { /* */ }
  }
}

function hostsKnown(url) {
  const h = hostKey(url)
  return hostAliases(h).some((a) => doneHosts.has(a))
}

function registerHost(url) {
  for (const a of hostAliases(hostKey(url))) doneHosts.add(a)
}

function operationIsKeyless(get, spec) {
  if (Array.isArray(get.security) && get.security.length === 0) return true
  if (get.security?.length) return false
  return !(spec.security?.length)
}

function pickGetPaths(spec) {
  const out = []
  for (const [path, methods] of Object.entries(spec.paths ?? {})) {
    const get = methods.get ?? methods.GET
    if (!get || !operationIsKeyless(get, spec)) continue
    const params = get.parameters ?? []
    const required = params.filter((p) => p.required && p.in !== 'header')
    if (required.some((p) => p.in === 'path' && !String(path).includes('{'))) continue
    if (required.length > 2) continue
    out.push(path)
    if (out.length >= 6) break
  }
  return out
}

function fillPath(path) {
  return path.replace(/\{[^}]+\}/g, (m) => {
    const k = m.slice(1, -1).toLowerCase()
    if (k.includes('id')) return '1'
    if (k.includes('uuid')) return '00000000-0000-0000-0000-000000000001'
    if (k.includes('name')) return 'test'
    if (k.includes('code')) return 'us'
    return '1'
  })
}

function servers(spec) {
  const s = (spec.servers ?? []).map((x) => x.url).filter(Boolean)
  if (s.length) return s
  if (spec.host) {
    const scheme = (spec.schemes ?? ['https'])[0]
    return [`${scheme}://${spec.host}${spec.basePath ?? ''}`]
  }
  return []
}

async function probeUrl(url) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 9000)
  const t0 = performance.now()
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'user-agent': UA, accept: 'application/json, */*' },
    })
    const text = await res.text()
    let json = null
    try { json = JSON.parse(text) } catch { /* */ }
    return {
      httpStatus: res.status,
      latencyMs: Math.round(performance.now() - t0),
      json,
      corsObserved: !!res.headers.get('access-control-allow-origin'),
    }
  } catch {
    return { httpStatus: 0, json: null, latencyMs: 0, corsObserved: null }
  } finally {
    clearTimeout(t)
  }
}

async function verifyProvider(provider, meta) {
  const versions = Object.keys(meta.versions ?? {})
  if (!versions.length) return null
  const ver = versions[versions.length - 1]
  const swaggerUrl = meta.versions[ver]?.swaggerUrl
  if (!swaggerUrl) return null

  let spec
  try {
    const res = await fetch(swaggerUrl, { headers: { 'user-agent': UA, accept: 'application/json' } })
    if (!res.ok) return null
    spec = await res.json()
  } catch { return null }

  const paths = pickGetPaths(spec)
  if (!paths.length) return null
  const title = spec.info?.title || provider
  const docsUrl = spec.externalDocs?.url || swaggerUrl.replace(/swagger\.json.*/, '') || swaggerUrl

  for (const server of servers(spec)) {
    if (!server.startsWith('http')) continue
    let base
    try { base = new URL(server) } catch { continue }
    if (hostsKnown(base.origin)) return null

    for (const rawPath of paths) {
      const path = fillPath(rawPath)
      let url
      try { url = new URL(path, server.endsWith('/') ? server : server + '/').href } catch { continue }
      if (url.includes('{')) continue
      const r = await probeUrl(url)
      if (r.httpStatus !== 200 || r.json == null || isPostmanCollection(r.json)) continue
      const split = splitBaseAndEndpoint(url)
      if (!split) continue
      const copy = writeCopy({ name: title, description: spec.info?.description ?? '', sourceCategory: 'Development' })
      return {
        name: title.slice(0, 80),
        slug: slugify(title),
        emoji: emojiFor('Development'),
        tagline: copy.tagline,
        description: copy.description,
        sourceCategory: 'Development',
        docsUrl,
        baseUrl: split.baseUrl,
        sampleEndpoint: split.sampleEndpoint,
        latencyMs: r.latencyMs,
        corsObserved: r.corsObserved,
        httpStatus: 200,
        sampleJson: trimJson(r.json),
        freeTier: 'Free — limits not published',
        rateLimit: 'Unpublished',
        dataLicense: 'Unverified',
        commercialUse: 'unclear',
        notes: `apis.guru ${provider} ${ver} ${url}`,
      }
    }
  }
  return null
}

console.log('fetching apis.guru catalog…')
const listRes = await fetch('https://api.apis.guru/v2/list.json', { headers: { 'user-agent': UA } })
if (!listRes.ok) throw new Error(`list.json HTTP ${listRes.status}`)
const list = await listRes.json()

const providers = Object.entries(list)
  .filter(([provider]) => !provider.includes('localhost'))
  .slice(0, LIMIT)

console.log(`probing ${providers.length} OpenAPI providers (${CONCURRENCY} concurrent)`)

let batchNo = FROM_BATCH
let batchVerified = []
const verified = []

function flushBatch() {
  if (!batchVerified.length) return
  const outPath = `${IMPORT_DIR}batch-${String(batchNo).padStart(2, '0')}.json`
  writeFileSync(outPath, JSON.stringify({ batch: batchNo, verified: batchVerified, skipped: [] }, null, 2) + '\n')
  console.log(`  → wrote ${outPath} (${batchVerified.length} verified)`)
  batchNo++
  batchVerified = []
}

const queue = [...providers]
async function worker() {
  for (let item; (item = queue.shift()); ) {
    const [provider, meta] = item
    const entry = await verifyProvider(provider, meta)
    if (!entry) continue
    if (hostsKnown(entry.baseUrl)) continue
    registerHost(entry.baseUrl)
    verified.push(entry)
    batchVerified.push(entry)
    process.stdout.write(`  ✓ ${entry.slug}\n`)
    if (batchVerified.length >= BATCH_SIZE) flushBatch()
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))
flushBatch()

console.log(`\ndone: ${verified.length} verified from apis.guru`)
console.log('next: npm run seed:assemble')
