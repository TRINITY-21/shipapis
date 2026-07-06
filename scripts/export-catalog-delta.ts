// Incremental catalog migration — INSERT only what D1 is missing.
// Preserves checks, checks_daily, response_shapes, and monitored_since history.
//
// run:  node scripts/export-catalog-delta.ts [--remote] [--dry-run]
// then: npx wrangler d1 migrations apply shipapis --local   (or --remote)

import { execSync } from 'node:child_process'
import { readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  insertApiByCategorySlug,
  insertCategory,
  insertEndpoint,
  insertShapeChange,
  updateCategoryCounts,
} from './lib/catalog-sql.ts'
import { endpointUrl, apis, categories } from '../src/data/seed.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const migrationsDir = fileURLToPath(new URL('../migrations', import.meta.url))
const remote = process.argv.includes('--remote')
const dryRun = process.argv.includes('--dry-run')
const scope = remote ? '--remote' : '--local'

function d1Query<T extends Record<string, unknown>>(sql: string): T[] {
  const raw = execSync(`npx wrangler d1 execute shipapis ${scope} --command ${JSON.stringify(sql)} --json`, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const parsed = JSON.parse(raw) as Array<{ results?: T[]; success?: boolean }>
  if (!parsed[0]?.success) throw new Error(`D1 query failed: ${sql}`)
  return parsed[0].results ?? []
}

function nextMigrationNumber(): number {
  const nums = readdirSync(migrationsDir)
    .filter((f) => /^\d{4}_.+\.sql$/.test(f))
    .map((f) => parseInt(f.slice(0, 4), 10))
  return (nums.length ? Math.max(...nums) : 0) + 1
}

function epKey(method: string, url: string) {
  return `${method}\0${url}`
}

const dbCategories = new Map(d1Query<{ slug: string; id: number }>('select slug, id from categories').map((r) => [r.slug, r.id]))
const dbCategoryCounts = new Map(
  d1Query<{ slug: string; api_count: number }>('select slug, api_count from categories').map((r) => [r.slug, r.api_count])
)
const dbApis = new Map(d1Query<{ slug: string; id: number }>('select slug, id from apis').map((r) => [r.slug, r.id]))
const dbEndpoints = new Map<string, Set<string>>()
for (const row of d1Query<{ slug: string; method: string; url_template: string }>(
  'select a.slug, e.method, e.url_template from endpoints e join apis a on a.id = e.api_id'
)) {
  const set = dbEndpoints.get(row.slug) ?? new Set()
  set.add(epKey(row.method, row.url_template))
  dbEndpoints.set(row.slug, set)
}

const lines: string[] = []
const newSlugs: string[] = []
const touchedSlugs = new Set<string>()
let newEndpoints = 0

for (const c of categories) {
  if (!dbCategories.has(c.slug)) {
    const n = apis.filter((a) => a.category === c.slug).length
    lines.push(insertCategory({ slug: c.slug, name: c.name, emoji: c.emoji, blurb: c.blurb, apiCount: n }))
  }
}

for (const a of apis) {
  const schedulable = a.status !== 'dead' && a.checkTier !== 'listed'
  let monitoredUrl: string | null = null

  if (!dbApis.has(a.slug)) {
    newSlugs.push(a.slug)
    touchedSlugs.add(a.slug)
    lines.push(insertApiByCategorySlug({
      slug: a.slug,
      name: a.name,
      emoji: a.emoji,
      tagline: a.tagline,
      description: a.description,
      categorySlug: a.category,
      docsUrl: a.docsUrl,
      baseUrl: a.baseUrl,
      auth: a.auth,
      checkTier: a.checkTier,
      https: a.https,
      cors: a.cors,
      freeTier: a.freeTier,
      rateLimit: a.rateLimit,
      requiresCard: a.requiresCard,
      commercialUse: a.commercialUse,
      dataLicense: a.dataLicense,
      status: a.status,
      addedAt: a.addedAt,
      diedAt: a.diedAt,
      epitaph: a.epitaph,
    }))
  }

  const known = dbEndpoints.get(a.slug) ?? new Set<string>()
  for (const ep of a.endpoints) {
    const url = endpointUrl(a.baseUrl, ep.path)
    const key = epKey(ep.method, url)
    if (known.has(key)) {
      if (ep.monitored) monitoredUrl = url
      continue
    }
    touchedSlugs.add(a.slug)
    newEndpoints++
    lines.push(
      insertEndpoint({
        apiSlug: a.slug,
        method: ep.method,
        urlTemplate: url,
        description: ep.description,
        active: !!(ep.monitored && schedulable),
      })
    )
    if (ep.monitored) monitoredUrl = url
  }

  if (monitoredUrl && touchedSlugs.has(a.slug)) {
    for (const sc of a.shapeChanges) {
      lines.push(insertShapeChange({ apiSlug: a.slug, urlTemplate: monitoredUrl, ts: sc.date, summary: sc.summary }))
    }
  }
}

for (const c of categories) {
  const n = apis.filter((a) => a.category === c.slug).length
  if (dbCategoryCounts.get(c.slug) !== n) lines.push(updateCategoryCounts(c.slug, n))
}

if (!lines.length) {
  console.log(`catalog in sync with D1 (${scope}) — ${dbApis.size} apis, nothing to migrate`)
  process.exit(0)
}

const num = nextMigrationNumber()
const slugBit = newSlugs.slice(0, 3).join('_') || `${newEndpoints}-endpoints`
const name = `${String(num).padStart(4, '0')}_catalog_${slugBit}.sql`
const header = [
  `-- ${name} — generated by scripts/export-catalog-delta.ts. Idempotent inserts only.`,
  `-- New APIs: ${newSlugs.length ? newSlugs.join(', ') : '(none)'}`,
  `-- New endpoints: ${newEndpoints}`,
  `-- Apply: npx wrangler d1 migrations apply shipapis ${scope}`,
  '',
]
const body = header.concat(lines).join('\n') + '\n'

if (dryRun) {
  console.log(body)
  console.log(`dry-run — would write migrations/${name} (${newSlugs.length} apis, ${newEndpoints} endpoints)`)
  process.exit(0)
}

const out = `${migrationsDir}/${name}`
writeFileSync(out, body)
console.log(`wrote ${out}`)
console.log(`  +${newSlugs.length} apis${newSlugs.length ? `: ${newSlugs.join(', ')}` : ''}`)
console.log(`  +${newEndpoints} endpoints`)
console.log(`next: npx wrangler d1 migrations apply shipapis ${scope}`)
