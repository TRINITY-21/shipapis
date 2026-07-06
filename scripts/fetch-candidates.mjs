// Seed import pipeline, stage 1 (MASTERPLAN §8 "seed import pipeline", §12 #4 provenance).
// Fetches the MIT-licensed public-apis/public-apis README at a pinned commit, parses its
// tables, dedupes against src/seed.ts, live-checks each docs link, and writes
// scripts/candidates.json ranked keyless-first.
//
// This produces CANDIDATES ONLY. Entries still get hand-curated into src/seed.ts:
// descriptions rewritten 100% (legal gate §12 #4), sample endpoint verified by hand,
// commercial-use / data-license filled from the provider's own terms — never from here.
//
// run:  node scripts/fetch-candidates.mjs            (parse + dedupe only, fast)
//       node scripts/fetch-candidates.mjs --check    (also live-check docs links, ~3 min)

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const REPO = 'public-apis/public-apis'
const CHECK = process.argv.includes('--check')
const OUT = fileURLToPath(new URL('./candidates.json', import.meta.url))
const SEED = fileURLToPath(new URL('../src/data/seed.ts', import.meta.url))
const IMPORTED = fileURLToPath(new URL('../src/data/seed-imported.ts', import.meta.url))

// --- provenance: pin the commit we imported at, so the attribution page can cite it
const commitRes = await fetch(`https://api.github.com/repos/${REPO}/commits/master`, {
  headers: { 'user-agent': 'shipapis-import/1.0', accept: 'application/vnd.github+json' },
})
if (!commitRes.ok) throw new Error(`commit lookup failed: HTTP ${commitRes.status}`)
const commit = (await commitRes.json()).sha

const mdRes = await fetch(`https://raw.githubusercontent.com/${REPO}/${commit}/README.md`, {
  headers: { 'user-agent': 'shipapis-import/1.0' },
})
if (!mdRes.ok) throw new Error(`README fetch failed: HTTP ${mdRes.status}`)
const md = await mdRes.text()

// --- parse: "### Category" headings followed by | API | Description | Auth | HTTPS | CORS |
const rows = []
let category = null
for (const line of md.split('\n')) {
  const h = line.match(/^### (.+)/)
  if (h) { category = h[1].trim(); continue }
  if (!category || !line.startsWith('|')) continue
  const cells = line.split('|').map((c) => c.trim())
  const link = cells[1]?.match(/^\[(.+?)\]\((.+?)\)$/)
  if (!link) continue // header/divider rows
  const auth = cells[3]?.replace(/`/g, '') || 'No'
  rows.push({
    name: link[1],
    docsUrl: link[2],
    description: cells[2] ?? '', // source text — for triage only, NEVER ships (rewrite gate)
    auth: /^no$/i.test(auth) ? 'none' : /user-?agent/i.test(auth) ? 'userAgent' : /oauth/i.test(auth) ? 'oauth' : 'apiKey',
    https: /^yes$/i.test(cells[4] ?? ''),
    cors: /^yes$/i.test(cells[5] ?? '') ? 'yes' : /^no$/i.test(cells[5] ?? '') ? 'no' : 'unknown',
    sourceCategory: category,
  })
}

// --- dedupe: against ourselves (upstream has repeats) and against the live seed
const seedSrc = readFileSync(SEED, 'utf8') + readFileSync(IMPORTED, 'utf8')
const seedHosts = new Set(
  [...seedSrc.matchAll(/(?:docsUrl|baseUrl): ['"](https?:\/\/[^/"']+)/g)].map((m) => {
    try { return new URL(m[1]).hostname.replace(/^www\./, '') } catch { return '' }
  }).filter(Boolean),
)
const seen = new Set()
const candidates = rows.filter((r) => {
  let host
  try { host = new URL(r.docsUrl).hostname.replace(/^www\./, '') } catch { return false }
  const key = host + '|' + r.name.toLowerCase()
  if (seen.has(key) || seedHosts.has(host)) return false
  seen.add(key)
  return true
})

// --- rank: keyless+https+cors first — those are the launch-quality pool
const score = (r) =>
  (r.auth === 'none' ? 4 : r.auth === 'userAgent' ? 3 : r.auth === 'apiKey' ? 1 : 0) +
  (r.https ? 2 : -4) +
  (r.cors === 'yes' ? 1 : 0)
candidates.sort((a, b) => score(b) - score(a))

// --- optional live pre-check of docs links (import-time liveness, not real monitoring)
if (CHECK) {
  let done = 0
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
      r.docsCheck = 0 // timeout / DNS / TLS failure
    } finally {
      clearTimeout(t)
      if (++done % 100 === 0) console.log(`  checked ${done}/${candidates.length}`)
    }
  }
  const queue = [...candidates]
  await Promise.all(
    Array.from({ length: 24 }, async () => {
      for (let r; (r = queue.shift()); ) await check(r)
    })
  )
}

const byAuth = Object.fromEntries(
  ['none', 'userAgent', 'apiKey', 'oauth'].map((a) => [a, candidates.filter((r) => r.auth === a).length])
)
writeFileSync(
  OUT,
  JSON.stringify(
    {
      meta: {
        source: `https://github.com/${REPO}`,
        license: 'MIT — preserve notice on attribution page (§12 #4)',
        commit,
        counts: { parsed: rows.length, afterDedupe: candidates.length, ...byAuth },
        checked: CHECK,
      },
      candidates,
    },
    null,
    2
  ) + '\n'
)
console.log(`wrote ${OUT}`)
console.log(`  parsed ${rows.length} rows @ ${commit.slice(0, 7)} → ${candidates.length} after dedupe`)
console.log(`  auth: ${JSON.stringify(byAuth)}`)
