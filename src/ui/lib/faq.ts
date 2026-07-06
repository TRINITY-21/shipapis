// FAQ answer-capsules — the AI-citation format (MASTERPLAN Δ5 / §5.2 / §5.3). 40–60-word answers
// under real question headings, generated from live catalog data so they can never disagree with the
// page. Every capsule is honesty-gated: catalogued-only APIs never carry health claims.

import { isMonitored, isOnProbeSchedule } from '../../data/catalog'
import { uptimePct, type ApiEntry, type Category } from '../../data/seed'

export type FaqItem = { q: string; a: string }

const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many)

/** Category-hub FAQ: answers the "free X API" long-tail from real counts. */
export function categoryFaqItems(cat: Category, list: ApiEntry[]): FaqItem[] {
  const total = list.length
  const probed = list.filter(isMonitored)
  const scheduled = list.filter(isOnProbeSchedule)
  const noKey = list.filter((a) => a.auth === 'none')
  const noKeyish = list.filter((a) => a.auth === 'none' || a.auth === 'userAgent')
  const corsYes = list.filter((a) => a.cors === 'yes' && a.https)
  const commercial = list.filter((a) => a.commercialUse === 'yes')
  const name = cat.name.toLowerCase()

  const items: FaqItem[] = []

  items.push({
    q: `Are there free ${cat.name} APIs with no API key?`,
    a: noKeyish.length
      ? `Yes — ${noKeyish.length} of the ${total} free ${name} ${plural(total, 'API')} we list need no API key or signup${noKey[0] ? ` (${noKey[0].name} is a good starting point)` : ''}. Use the "No key" filter above to see them; they're the fastest to prototype with.`
      : `Most free ${name} APIs here ask for a free key. Use the "Free key" filter to see which ones, and each listing spells out the signup and rate-limit terms before you commit.`,
  })

  if (probed.length) {
    const best = [...probed]
      .filter((a) => a.status !== 'dead' && a.status !== 'dying')
      .sort((a, b) => Number(uptimePct(b)) - Number(uptimePct(a)) || b.healthScore - a.healthScore)[0]
    if (best) {
      items.push({
        q: `Which free ${cat.name} API is the most reliable?`,
        a: `Of the ${probed.length} ${name} ${plural(probed.length, 'API')} on our probe schedule, ${best.name} leads on measured uptime (${uptimePct(best)}% over 90 days). Reliability here is verified from our own scheduled checks, not the provider's claims — sort by "Reliable" to rank the rest.`,
      })
    }
  }

  items.push({
    q: `Can I call these ${cat.name} APIs from the browser?`,
    a: corsYes.length
      ? `${corsYes.length} of these ${name} ${plural(corsYes.length, 'API')} send CORS headers over HTTPS, so you can fetch them straight from front-end code — no backend proxy. Filter by "Browser OK" to see them; the rest need a server-side call.`
      : `Most ${name} APIs here need a server-side call — they don't send browser-friendly CORS headers. Copy the curl or fetch snippet on any listing, or filter by "Browser OK" if we've verified one that works client-side.`,
  })

  items.push({
    q: `Are these free ${cat.name} APIs OK for commercial use?`,
    a: `${commercial.length} of the ${total} ${name} ${plural(total, 'API')} allow commercial use on the free tier; the rest are unclear or personal-only. We record service terms and the data license as separate fields on every listing — check both before you ship.`,
  })

  items.push({
    q: `How often are these ${cat.name} APIs checked?`,
    a: `${scheduled.length} of the ${total} ${name} ${plural(total, 'API')} are on our probe schedule and re-tested every sweep. We log uptime, latency and response-shape changes on each, and move any that stay down to the graveyard so you can see what died and when.`,
  })

  return items
}

/** Detail-page FAQ: answers the "is X free / keyless / up" queries for a single API. */
export function apiFaqItems(api: ApiEntry, catName: string): FaqItem[] {
  const probed = isMonitored(api)
  const cat = catName.toLowerCase()
  const items: FaqItem[] = []

  items.push({
    q: `Is ${api.name} free to use?`,
    a: `Yes — ${api.name} is a free ${cat} API. Free tier: ${api.freeTier}.${
      api.requiresCard ? ' It does ask for a payment card at signup.' : ''
    } ${
      api.commercialUse === 'yes'
        ? 'Commercial use is allowed on the free tier.'
        : api.commercialUse === 'no'
          ? 'The free tier is for non-commercial use.'
          : 'Whether the free tier allows commercial use is unclear — check the provider docs.'
    }`.trim(),
  })

  items.push({
    q: `Does ${api.name} need an API key?`,
    a:
      api.auth === 'none'
        ? `No — ${api.name} needs no API key or signup. You can call it straight away; rate limits still apply (${api.rateLimit}).`
        : api.auth === 'userAgent'
          ? `No key, but ${api.name} requires an identifying User-Agent header on every request (provider etiquette). Rate limits: ${api.rateLimit}.`
          : api.auth === 'oauth'
            ? `Yes — ${api.name} authenticates with OAuth. See the provider docs for scopes and token setup; rate limits: ${api.rateLimit}.`
            : `Yes — ${api.name} needs a free API key, which you pass on each request. Rate limits: ${api.rateLimit}.`,
  })

  items.push({
    q: `Can I call ${api.name} from the browser?`,
    a:
      api.cors === 'yes' && api.https
        ? `Yes — ${api.name} returns CORS headers over HTTPS, so front-end code can fetch it directly with no backend proxy. Use the fetch snippet on this page, or hit "Run live" to try it now.`
        : `Not directly — ${api.name} doesn't send browser-friendly CORS headers, so call it from a server or proxy instead. Copy the curl or Python snippet on this page to get started.`,
  })

  items.push({
    q: `Is ${api.name} up right now?`,
    a: probed
      ? `As of our last scheduled check, ${api.name} is ${api.status}${
          Number(uptimePct(api)) > 0 ? ` with ${uptimePct(api)}% uptime over 90 days` : ''
        }${api.p50 > 0 ? ` and a ${api.p50} ms median response` : ''}. We re-probe it every sweep — the status badge and uptime chart above always show the latest.`
      : `${api.name} is catalogued but not yet on our probe schedule, so we don't publish a live status for it. Check the provider's own status page or docs for its current state.`,
  })

  return items
}
