// Quick-probe novel keyless candidates from extra-candidates.json
// run: node scripts/probe-novel.mjs

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PROBE_HINTS } from './lib/probe-hints.mjs'
import {
    UA,
    docsFetchUrl,
    emojiFor,
    extractProbeUrls,
    guessEndpoints,
    isPostmanCollection,
    probeUrl, slugify,
    splitBaseAndEndpoint,
    trimJson,
    writeCopy,
} from './lib/probe-utils.mjs'

const EXTRA = fileURLToPath(new URL('./extra-candidates.json', import.meta.url))
const DIR = fileURLToPath(new URL('./directory-candidates.json', import.meta.url))
const OUT = fileURLToPath(new URL('./import/batch-43.json', import.meta.url))
const MAX = 4

const dirHosts = new Set(
  JSON.parse(readFileSync(DIR, 'utf8')).candidates.map((c) => {
    try { return new URL(c.docsUrl).hostname.replace(/^www\./, '') } catch { return '' }
  }),
)

const extra = JSON.parse(readFileSync(EXTRA, 'utf8')).candidates
const novel = extra.filter((c) => {
  if (c.auth !== 'none' || !c.https) return false
  if (c.source === 'directory-candidates-residual') return false
  try { return !dirHosts.has(new URL(c.docsUrl).hostname.replace(/^www\./, '')) } catch { return false }
})

function findHint(c) {
  const hay = `${c.name} ${c.docsUrl} ${c.description}`
  for (const h of PROBE_HINTS) {
    if (h.match.test(hay)) return h
  }
  return null
}

async function probeCandidateUrls(urls) {
  const tried = new Set()
  for (const raw of urls) {
    if (tried.size >= MAX) break
    const url = raw.trim()
    if (!url || tried.has(url)) continue
    tried.add(url)
    const r = await probeUrl(url)
    if (r.httpStatus === 200 && r.json != null && !isPostmanCollection(r.json)) {
      const split = splitBaseAndEndpoint(url)
      if (!split) continue
      return { ...r, ...split, probedUrl: url }
    }
  }
  return null
}

async function verify(c) {
  const hint = findHint(c)
  const urls = []
  if (hint) urls.push(hint.baseUrl.replace(/\/+$/, '') + hint.sampleEndpoint)
  urls.push(...guessEndpoints(c))

  // Known endpoint patterns for novel APIs
  const known = {
    'attackontitanquotes.vercel.app': 'https://attackontitanquotes.vercel.app/api/quotes/random',
    'programming-quotesapi.vercel.app': 'https://programming-quotesapi.vercel.app/api/v2/quotes/random',
    'riddles-api.vercel.app': 'https://riddles-api.vercel.app/random',
    'hindi-quotes.vercel.app': 'https://hindi-quotes.vercel.app/api/random',
    'owen-wilson-wow-api.onrender.com': 'https://owen-wilson-wow-api.onrender.com/',
    'bobsburgersapi.com': 'https://bobsburgersapi.com/api/characters',
    'predscope.com': 'https://predscope.com/api/markets.json',
    'api.dexpaprika.com': 'https://api.dexpaprika.com/v1/networks',
    'www.openholidaysapi.org': 'https://openholidaysapi.org/PublicHolidays?countryIsoCode=DE&languageIsoCode=EN&validFrom=2026-01-01&validTo=2026-12-31',
    'www.openplzapi.org': 'https://openplzapi.org/de/Localities?name=Berlin',
    'freegeoip.app': 'https://freegeoip.app/json/8.8.8.8',
    'api.unusualunits.com': 'https://api.unusualunits.com/convert?from=meter&to=foot&value=1',
    'idphotosnap.com': 'https://idphotosnap.com/api/specs',
    'nationnode.vercel.app': 'https://nationnode.vercel.app/api/countries',
    'aes.shenlu.me': 'https://aes.shenlu.me/api/species?limit=1',
    'horoscope.deckaura.com': 'https://horoscope.deckaura.com/api/horoscope/today/aries',
    'echoes.soferity.com': 'https://echoes.soferity.com/api/random',
    'api.gawrshdarn.com': 'https://api.gawrshdarn.com/random',
    'www.tcgdex.dev': 'https://api.tcgdex.net/v2/en/cards?name=pikachu',
  }
  try {
    const host = new URL(c.docsUrl).hostname.replace(/^www\./, '')
    const full = known[host] || known[new URL(c.docsUrl).hostname]
    if (full) urls.unshift(full)
  } catch { /* */ }

  try {
    const res = await fetch(docsFetchUrl(c.docsUrl), {
      signal: AbortSignal.timeout(6000),
      headers: { 'user-agent': UA, accept: 'text/html,*/*' },
    })
    if (res.ok) urls.unshift(...extractProbeUrls(await res.text()))
  } catch { /* */ }

  const hit = await probeCandidateUrls(urls)
  if (!hit) return { ok: false, name: c.name, docsUrl: c.docsUrl }

  const copy = writeCopy(c)
  return {
    ok: true,
    entry: {
      name: hint?.name || c.name,
      slug: slugify(hint?.name || c.name),
      emoji: hint?.emoji || emojiFor(c.sourceCategory),
      tagline: hint?.tagline || copy.tagline,
      description: hint?.description || copy.description,
      sourceCategory: c.sourceCategory,
      docsUrl: c.docsUrl,
      baseUrl: hit.baseUrl,
      sampleEndpoint: hit.sampleEndpoint,
      latencyMs: hit.latencyMs,
      corsObserved: hit.corsObserved,
      httpStatus: 200,
      sampleJson: trimJson(hit.json),
      freeTier: 'Free — limits not published',
      rateLimit: 'Unpublished',
      dataLicense: 'Unverified',
      commercialUse: 'unclear',
      notes: `Novel source ${c.source}; probed ${hit.probedUrl}`,
    },
  }
}

console.log(`Probing ${novel.length} novel keyless APIs...`)
const verified = []
const skipped = []
const CONC = 8
const q = [...novel]
await Promise.all(Array.from({ length: CONC }, async () => {
  for (let c; (c = q.shift()); ) {
    const r = await verify(c)
    if (r.ok) {
      verified.push(r.entry)
      console.log('  ✓', r.entry.name)
    } else {
      skipped.push({ name: r.name, docsUrl: r.docsUrl })
    }
  }
}))

writeFileSync(OUT, JSON.stringify({ batch: 43, verified, skipped }, null, 2) + '\n')
console.log(`\nDone: ${verified.length} verified, ${skipped.length} skipped → ${OUT}`)
