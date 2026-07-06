// Shared helpers for apimap.dev category gap reports.

export const APIMAP_CATEGORIES = [
  'ai',
  'payments',
  'search',
  'security',
  'ecommerce',
  'auth',
  'social',
  'communication',
  'weather',
  'storage',
  'maps',
  'finance',
  'entertainment',
  'developer',
]

export const CATEGORY_EMOJI = {
  ai: '🤖',
  payments: '💳',
  search: '🔍',
  security: '🔐',
  ecommerce: '🛒',
  auth: '🔑',
  social: '💬',
  communication: '📨',
  weather: '🌤',
  storage: '💾',
  maps: '🗺',
  finance: '💰',
  entertainment: '🎬',
  developer: '🛠',
}

/** apimap slug → public-apis-style source category for probe hints */
export const SOURCE_CATEGORY = {
  ai: 'Machine Learning',
  payments: 'Business',
  search: 'Open Data',
  security: 'Security',
  ecommerce: 'Business',
  auth: 'Authentication',
  social: 'Social',
  communication: 'Social',
  weather: 'Weather',
  storage: 'Development',
  maps: 'Geocoding',
  finance: 'Finance',
  entertainment: 'Entertainment',
  developer: 'Development',
}

export const AUTH_MAP = {
  none: 'none',
  'api-key': 'apiKey',
  bearer: 'apiKey',
  oauth2: 'oauth',
  oauth: 'oauth',
}

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

export function loadSeedIndex(seedPath, importedPath) {
  const seedSrc = readFileSync(seedPath, 'utf8') + readFileSync(importedPath, 'utf8')
  const seedHosts = new Set()
  const seedSlugs = new Set()
  for (const m of seedSrc.matchAll(/slug:\s*['"]([^'"]+)['"]/g)) seedSlugs.add(m[1])
  for (const m of seedSrc.matchAll(/"slug":\s*"([^"]+)"/g)) seedSlugs.add(m[1])
  for (const m of seedSrc.matchAll(/baseUrl:\s*['"]https?:\/\/([^'"/]+)/g)) seedHosts.add(m[1].replace(/^www\./, ''))
  for (const m of seedSrc.matchAll(/"baseUrl":\s*"https?:\/\/([^"/]+)/g)) seedHosts.add(m[1].replace(/^www\./, ''))
  return { seedHosts, seedSlugs }
}

export function haveApi(a, { seedHosts, seedSlugs }) {
  if (seedSlugs.has(a.id)) return true
  const host = hostKey(a.baseUrl)
  return [...seedHosts].some((h) => hostAliases(host).some((x) => x === h || host === h))
}

export function sampleFromApimap(a) {
  const eps = a.endpoints ?? []
  const pick = eps.find((e) => e.path && e.path !== '/') ?? eps[0]
  if (!pick?.path) return '/'
  const path = pick.path.startsWith('?') ? `/${pick.path}` : pick.path.startsWith('/') ? pick.path : `/${pick.path}`
  return path.replace(/\{[^}]+\}/g, (m) => {
    const k = m.slice(1, -1).toLowerCase()
    if (k.includes('lat') || k.includes('lon')) return k.includes('lat') ? '52.52' : '13.41'
    if (k.includes('query') || k.includes('q')) return 'test'
    if (k.includes('date') || k.includes('time')) return '2026-07-05'
    if (k.includes('country') || k.includes('region')) return 'US'
    if (k.includes('currency') || k.includes('code')) return 'USD'
    if (k.includes('id') || k.includes('movie') || k.includes('video')) return '1'
    if (k.includes('media')) return 'movie'
    return '1'
  })
}

export function slugify(id, name) {
  const base = (id || name || 'api').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return base.slice(0, 48)
}

export function toCandidate(a, category) {
  const auth = AUTH_MAP[a.authType] ?? 'apiKey'
  return {
    slug: slugify(a.id, a.name),
    name: a.name,
    emoji: CATEGORY_EMOJI[category] ?? '🔌',
    tagline: (a.description || '').slice(0, 80),
    description: a.longDescription || a.description || '',
    sourceCategory: SOURCE_CATEGORY[category] ?? 'Development',
    docsUrl: a.docsUrl || a.baseUrl,
    baseUrl: a.baseUrl.replace(/\/+$/, ''),
    sampleEndpoint: sampleFromApimap(a),
    auth,
    apimapScore: a.score ?? 0,
    apimapId: a.id,
    apimapCategory: category,
    endpointCount: a.endpoints?.length ?? 0,
    hasFreeTier: !!a.hasFreeTier,
    rateLimit: a.rateLimit || 'Unpublished',
    source: `apimap.dev/${category}`,
  }
}

import { readFileSync } from 'node:fs'
