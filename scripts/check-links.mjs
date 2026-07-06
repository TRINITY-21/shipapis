// Link checker: crawl the running dev server, fail on internal 404s.
// The phantom-surface guard (MASTERPLAN Δ2 #5): advertising a route that 404s is the apimap sin.
// Usage: BASE_URL=http://localhost:8787 node scripts/check-links.mjs

const BASE_URL = (process.env.BASE_URL || 'http://localhost:8787').replace(/\/$/, '')
const CANON = 'https://shipapis.dev' // canonical origin in sitemaps/payloads — crawled as local paths
const MAX_URLS = 300
const CONCURRENCY = 6
const TIMEOUT_MS = 8000

const baseOrigin = new URL(BASE_URL).origin
const seed = ['/', '/start', '/browse', '/browse?facet=monitored', '/state', '/changelog', '/signals', '/graveyard', '/agents', '/developers', '/methodology', '/submit', '/about', '/privacy', '/terms']
const queue = seed.map((p) => [p, '(seed)'])
const visited = new Set()
const failed = []
let checked = 0
let active = 0

/** Map an href to a crawlable local path, or null if external/non-http. */
const toLocal = (href) => {
  if (!href || href.startsWith('mailto:') || href.startsWith('data:') || href.startsWith('#')) return null
  try {
    const u = new URL(href, BASE_URL)
    if (u.origin !== baseOrigin && u.origin !== CANON) return null
    return u.pathname + u.search
  } catch {
    return null
  }
}

const dedupKey = (path) => path.split('#')[0].replace(/\/$/, '') || '/'

const extractUrls = (html) => {
  const urls = new Set()
  for (const re of [/href=["']([^"']+)["']/g, /src=["']([^"']+)["']/g]) {
    let m
    while ((m = re.exec(html)) !== null) urls.add(m[1])
  }
  return [...urls]
}

const fetchWithTimeout = async (url, ms) => {
  const ctrl = new AbortController()
  const tid = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { signal: ctrl.signal, redirect: 'follow' })
  } finally {
    clearTimeout(tid)
  }
}

const enqueue = (href, parent) => {
  const path = toLocal(href)
  if (!path) return
  const key = dedupKey(path)
  if (visited.has(key) || visited.size >= MAX_URLS) return
  visited.add(key)
  queue.push([path, parent])
}

const processUrl = async (path, parent) => {
  checked++
  try {
    const res = await fetchWithTimeout(BASE_URL + path, TIMEOUT_MS)
    if (res.status >= 400) {
      failed.push({ url: path, status: res.status, foundOn: parent })
      return
    }
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('text/html')) {
      for (const href of extractUrls(await res.text())) enqueue(href, path)
    } else if (ct.includes('xml')) {
      const body = await res.text()
      for (const m of body.matchAll(/<(?:loc|link)>([^<]+)<\/(?:loc|link)>/g)) enqueue(m[1], path)
    }
  } catch (err) {
    failed.push({ url: path, status: err.name === 'AbortError' ? 'TIMEOUT' : `ERROR: ${err.message}`, foundOn: parent })
  }
}

// Mark seeds visited, then BFS with a concurrency cap.
for (const [p] of queue) visited.add(dedupKey(p))
enqueue('/sitemap.xml', '(seed)')

while (queue.length > 0 || active > 0) {
  while (active < CONCURRENCY && queue.length > 0) {
    const [path, parent] = queue.shift()
    active++
    processUrl(path, parent).finally(() => active--)
  }
  await new Promise((r) => setTimeout(r, 25))
}

if (failed.length > 0) {
  console.log('\n--- Failed URLs ---')
  console.table(failed.map((f) => ({ url: f.url, status: f.status, 'found on': f.foundOn })))
  console.log(`\n${failed.length} failures out of ${checked} checked.`)
  process.exit(1)
}
console.log(`✓ ${checked} URLs checked, no internal 404s`)
