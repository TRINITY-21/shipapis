// Mine apis.guru OpenAPI specs for keyless GET endpoints, probe live, emit batch files.
// run: node scripts/probe-openapi-guru.mjs [--limit 800] [--from-batch 45]

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  probeUrl, slugify, trimJson, isPostmanCollection, emojiFor, writeCopy, UA,
} from './lib/probe-utils.mjs'

const LIMIT = Number(process.argv.find((a, i) => process.argv[i - 1] === '--limit') || '600')
const FROM_BATCH = Number(process.argv.find((a, i) => process.argv[i - 1] === '--from-batch') || '45')
const BATCH_SIZE = 25
const CONCURRENCY = 10
const UA_HDR = { 'user-agent': UA, accept: 'application/json' }

const IMPORT_DIR = fileURLToPath(new URL('./import/', import.meta.url))
const SEED = fileURLToPath(new URL('../src/data/seed.ts', import.meta.url))
const IMPORTED = fileURLToPath(new URL('../src/data/seed-imported.ts', import.meta.url))

function hostAliases(host) {
  const h = host.replace(/^www\./, '')
  const out = new Set([h])
  if (h.startsWith('api.')) out.add(h.slice(4))
  else out.add(`api.${h}`)
  return [...out]
}

function registerKnown(set, url) {
  try {
    for (const a of hostAliases(new URL(url).hostname)) set.add(a)
  } catch { /* */ }
}

const known = new Set()
for (const f of [SEED, IMPORTED]) {
  const src = readFileSync(f, 'utf8')
  for (const m of src.matchAll(/(?:docsUrl|baseUrl)"?\s*:\s*["'](https?:\/\/[^/"']+)/g)) registerKnown(known, m[1])
}
for (const f of readdirSync(IMPORT_DIR).filter((x) => /^batch-\d+\.json$/.test(x))) {
  for (const v of JSON.parse(readFileSync(IMPORT_DIR + f, 'utf8')).verified ?? []) {
    registerKnown(known, v.baseUrl)
  }
}

function hostsKnown(url) {
  try {
    return hostAliases(new URL(url).hostname).some((h) => known.has(h))
  } catch { return true }
}

function pickGetPath(spec) {
  const paths = spec.paths || {}
  for (const [path, ops] of Object.entries(paths)) {
    const get = ops.get || ops.GET
    if (!get) continue
    if (get.security?.length) continue
    if (spec.security?.length && get.security !== []) continue
    if (/\{[^}]+\}/.test(path)) {
      // substitute simple path params
      const filled = path.replace(/\{[^}]+\}/g, (p) => {
        const n = p.slice(1, -1).toLowerCase()
        if (n.includes('id')) return '1'
        if (n.includes('name')) return 'test'
        if (n.includes('code')) return 'US'
        return '1'
      })
      return filled
    }
    return path
  }
  return null
}

function serverUrl(spec) {
  if (spec.servers?.[0]?.url) {
    let u = spec.servers[0].url.replace(/\/+$/, '')
    if (u.startsWith('//')) u = 'https:' + u
    if (u.startsWith('/')) return null
    return u
  }
  const origin = spec['x-origin']?.[0]?.url
  if (origin?.startsWith('http')) {
    try { return new URL(origin).origin } catch { /* */ }
  }
  return null
}

const listRes = await fetch('https://api.apis.guru/v2/list.json', { headers: UA_HDR })
const list = await listRes.json()
const providers = Object.entries(list).slice(0, LIMIT * 3)
console.log(`apis.guru providers to scan: ${providers.length}`)

const queue = []
for (const [key, prov] of providers) {
  if (queue.length >= LIMIT) break
  const ver = prov.versions?.[prov.preferred]
  if (!ver?.link) continue
  queue.push({ key, link: ver.link, title: ver.info?.title || key, desc: ver.info?.description || '', cats: ver.info?.['x-apisguru-categories'] || [] })
}

const verified = []
let batchNo = FROM_BATCH
let batchVerified = []

function flush() {
  if (!batchVerified.length) return
  const p = `${IMPORT_DIR}batch-${String(batchNo).padStart(2, '0')}.json`
  writeFileSync(p, JSON.stringify({ batch: batchNo, verified: batchVerified, skipped: [] }, null, 2) + '\n')
  console.log(`  → ${p} (${batchVerified.length})`)
  batchNo++
  batchVerified = []
}

async function processOne(item) {
  try {
    const specRes = await fetch(item.link, { headers: UA_HDR, signal: AbortSignal.timeout(8000) })
    if (!specRes.ok) return
    const spec = await specRes.json()
    const base = serverUrl(spec)
    const path = pickGetPath(spec)
    if (!base || !path) return
    if (hostsKnown(base)) return

    const url = base.replace(/\/+$/, '') + (path.startsWith('/') ? path : '/' + path)
    const r = await probeUrl(url)
    if (r.httpStatus !== 200 || !r.json || isPostmanCollection(r.json)) return

    registerKnown(known, base)
    const u = new URL(url)
    const entry = {
      name: item.title.slice(0, 60),
      slug: slugify(item.title),
      emoji: emojiFor(item.cats[0] || 'Development'),
      tagline: `${item.title.slice(0, 40)} — OpenAPI-verified GET`,
      description: `${item.title} discovered via apis.guru OpenAPI directory. We probed a documented GET route and received JSON (${item.cats[0] || 'general'}). Review provider terms before production.`,
      sourceCategory: item.cats[0] ? item.cats[0].replace(/^\w/, (c) => c.toUpperCase()) : 'Development',
      docsUrl: spec.info?.contact?.url || item.link,
      baseUrl: `${u.protocol}//${u.host}`,
      sampleEndpoint: u.pathname + u.search,
      latencyMs: r.latencyMs,
      corsObserved: r.corsObserved,
      httpStatus: 200,
      sampleJson: trimJson(r.json),
      freeTier: 'Free — limits not published',
      rateLimit: 'Unpublished',
      dataLicense: 'Unverified',
      commercialUse: 'unclear',
      notes: `apis.guru ${item.key}; probed ${url}`,
    }
    verified.push(entry)
    batchVerified.push(entry)
    process.stdout.write(`  ✓ ${entry.slug}\n`)
    if (batchVerified.length >= BATCH_SIZE) flush()
  } catch { /* skip */ }
}

const work = [...queue]
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  for (let item; (item = work.shift()); ) await processOne(item)
}))
flush()

console.log(`\ndone: ${verified.length} verified from apis.guru`)
