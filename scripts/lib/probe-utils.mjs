export const UA = 'shipapisbot/1.0 (+https://shipapis.dev/methodology)'
export const ORIGIN = 'https://shipapis.dev'

export const slugify = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48)

export function trimJson(obj, depth = 0) {
  if (obj == null) return obj
  if (typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.slice(0, 2).map((x) => trimJson(x, depth + 1))
  const out = {}
  let n = 0
  for (const [k, v] of Object.entries(obj)) {
    if (n++ >= 8) break
    out[k] = typeof v === 'object' ? trimJson(v, depth + 1) : v
  }
  return out
}

/** Reject Postman collection JSON mistaken for a live API response. */
export function isPostmanCollection(json) {
  if (!json || typeof json !== 'object') return false
  const info = json.info
  if (!info || typeof info !== 'object') return false
  if (info._postman_id) return true
  const schema = String(info.schema || '')
  if (schema.includes('schema.getpostman.com')) return true
  return false
}

/** Reject OpenAPI/Swagger schema JSON mistaken for a live API response. */
export function isOpenApiSpec(json) {
  if (!json || typeof json !== 'object') return false
  if (typeof json.openapi === 'string' || typeof json.swagger === 'string') return true
  if (json.paths && json.info && (json.components || json.definitions)) return true
  return false
}

export function resolveHintRequest(hint) {
  if (!hint?.baseUrl) return null
  let ep = String(hint.sampleEndpoint ?? '/')
  if (!ep.startsWith('/')) ep = `/${ep}`

  ep = ep.replace(/\{([A-Z][A-Z0-9_]*)\}/g, (_, name) => process.env[name] ?? `{${name}}`)

  if (/\{[A-Z][A-Z0-9_]*\}|YOUR_API_KEY|YOUR_KEY/i.test(ep)) {
    if (hint.keyEnv && !process.env[hint.keyEnv]) return null
  }

  const url = hint.baseUrl.replace(/\/+$/, '') + ep
  const headers = {}
  if (hint.keyHeader && hint.keyEnv && process.env[hint.keyEnv]) {
    const val = process.env[hint.keyEnv]
    headers[hint.keyHeader] =
      hint.keyHeader.toLowerCase() === 'authorization' ? `Bearer ${val}` : val
  }
  if (hint.keyHeader === 'trakt-api-key' && process.env[hint.keyEnv]) {
    headers['trakt-api-version'] = '2'
  }

  const needsKey = hint.auth === 'apiKey' || hint.keyEnv || /[?&](api_key|apikey|apiKey|token)=/i.test(ep)
  const auth = hint.auth || (needsKey ? 'apiKey' : 'none')

  return { url, headers, auth, sampleEndpoint: ep }
}

/** apiKey endpoints that return 401/403 with JSON still prove the API exists. */
export function isApiKeyProbeHit(status, json) {
  if (!json || isPostmanCollection(json) || isOpenApiSpec(json)) return false
  if (status >= 200 && status < 300) return true
  if (![401, 403, 422, 400].includes(status)) return false
  const hay = JSON.stringify(json).toLowerCase()
  return /api.?key|apikey|auth|token|credential|unauthorized|forbidden|subscription|invalid.?key|access.?denied|missing.?key/.test(hay)
}

export async function probeUrl(url, opts = {}) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 8000)
  const t0 = performance.now()
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        'user-agent': UA,
        origin: ORIGIN,
        accept: 'application/json, text/json, */*',
        ...opts.headers,
      },
    })
    const text = await res.text()
    const latencyMs = Math.round(performance.now() - t0)
    const ct = res.headers.get('content-type') || ''
    let json = null
    if (ct.includes('json') || text.trim().startsWith('{') || text.trim().startsWith('[')) {
      try { json = JSON.parse(text) } catch { /* html error page */ }
    }
    const cors = res.headers.get('access-control-allow-origin')
    return {
      httpStatus: res.status,
      latencyMs,
      json,
      corsObserved: cors === '*' || cors === ORIGIN ? true : cors ? true : false,
      contentType: ct,
    }
  } catch (e) {
    return { httpStatus: 0, latencyMs: 0, json: null, corsObserved: null, error: String(e) }
  } finally {
    clearTimeout(t)
  }
}

/** Turn a docs URL into fetchable text (github → raw). */
export function docsFetchUrl(docsUrl) {
  try {
    const u = new URL(docsUrl)
    if (u.hostname === 'github.com') {
      const parts = u.pathname.split('/').filter(Boolean)
      if (parts.length >= 2) {
        const [owner, repo, ...rest] = parts
        if (rest[0] === 'blob') return `https://raw.githubusercontent.com/${owner}/${repo}/${rest.slice(1).join('/')}`
        if (rest.length === 0 || rest[0] === 'tree') return `https://raw.githubusercontent.com/${owner}/${repo}/master/README.md`
        return `https://raw.githubusercontent.com/${owner}/${repo}/master/${rest.join('/')}`
      }
    }
    return docsUrl
  } catch {
    return docsUrl
  }
}

