import type { ApiEntry } from './seed'

const SITE = 'https://shipapis.dev'

/** Subdomains that rarely have a good favicon — prefer the registrable root. */
const BRAND_STRIP = new Set(['api', 'developer', 'docs', 'www', 'staging', 'beta', 'app'])

export type ApiLogoFields = Pick<ApiEntry, 'baseUrl' | 'docsUrl'>

function parseHost(raw: string | undefined): string | null {
  if (!raw) return null
  try {
    const host = new URL(raw).hostname.replace(/^www\./, '')
    if (!host || host === 'localhost' || host.endsWith('.local')) return null
    return host
  } catch {
    return null
  }
}

/** api.themoviedb.org → themoviedb.org */
export function brandLogoHost(host: string): string | null {
  const parts = host.split('.')
  if (parts.length >= 3 && BRAND_STRIP.has(parts[0])) return parts.slice(1).join('.')
  return null
}

/** Ordered hosts to try — brand root first, then docs, then API origin. */
export function apiLogoHosts(api: ApiLogoFields): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const add = (h: string | null) => {
    if (!h || seen.has(h)) return
    seen.add(h)
    out.push(h)
  }
  for (const raw of [api.docsUrl, api.baseUrl]) {
    const host = parseHost(raw)
    if (!host) continue
    add(brandLogoHost(host))
    add(host)
  }
  return out
}

/** Best single host for /icons/:host URLs. */
export function apiLogoHost(api: ApiLogoFields): string | null {
  const hosts = apiLogoHosts(api)
  return hosts.find((h) => !h.startsWith('api.')) ?? hosts[0] ?? null
}

/** Edge-cached favicon proxy. Pass absolute=true for machine payloads and OG cards. */
export function apiLogoSrc(api: ApiLogoFields, opts?: { size?: number; absolute?: boolean }): string | null {
  const host = apiLogoHost(api)
  if (!host) return null
  const size = opts?.size ?? 64
  const path = `/icons/${encodeURIComponent(host)}?sz=${size}&v=3`
  return opts?.absolute ? `${SITE}${path}` : path
}

/** Logo fields for JSON API records. */
export function apiLogoShape(api: ApiLogoFields) {
  const host = apiLogoHost(api)
  return {
    logo_host: host,
    logo_url: host ? `${SITE}/icons/${encodeURIComponent(host)}?sz=64&v=3` : null,
  }
}
