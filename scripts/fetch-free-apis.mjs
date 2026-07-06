// Refresh the Free-APIs.github.io browse catalog.
// https://free-apis.github.io/#/browse loads from api.publicapis.org (dead) — we mirror the
// underlying MIT lists directly: public-apis/public-apis + public-apis-dev/public-apis.
//
// run:  node scripts/fetch-free-apis.mjs
//       node scripts/fetch-free-apis.mjs --no-auth-only    # gap report: keyless only
//       node scripts/fetch-free-apis.mjs --write-batch     # queue top 50 keyless gaps
//       node scripts/fetch-free-apis.mjs --merge-directories

import { spawnSync } from 'node:child_process'
import { readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadSeedIndex } from './lib/apimap-gap.mjs'
import { hostKey, slugify } from './lib/publicapis-io.mjs'

const args = process.argv.slice(2).filter((a) => !a.startsWith('#'))
const MERGE = args.includes('--merge-directories')
const NO_AUTH_ONLY = args.includes('--no-auth-only')
const WRITE_BATCH = args.includes('--write-batch')

const OUT = fileURLToPath(new URL('./import/src-freeapis-publicapis.json', import.meta.url))
const GAP_OUT = fileURLToPath(new URL('./import/free-apis-gaps.json', import.meta.url))
const IMPORT_DIR = fileURLToPath(new URL('./import/', import.meta.url))
const SEED = fileURLToPath(new URL('../src/data/seed.ts', import.meta.url))
const IMPORTED = fileURLToPath(new URL('../src/data/seed-imported.ts', import.meta.url))
const UA = 'shipapis-import/1.0 (+https://shipapis.dev/methodology)'

const SOURCES = [
  { repo: 'public-apis/public-apis', branch: 'master', label: 'public-apis' },
  { repo: 'public-apis-dev/public-apis', branch: 'main', label: 'public-apis-dev' },
]

const { PROBE_HINTS } = await import('./lib/probe-hints.mjs')

function mapAuth(raw) {
  const auth = String(raw ?? 'No').replace(/`/g, '').trim()
  if (/^no$/i.test(auth)) return 'none'
  if (/user-?agent/i.test(auth)) return 'userAgent'
  if (/oauth/i.test(auth)) return 'oauth'
  return 'apiKey'
}

function mapCors(raw) {
  const c = String(raw ?? '').trim()
  if (/^yes$/i.test(c)) return 'yes'
  if (/^no$/i.test(c)) return 'no'
  return 'unknown'
}

function parseReadme(md, sourceLabel) {
  const rows = []
  let category = null
  for (const line of md.split('\n')) {
    const h = line.match(/^### (.+)/)
    if (h) { category = h[1].trim(); continue }
    if (!category || !line.startsWith('|')) continue
    const cells = line.split('|').map((c) => c.trim())
    const link = cells[1]?.match(/^\[(.+?)\]\((.+?)\)$/)
    if (!link) continue
    rows.push({
      name: link[1],
      docsUrl: link[2],
      description: cells[2] ?? '',
      auth: mapAuth(cells[3]),
      https: /^yes$/i.test(cells[4] ?? ''),
      cors: mapCors(cells[5]),
      sourceCategory: category,
      source: sourceLabel,
    })
  }
  return rows
}

async function fetchReadme(repo, branch) {
  const commitRes = await fetch(`https://api.github.com/repos/${repo}/commits/${branch}`, {
    headers: { 'user-agent': UA, accept: 'application/vnd.github+json' },
  })
  if (!commitRes.ok) throw new Error(`${repo} commit lookup: HTTP ${commitRes.status}`)
  const commit = (await commitRes.json()).sha
  const mdRes = await fetch(`https://raw.githubusercontent.com/${repo}/${commit}/README.md`, {
    headers: { 'user-agent': UA },
  })
  if (!mdRes.ok) throw new Error(`${repo} README: HTTP ${mdRes.status}`)
  return { commit, md: await mdRes.text() }
}

function findHint(c) {
  const hay = `${c.name} ${c.docsUrl} ${c.description}`
  for (const h of PROBE_HINTS) {
    if (h.match.test(hay)) return h
  }
  return null
}

