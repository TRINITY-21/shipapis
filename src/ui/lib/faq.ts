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

/** Compare-page FAQ: answers the "A vs B — which is faster / keyless / free" queries for a pair. */
export function compareFaqItems(a: ApiEntry, b: ApiEntry): FaqItem[] {
  const items: FaqItem[] = []
  const aMon = isMonitored(a)
  const bMon = isMonitored(b)
  const keyless = (x: ApiEntry) => x.auth === 'none' || x.auth === 'userAgent'
  const browserOk = (x: ApiEntry) => x.cors === 'yes' && x.https

  // Reliability — only claim numbers for APIs actually on our probe schedule.
  if (aMon && bMon) {
    const ua = Number(uptimePct(a))
    const ub = Number(uptimePct(b))
    const lead = ua === ub ? null : ua > ub ? a : b
    items.push({
      q: `Which is more reliable, ${a.name} or ${b.name}?`,
      a: lead
        ? `On our scheduled checks, ${lead.name} leads on measured uptime — ${a.name} at ${uptimePct(a)}% versus ${b.name} at ${uptimePct(b)}% over 90 days. These are our own probe results, not provider claims; the uptime bars above show the day-by-day record for both.`
        : `Both are neck-and-neck — ${a.name} and ${b.name} each measure ${uptimePct(a)}% uptime over 90 days on our probe schedule. Reliability here is verified from our own scheduled checks; use the 30-day bars above to see which has been steadier lately.`,
    })
  } else {
    const probed = aMon ? a : bMon ? b : null
    items.push({
      q: `Which is more reliable, ${a.name} or ${b.name}?`,
      a: probed
        ? `Only ${probed.name} is on our probe schedule so far (${uptimePct(probed)}% uptime over 90 days). The other is catalogued but not yet live-checked, so we can't compare measured reliability head-to-head — check the uncovered API's own status page for now.`
        : `Neither ${a.name} nor ${b.name} is on our live probe schedule yet, so we don't publish measured uptime for either. Compare the auth, CORS and free-tier fields above, and check each provider's own status page for current reliability.`,
    })
  }

  // Latency — same monitoring gate.
  if (aMon && bMon && a.p50 > 0 && b.p50 > 0) {
    const faster = a.p50 === b.p50 ? null : a.p50 < b.p50 ? a : b
    items.push({
      q: `Which is faster, ${a.name} or ${b.name}?`,
      a: faster
        ? `${faster.name} has the lower median latency in our checks — ${a.name} responds in ${a.p50} ms versus ${b.name} at ${b.p50} ms (P50). Tail latency (P95) is in the table above; for most workloads the median is the number that shapes how the API feels.`
        : `They're evenly matched on speed — both ${a.name} and ${b.name} post a ${a.p50} ms median (P50) in our checks. Look at the P95 row above if worst-case latency matters more than the typical response for your use case.`,
    })
  }

  // API key.
  items.push({
    q: `Do ${a.name} and ${b.name} need an API key?`,
    a:
      keyless(a) && keyless(b)
        ? `Neither needs a paid key — ${a.name} is ${a.auth === 'userAgent' ? 'keyless but wants an identifying User-Agent header' : 'callable with no signup'}, and ${b.name} is ${b.auth === 'userAgent' ? 'keyless with a required User-Agent header' : 'callable with no signup'}. Both are quick to prototype with; rate limits still apply.`
        : keyless(a) !== keyless(b)
          ? `${keyless(a) ? a.name : b.name} needs no key, while ${keyless(a) ? b.name : a.name} requires ${
              (keyless(a) ? b : a).auth === 'oauth' ? 'OAuth' : 'a free API key'
            }. If you want to start calling without signup, reach for ${keyless(a) ? a.name : b.name} first.`
          : `Both ask you to authenticate — ${a.name} uses ${a.auth === 'oauth' ? 'OAuth' : 'an API key'} and ${b.name} uses ${b.auth === 'oauth' ? 'OAuth' : 'an API key'}. Each key is free to obtain; the Auth and Card-required rows above spell out the signup terms.`,
  })

  // Browser / CORS.
  items.push({
    q: `Can I call ${a.name} and ${b.name} from the browser?`,
    a:
      browserOk(a) && browserOk(b)
        ? `Yes — both ${a.name} and ${b.name} send CORS headers over HTTPS, so front-end code can fetch either directly with no backend proxy. That makes them easy to swap in a client-side app while you compare responses.`
        : browserOk(a) !== browserOk(b)
          ? `Only ${browserOk(a) ? a.name : b.name} is browser-friendly — it returns CORS headers over HTTPS. ${browserOk(a) ? b.name : a.name} needs a server-side call or proxy, so factor that into which one fits a front-end project.`
          : `Neither sends browser-friendly CORS headers reliably, so call ${a.name} and ${b.name} from a server or proxy rather than client-side. The CORS and HTTPS rows above show exactly what we detected for each.`,
  })

  // Commercial use.
  items.push({
    q: `Are ${a.name} and ${b.name} free for commercial use?`,
    a: (() => {
      const phrase = (x: ApiEntry) =>
        x.commercialUse === 'yes'
          ? 'allows commercial use on its free tier'
          : x.commercialUse === 'no'
            ? 'is personal/non-commercial only'
            : 'has unclear commercial terms'
      return `${a.name} ${phrase(a)}, and ${b.name} ${phrase(b)}. We track service terms and the data license as separate fields — see the Commercial use and Data license rows above, and confirm both before shipping either in a paid product.`
    })(),
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
