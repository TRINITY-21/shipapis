import { beforeAll, describe, expect, it } from 'vitest'
import { getJson, getText, req } from '../helpers/app'

let slug: string
let status: string
beforeAll(async () => {
  const { body } = await getJson('/api/v1/apis?limit=1')
  slug = body.results[0].slug
  status = body.results[0].status
})

describe('GET /badge/:slug.svg', () => {
  it('renders an SVG badge for a known API', async () => {
    const { res, text } = await getText(`/badge/${slug}.svg`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/svg+xml')
    expect(res.headers.get('cache-control')).toContain('max-age=300')
    expect(text).toContain('<svg')
    expect(text).toContain('shipapis')
    expect(text).toContain('</svg>')
  })

  it('404s when the .svg extension is missing', async () => {
    const res = await req(`/badge/${slug}`)
    expect(res.status).toBe(404)
  })

  it('404s for an unknown slug', async () => {
    const res = await req('/badge/not-a-real-slug.svg')
    expect(res.status).toBe(404)
  })

  it('labels a dead API as "dead" and a catalogued one as "catalogued"', async () => {
    // Find one of each in the catalog to assert the label mapping end-to-end.
    const { body } = await getJson('/api/v1/apis?status=dead&limit=1')
    if (body.results.length) {
      const { text } = await getText(`/badge/${body.results[0].slug}.svg`)
      expect(text).toContain('dead')
    }
    const cat = await getJson('/api/v1/apis?limit=100')
    const unmon = (cat.body.results as any[]).find((a) => a.status === 'unmonitored')
    if (unmon) {
      const { text } = await getText(`/badge/${unmon.slug}.svg`)
      expect(text).toContain('catalogued')
    }
  })
})

describe('GET /icons/:host (validation path)', () => {
  it('rejects a malformed host with 400', async () => {
    // No dot / underscore → fails HOST_RE before any network/cache access.
    expect((await req('/icons/nodothost')).status).toBe(400)
    expect((await req('/icons/bad_host')).status).toBe(400)
  })
})
