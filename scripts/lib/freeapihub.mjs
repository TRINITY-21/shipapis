// Shared helpers for scraping freeapihub.com/apis (Next.js RSC payloads).

export const UA = 'shipapis-import/1.0 (+https://shipapis.dev/methodology; freeapihub.com)'
export const SITEMAP_URL = 'https://freeapihub.com/sitemap.xml'
export const LIST_URL = 'https://freeapihub.com/apis'

/** Extract the main `api` record from a detail page HTML blob. */
export function parseApiPage(html, slug) {
  const anchor = `\\"api\\":{\\"slug\\":\\"${slug}\\"`
  const start = html.indexOf(anchor)
  if (start === -1) return null
  const chunk = html.slice(start, start + 60_000)
  const get = (k) => chunk.match(new RegExp(`\\\\"${k}\\\\":\\\\"([^\\\\"]*)\\\\"`))?.[1]
  const docsUrl = get('docsUrl') || get('website')
  const baseUrl = get('baseUrl')
  let docs = docsUrl
  if (!docs && baseUrl) {
    try { docs = new URL(baseUrl).origin } catch { /* */ }
  }
  return {
    slug,
    name: get('name') || get('displayName'),
    category: get('category'),
    access: get('access'),
    auth: get('auth'),
    baseUrl,
    docsUrl: docs,
    website: get('website'),
    description: get('description'),
  }
}

export function mapAuth(auth, access) {
  const a = String(auth ?? '').toLowerCase()
  if (a.includes('no auth') || a === 'none') return 'none'
  if (a.includes('oauth')) return 'oauth'
  if (a.includes('api key') || a.includes('token') || a.includes('bearer')) return 'apiKey'
  if (String(access ?? '').toLowerCase() === 'free') return 'none'
  return 'apiKey'
}

export function parseSitemapApiSlugs(xml) {
  const slugs = []
  for (const m of xml.matchAll(/<loc>https:\/\/freeapihub\.com\/apis\/([^<]+)<\/loc>/g)) {
    const slug = m[1].trim()
    if (slug && !slug.includes('/')) slugs.push(slug)
  }
  return [...new Set(slugs)]
}

export async function fetchPage(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, accept: 'text/html' },
    signal: AbortSignal.timeout(45_000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`)
  return res.text()
}

export async function mapPool(items, concurrency, fn) {
  const out = []
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx = i++
      out[idx] = await fn(items[idx], idx)
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()))
  return out
}
