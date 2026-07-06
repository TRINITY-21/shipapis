// Expand single-endpoint APIs via OpenAPI + docs fetch (batch script).

import { matchRecipe } from './endpoint-recipes.mjs'
import {
  MIN_ENDPOINTS,
  MAX_ENDPOINTS,
  describePath,
  normPath,
  heuristicPaths,
  finalizeEndpoints,
  expandEndpointsSync,
} from './endpoint-heuristics.mjs'
import { docsFetchUrl, extractProbeUrls, UA } from './probe-utils.mjs'

/** @typedef {{ method?: string, path: string, description: string, monitored?: boolean }} EndpointRow */

/** @param {string} full @param {string} baseUrl */
function toRelative(full, baseUrl) {
  try {
    const u = new URL(full)
    const b = new URL(baseUrl)
    if (u.hostname.replace(/^www\./, '') !== b.hostname.replace(/^www\./, '')) return null
    let path = u.pathname + u.search
    const basePath = b.pathname.replace(/\/$/, '')
    if (basePath && basePath !== '/' && path.startsWith(basePath)) {
      path = path.slice(basePath.length) || '/'
    }
    return normPath(path)
  } catch {
    return null
  }
}

/** @param {object} openapi @param {string} baseUrl */
export function pathsFromOpenApi(openapi, baseUrl) {
  if (!openapi?.paths) return []
  const rows = []
  for (const [path, methods] of Object.entries(openapi.paths)) {
    const get = methods.get || methods.GET
    if (!get) continue
    const desc = (get.summary || get.description || '').replace(/\s+/g, ' ').trim()
    rows.push({
      path: normPath(path),
      description: desc ? desc.slice(0, 120) : describePath(path),
    })
  }
  return rows.slice(0, MAX_ENDPOINTS)
}

/** @param {string} text @param {string} baseUrl */
export function pathsFromDocs(text, baseUrl) {
  const found = new Set()
  const patterns = [
    /`(\/[a-zA-Z0-9_./?&=%-]{2,120})`/g,
    /"(?:path|endpoint|route)":\s*"(\/[^"]+)"/gi,
    /GET\s+(\/[a-zA-Z0-9_./?&=%-]{2,120})/gi,
    /(?:href|src)=["'](\/api\/[^"']+)["']/gi,
  ]
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      const p = m[1].split(/[<>\s]/)[0]
      if (p.length > 2 && p.length < 150 && !p.includes('..')) found.add(normPath(p))
    }
  }
  for (const url of extractProbeUrls(text, 8)) {
    const rel = toRelative(url, baseUrl)
    if (rel) found.add(rel)
  }
  return [...found].slice(0, MAX_ENDPOINTS).map((path) => ({
    path,
    description: describePath(path),
  }))
}

const OPENAPI_PATHS = [
  '/openapi.json',
  '/swagger.json',
  '/api-docs',
  '/api/openapi.json',
  '/v1/openapi.json',
  '/v2/openapi.json',
  '/v3/openapi.json',
  '/.well-known/openapi.json',
  '/docs/openapi.json',
  '/api/swagger.json',
]

/** @param {string} baseUrl */
async function fetchOpenApi(baseUrl) {
  const base = baseUrl.replace(/\/+$/, '')
  for (const p of OPENAPI_PATHS) {
    try {
      const res = await fetch(base + p, {
        signal: AbortSignal.timeout(6000),
        headers: { 'user-agent': UA, accept: 'application/json' },
      })
      if (!res.ok) continue
      const json = await res.json()
      if (json?.paths) return json
    } catch { /* next */ }
  }
  return null
}

/** @param {string} docsUrl */
async function fetchDocsText(docsUrl) {
  if (!docsUrl) return ''
  try {
    const res = await fetch(docsFetchUrl(docsUrl), {
      signal: AbortSignal.timeout(8000),
      headers: { 'user-agent': UA, accept: 'text/html, text/markdown, application/json, */*' },
    })
    if (!res.ok) return ''
    return (await res.text()).slice(0, 400_000)
  } catch {
    return ''
  }
}

/**
 * @param {{ slug: string, name: string, baseUrl: string, sampleEndpoint: string, docsUrl?: string, tagline?: string }} spec
 * @param {{ skipNetwork?: boolean }} [opts]
 * @returns {Promise<EndpointRow[]>}
 */
export async function expandEndpoints(spec, opts = {}) {
  const sample = normPath(spec.sampleEndpoint)
  const recipe = matchRecipe(spec.slug, spec.baseUrl, sample)
  if (recipe?.endpoints?.length >= MIN_ENDPOINTS) {
    return finalizeEndpoints(
      recipe.endpoints.map((e) => ({
        method: e.method || 'GET',
        path: normPath(e.path),
        description: e.description,
        monitored: !!e.monitored,
      })),
      sample,
    )
  }

  /** @type {Map<string, EndpointRow>} */
  const byPath = new Map()
  const add = (path, description, monitored = false) => {
    const p = normPath(path)
    if (!p || p.length > 200) return
    if (!byPath.has(p)) byPath.set(p, { method: 'GET', path: p, description: description.slice(0, 140), monitored })
    else if (monitored) byPath.get(p).monitored = true
  }

  for (const e of expandEndpointsSync(spec)) add(e.path, e.description, e.monitored)

  if (!opts.skipNetwork) {
    const openapi = await fetchOpenApi(spec.baseUrl)
    if (openapi) {
      for (const row of pathsFromOpenApi(openapi, spec.baseUrl)) add(row.path, row.description)
    }
    const docs = await fetchDocsText(spec.docsUrl)
    if (docs) {
      if (docs.trim().startsWith('{') && docs.includes('"paths"')) {
        try {
          for (const row of pathsFromOpenApi(JSON.parse(docs), spec.baseUrl)) add(row.path, row.description)
        } catch { /* */ }
      }
      for (const row of pathsFromDocs(docs, spec.baseUrl)) add(row.path, row.description)
    }
  }

  if (byPath.size < MIN_ENDPOINTS) {
    for (const p of heuristicPaths(spec, sample)) add(p, describePath(p, spec.name))
  }

  return finalizeEndpoints([...byPath.values()], sample)
}

export { expandEndpointsSync }