/** Pull likely JSON GET endpoints from docs HTML/markdown. */
export function extractProbeUrls(text, limit = 12) {
  const found = new Set()
  const patterns = [
    /curl[^'"\n]*['"](https?:\/\/[^'"\s]+)['"]/gi,
    /GET\s+(https?:\/\/[^\s)'"]+)/gi,
    /`(https?:\/\/[^`]+?\.json[^`]*)`/gi,
    /(https?:\/\/api\.[a-z0-9.-]+\/[^\s"'<>)\]]+)/gi,
    /(https?:\/\/[a-z0-9.-]+\/api\/[^\s"'<>)\]]+)/gi,
  ]
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      let url = m[1].replace(/[.,;]+$/, '')
      if (!url.includes('example.com') && !url.includes('localhost')) found.add(url)
      if (found.size >= limit) break
    }
  }
  return [...found]
}

export function guessEndpoints(candidate) {
  const urls = []
  const docs = candidate.docsUrl || ''
  try {
    const u = new URL(docs)
    const host = u.hostname.replace(/^www\./, '')
    const proto = u.protocol

    if (/\.json(\?|$)/i.test(docs)) urls.push(docs)

    const bases = new Set([
      `${proto}//${u.hostname}`,
      `${proto}//api.${host}`,
      `${proto}//${host}`,
    ])

    const paths = [
      '/',
      '/api',
      '/api/v1',
      '/api/v2',
      '/api/v3',
      '/v1',
      '/v2',
      '/v3',
      '/health',
      '/healthz',
      '/status',
      '/ping',
      '/random',
      '/fact',
      '/facts',
      '/breeds',
      '/search',
      '/entries',
      '/data.json',
      '/openapi.json',
      '/swagger.json',
      '/api.json',
      '/index.json',
      '/feed.json',
      '/list',
      '/all',
      '/latest',
      '/today',
      '/quotes/random',
      '/quote/random',
      '/jokes/random',
      '/activity',
      '/users',
      '/products',
      '/posts/1',
      '/ticker',
      '/price',
      '/rates',
      '/convert',
      '/countries',
      '/regions',
      '/locations',
      '/search.json',
      '/metadata',
      '/info',
      '/version',
      '/metrics',
      '/.well-known/openapi.json',
      '/now',
    ]

    for (const base of bases) {
      for (const p of paths) {
        urls.push(base.replace(/\/+$/, '') + p)
      }
    }

    // pathname hints from docs site itself
    if (u.pathname && u.pathname !== '/') {
      const p = u.pathname.replace(/\/$/, '')
      if (p.endsWith('.json')) urls.push(`${proto}//${u.hostname}${p}`)
      else urls.push(`${proto}//${u.hostname}${p}.json`)
    }
  } catch { /* skip */ }

  return [...new Set(urls)].slice(0, 28)
}

export function splitBaseAndEndpoint(fullUrl) {
  try {
    const u = new URL(fullUrl)
    const baseUrl = `${u.protocol}//${u.host}`
    const sampleEndpoint = u.pathname + u.search
    return { baseUrl: baseUrl.replace(/\/+$/, ''), sampleEndpoint: sampleEndpoint || '/' }
  } catch {
    return null
  }
}

const CAT_EMOJI = {
  Animals: '🐾', Anime: '🍥', 'Art & Design': '🎨', Books: '📚', Business: '💼',
  Calendar: '📅', 'Cloud Storage & File Sharing': '☁️', Cryptocurrency: '🪙',
  'Currency Exchange': '💱', Development: '🔧', Dictionaries: '📖', Documents: '📄',
  'Data Validation': '✅', Email: '✉️', Entertainment: '🎭', Environment: '🌿',
  Finance: '💰', 'Food & Drink': '🍔', 'Games & Comics': '🎮', Geocoding: '🗺',
  Government: '🏛', Health: '🩺', Jobs: '💼', 'Machine Learning': '🤖', Music: '🎵',
  News: '📰', 'Open Data': '📊', Personality: '🎭', Phone: '📞', Photography: '📷',
  'Science & Math': '🔬', Security: '🔐', Social: '💬', 'Sports & Fitness': '⚽',
  Transportation: '🚆', Vehicle: '🚗', Video: '🎬', Weather: '🌤', Tracking: '📍',
  'Anti-Malware': '🛡', Blockchain: '⛓', Patent: '📜', 'Test Data': '🧪',
  'URL Shorteners': '🔗', 'Text Analysis': '📝', Anime: '🍥',
}

export function emojiFor(category) {
  return CAT_EMOJI[category] || '🔌'
}

/** Original-ish copy from listing metadata — not a verbatim copy of source description. */
export function writeCopy(candidate) {
  const name = candidate.name
  const src = (candidate.description || '').replace(/\s+/g, ' ').trim()
  const tagline = src
    ? `${name} — ${src.slice(0, 55)}${src.length > 55 ? '…' : ''}`.slice(0, 78)
    : `${name} — keyless JSON API we probed live`
  const desc = src
    ? `${name} exposes ${src.charAt(0).toLowerCase()}${src.slice(1)} We verified a keyless GET endpoint returning JSON (${candidate.sourceCategory || 'general'}). Check the provider docs for rate limits and terms before production use.`
    : `${name} is listed as a free public API. We confirmed a live JSON response on a sample GET with no API key in the request. Review the provider documentation for quotas and acceptable use.`
  return { tagline, description: desc.slice(0, 520) }
}