function toProbeCandidate(r) {
  const hint = findHint(r)
  return {
    slug: slugify(r.name),
    name: r.name,
    emoji: hint?.emoji ?? '🔌',
    tagline: (r.description || '').slice(0, 80),
    description: r.description || '',
    sourceCategory: r.sourceCategory,
    docsUrl: r.docsUrl,
    baseUrl: hint?.baseUrl?.replace(/\/+$/, '') ?? r.docsUrl.replace(/\/+$/, ''),
    sampleEndpoint: hint?.sampleEndpoint?.startsWith('/')
      ? hint.sampleEndpoint
      : hint?.sampleEndpoint
        ? `/${hint.sampleEndpoint}`
        : '/',
    auth: r.auth,
    https: r.https,
    cors: r.cors,
    source: 'free-apis.github.io',
    upstream: r.source,
  }
}

function haveRow(row, seedIndex) {
  const host = hostKey(row.docsUrl || row.baseUrl)
  if (!host) return false
  if (seedIndex.seedSlugs.has(row.slug)) return true
  return [...seedIndex.seedHosts].some((h) => host === h || host.endsWith(h) || h.endsWith(host))
}

const all = []
const meta = { sources: [] }
const seen = new Set()

for (const src of SOURCES) {
  try {
    const { commit, md } = await fetchReadme(src.repo, src.branch)
    const rows = parseReadme(md, src.label)
    let added = 0
    for (const r of rows) {
      let host
      try { host = new URL(r.docsUrl).hostname.replace(/^www\./, '') } catch { continue }
      const key = host + '|' + r.name.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      all.push(r)
      added++
    }
    meta.sources.push({ repo: src.repo, commit, parsed: rows.length, added })
    console.log(`${src.label}: ${rows.length} parsed, ${added} new`)
  } catch (e) {
    console.warn(`${src.label}: ${e.message}`)
    meta.sources.push({ repo: src.repo, error: e.message })
  }
}

const byAuth = Object.fromEntries(
  ['none', 'userAgent', 'apiKey', 'oauth'].map((a) => [a, all.filter((r) => r.auth === a).length]),
)

if (all.length === 0) {
  console.warn('No candidates fetched — leaving existing cache unchanged')
  process.exit(0)
}

writeFileSync(
  OUT,
  JSON.stringify(
    {
      source: 'free-apis.github.io (public-apis + public-apis-dev)',
      browseUrl: 'https://free-apis.github.io/#/browse',
      note: 'Browse UI uses api.publicapis.org (offline); this cache mirrors the README sources directly.',
      license: 'MIT — preserve notice on attribution page',
      fetchedAt: new Date().toISOString(),
      counts: { total: all.length, ...byAuth },
      meta,
      candidates: all,
    },
    null,
    2,
  ) + '\n',
)
console.log(`wrote ${OUT} (${all.length} candidates — ${byAuth.none ?? 0} keyless)`)

const seedIndex = loadSeedIndex(SEED, IMPORTED)
const gaps = all
  .map(toProbeCandidate)
  .filter((r) => !haveRow(r, seedIndex))
  .filter((r) => !NO_AUTH_ONLY || r.auth === 'none')

writeFileSync(GAP_OUT, JSON.stringify({
  fetchedAt: new Date().toISOString(),
  browseUrl: 'https://free-apis.github.io/#/browse',
  filter: NO_AUTH_ONLY ? 'no-auth-only' : 'all',
  missing: gaps.length,
  candidates: gaps,
}, null, 2))

if (WRITE_BATCH) {
  const picked = gaps.filter((r) => r.auth === 'none').slice(0, 50)
  const nums = readdirSync(IMPORT_DIR)
    .map((f) => /^batch-input-(\d+)\.json$/.exec(f))
    .filter(Boolean)
    .map((m) => Number(m[1]))
  const next = (nums.length ? Math.max(...nums) : 0) + 1
  const batchPath = fileURLToPath(new URL(`./import/batch-input-${next}.json`, import.meta.url))
  writeFileSync(batchPath, JSON.stringify({
    source: 'free-apis.github.io',
    authFilter: 'none',
    candidates: picked,
  }, null, 2))
  console.log(`wrote ${batchPath} (${picked.length} candidates)`)
}

console.log(`\nfree-apis.github.io gaps: ${gaps.length}${NO_AUTH_ONLY ? ' keyless' : ''} missing from seed`)
console.log('Top keyless gaps:')
for (const c of gaps.filter((r) => r.auth === 'none').slice(0, 15)) {
  console.log(`  • ${c.name} (${c.sourceCategory}) — ${c.docsUrl}`)
}
console.log(`wrote ${GAP_OUT}`)

if (MERGE) {
  const r = spawnSync('node', ['scripts/fetch-directory-sources.mjs'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    stdio: 'inherit',
  })
  if (r.status !== 0) process.exit(r.status ?? 1)
}
