// Deterministic API-of-the-Day — same UTC date → same pick everywhere (SSR, OG, Short).
// Pool: probed APIs first; falls back to on-schedule live APIs if none probed yet.

import { isProbeScheduled } from './check-tier'
import type { ApiEntry } from './seed'

export interface ApiOfTheDayPick {
  slug: string
  why: string
  api: ApiEntry
  date: string // YYYY-MM-DD UTC
}

const isProbed = (a: ApiEntry) =>
  isProbeScheduled(a.checkTier) && (a.status !== 'unmonitored' || a.monitoredSince != null)

const isLive = (a: ApiEntry) => a.status !== 'dead'

/** UTC calendar date for rotation — matches todayLabel() on the homepage. */
export const aotdDateIso = (d = new Date()) => d.toISOString().slice(0, 10)

function dayIndex(iso: string, len: number): number {
  if (!len) return 0
  let h = 2166136261
  for (let i = 0; i < iso.length; i++) {
    h ^= iso.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) % len
}

function whyFor(api: ApiEntry): string {
  const perks: string[] = []
  if (api.auth === 'none' || api.auth === 'userAgent') perks.push('no key')
  if (api.cors === 'yes') perks.push('open CORS')
  if (api.commercialUse === 'yes') perks.push('commercial use OK')
  if (api.https) perks.push('HTTPS')
  if (perks.length) return `${api.tagline} — ${perks.join(', ')}.`
  return api.tagline
}

function poolFor(apis: ApiEntry[]): ApiEntry[] {
  const probed = apis.filter((a) => isLive(a) && isProbed(a)).sort((a, b) => a.slug.localeCompare(b.slug))
  if (probed.length) return probed
  const scheduled = apis
    .filter((a) => isLive(a) && isProbeScheduled(a.checkTier))
    .sort((a, b) => a.slug.localeCompare(b.slug))
  if (scheduled.length) return scheduled
  return apis.filter(isLive).sort((a, b) => a.slug.localeCompare(b.slug))
}

/** Pick today's spotlight API from the current catalog. */
export function pickApiOfTheDay(apis: ApiEntry[], dateIso = aotdDateIso()): ApiOfTheDayPick {
  const pool = poolFor(apis)
  const api = pool[dayIndex(dateIso, pool.length)] ?? pool[0]!
  return { slug: api.slug, why: whyFor(api), api, date: dateIso }
}
