// One-shot metadata backfill: CORS + rate-limit headers for every probeable API.
// run: node scripts/backfill-metadata.mjs [--limit 50] [--slug tmdb] [--concurrency 12]

import { getPlatformProxy } from 'wrangler'
import { corsVerifiedFromHeaders, rateFromHeaders } from '../src/lib/metadata-probe.ts'
import { ORIGIN, UA } from './lib/probe-utils.mjs'

const limit = Number(process.argv.find((a, i) => process.argv[i - 1] === '--limit') || '0') || null
const slugFilter = process.argv.find((a, i) => process.argv[i - 1] === '--slug') || null
const concurrency = Number(process.argv.find((a, i) => process.argv[i - 1] === '--concurrency') || '12')

const AUTH_QUERY_KEYS = ['api_key', 'apikey', 'key', 'token', 'app_id', 'app_key', 'access_token']

function stripAuth(url) {
  try {
    const u = new URL(url)
    for (const k of AUTH_QUERY_KEYS) u.searchParams.delete(k)
    return u.toString()
  } catch {
    return url
  }
}

async function probeMeta(url) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 8000)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'user-agent': UA, origin: ORIGIN, accept: 'application/json, text/html, */*' },
    })
    res.body?.cancel()
    return {
      cors: corsVerifiedFromHeaders(res.headers),
      rate: rateFromHeaders(res.headers),
      https: url.startsWith('https://') ? 1 : 0,
    }
  } catch {
    return { cors: null, rate: null, https: null }
  } finally {
    clearTimeout(t)
  }
}

const { env, dispose } = await getPlatformProxy({ configPath: './wrangler.jsonc' })
try {
  let sql = `select a.id, a.slug, a.check_tier, a.docs_url, e.url_template
    from apis a
    join endpoints e on e.api_id = a.id and e.active = 1
    where a.check_opt_out = 0 and a.check_tier != 'listed'`
  if (slugFilter) sql += ` and a.slug = '${String(slugFilter).replace(/'/g, "''")}'`
  sql += ' group by a.id order by a.slug'
  if (limit) sql += ` limit ${limit}`

  const rows = (await env.DB.prepare(sql).all()).results ?? []
  const upd = env.DB.prepare(
    `update apis set
       cors_verified = case when ? is not null then ? else cors_verified end,
       https = coalesce(?, https),
       rate_limit_notes = case
         when ? is not null and (
           rate_limit_notes is null or trim(rate_limit_notes) = ''
           or lower(trim(rate_limit_notes)) in ('unpublished', 'none published', 'not published', 'unknown')
         ) then ?
         else rate_limit_notes
       end
     where id = ?`,
  )

  const writeQueue = []
  let flushing = null
  const flushWrites = async () => {
    if (flushing) return flushing
    flushing = (async () => {
      while (writeQueue.length) {
        const chunk = writeQueue.splice(0, 40)
        await env.DB.batch(chunk)
      }
      flushing = null
    })()
    return flushing
  }
  const enqueueWrite = async (stmt) => {
    writeQueue.push(stmt)
    if (writeQueue.length >= 40) await flushWrites()
  }

  let done = 0
  let failed = 0
  let i = 0

  async function worker() {
    while (i < rows.length) {
      const row = rows[i++]
      const tier = row.check_tier
      const target =
        tier === 'docs' && row.docs_url
          ? row.docs_url
          : tier === 'reachability'
            ? stripAuth(row.url_template)
            : row.url_template
      const meta = await probeMeta(target)
      if (meta.cors == null) {
        failed++
        process.stdout.write(`  ${row.slug}: skip (no response)\n`)
        continue
      }
      await enqueueWrite(upd.bind(meta.cors, meta.cors, meta.https, meta.rate, meta.rate, row.id))
      done++
      process.stdout.write(`  ${row.slug}: cors=${meta.cors} rate=${meta.rate ?? '—'}\n`)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, rows.length) }, () => worker()))
  await flushWrites()
  console.log(`\nbackfill done: ${done}/${rows.length} updated · ${failed} unreachable`)
} finally {
  await dispose()
}
