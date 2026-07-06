// Shared helpers for scraping publicapis.io (Next.js __NEXT_DATA__).

export const CATEGORIES = [
  'analytics', 'animals', 'anime', 'art-and-design', 'books', 'business', 'calendar',
  'cloud-storage-and-file-sharing', 'cryptocurrency', 'currency-exchange', 'data-access',
  'development', 'dictionaries', 'documents-and-productivity', 'environment', 'finance',
  'food-and-drink', 'games-and-comics', 'geocoding', 'government', 'health', 'iot', 'jobs',
  'machine-learning', 'media', 'music', 'news', 'open-data', 'personality', 'photography',
  'science', 'security', 'shopping', 'social', 'sports-and-fitness', 'text-analysis',
  'transportation', 'url-shorteners', 'utilities', 'vehicle', 'video', 'weather',
]

export const UA = 'shipapis-import/1.0 (+https://shipapis.dev/methodology; publicapis.io)'

export function hostKey(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

export function hostAliases(host) {
  const h = host.replace(/^www\./, '')
  const out = new Set([h])
  if (h.startsWith('api.')) out.add(h.slice(4))
  else out.add(`api.${h}`)
  return [...out]
}

export function parseNextData(html) {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (!m) return null
  return JSON.parse(m[1])
}

export async function fetchCategory(slug) {
  const res = await fetch(`https://publicapis.io/category/${slug}`, {
    headers: { 'User-Agent': UA, accept: 'text/html' },
    signal: AbortSignal.timeout(45_000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()
  const data = parseNextData(html)
  return data?.props?.pageProps?.categoryApis ?? []
}

/** Build host → auth map from MIT public-apis cache. */
export function authIndexFromCache(candidates) {
  const byHost = new Map()
  for (const c of candidates) {
    const host = hostKey(c.docsUrl)
    if (!host) continue
    for (const a of hostAliases(host)) {
      if (!byHost.has(a)) byHost.set(a, c.auth)
    }
  }
  return byHost
}

export function inferAuth(website, authByHost) {
  const host = hostKey(website)
  if (!host) return 'unknown'
  for (const a of hostAliases(host)) {
    const hit = authByHost.get(a)
    if (hit) return hit
  }
  return 'unknown'
}

export function slugify(title, slug) {
  if (slug) return slug.replace(/[^a-z0-9-]/gi, '-').toLowerCase().slice(0, 48)
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)
}
