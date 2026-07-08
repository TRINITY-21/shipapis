import { beforeAll, describe, expect, it } from 'vitest'
import { getText, req } from '../helpers/app'
import { LEAK_MARKERS, countTag, jsonLdBlocks, jsonLdRaw, metaContent, titleText } from '../helpers/html'

let apiA: string
let apiB: string
beforeAll(async () => {
  const { getJson } = await import('../helpers/app')
  const { body } = await getJson('/api/v1/apis?limit=2')
  apiA = body.results[0].slug
  apiB = body.results[1].slug
})

// Every rendered page these must hold. Loaded lazily so the dynamic api/compare paths use real slugs.
function pageList() {
  return [
    ['/', 'Home'],
    ['/browse?facet=monitored', 'Browse'],
    ['/c/weather', 'Category'],
    ['/graveyard', 'Graveyard'],
    ['/signals', 'Signals'],
    ['/changelog', 'Changelog'],
    ['/state', 'State'],
    ['/start', 'Start'],
    ['/agents', 'Agents'],
    ['/methodology', 'Methodology'],
    ['/submit', 'Submit'],
    ['/about', 'About'],
    ['/privacy', 'Privacy'],
    ['/terms', 'Terms'],
    [`/api/${apiA}`, 'Detail'],
    [`/compare/${apiA}/${apiB}`, 'Compare'],
  ] as const
}

describe('SSR page invariants', () => {
  it('renders every page as valid, single-h1, described HTML', async () => {
    for (const [path, label] of pageList()) {
      const { res, text } = await getText(path)
      expect(res.status, `${label} ${path} status`).toBe(200)
      expect(res.headers.get('content-type'), `${label} content-type`).toContain('text/html')
      expect(text, `${label} lang`).toContain('<html lang="en">')

      const title = titleText(text)
      expect(title, `${label} <title>`).toBeTruthy()
      expect((title ?? '').trim().length, `${label} title non-empty`).toBeGreaterThan(0)

      expect(metaContent(text, 'name', 'description'), `${label} meta description`).toBeTruthy()

      expect(countTag(text, 'h1'), `${label} exactly one <h1>`).toBe(1)
    }
  })

  it('emits Open Graph and Twitter card metadata on every page', async () => {
    for (const [path, label] of pageList()) {
      const { text } = await getText(path)
      expect(metaContent(text, 'property', 'og:title'), `${label} og:title`).toBeTruthy()
      expect(metaContent(text, 'property', 'og:image'), `${label} og:image`).toContain('https://shipapis.dev')
      expect(metaContent(text, 'name', 'twitter:card'), `${label} twitter:card`).toBe('summary_large_image')
    }
  })

  it('never leaks template markers into the body', async () => {
    for (const [path, label] of pageList()) {
      const { text } = await getText(path)
      for (const marker of LEAK_MARKERS) {
        expect(text.includes(marker), `${label} ${path} leaked "${marker}"`).toBe(false)
      }
    }
  })

  it('emits only valid, breakout-safe JSON-LD', async () => {
    for (const [path, label] of pageList()) {
      const { text } = await getText(path)
      // Raw payloads must not contain a literal </script> (would break out of the tag).
      for (const raw of jsonLdRaw(text)) {
        expect(raw.includes('</script>'), `${label} JSON-LD breakout`).toBe(false)
      }
      // Every block must parse and carry the schema.org context.
      const blocks = jsonLdBlocks(text) // throws if any block is invalid JSON
      for (const b of blocks) expect(b['@context']).toBe('https://schema.org')
    }
  })
})

describe('detail page specifics', () => {
  it('carries a canonical URL and WebAPI structured data', async () => {
    const { text } = await getText(`/api/${apiA}`)
    expect(text).toContain(`<link rel="canonical" href="https://shipapis.dev/api/${apiA}"`)
    const graph = jsonLdBlocks(text).flatMap((b) => b['@graph'] ?? [b])
    const types = graph.map((n: any) => n['@type'])
    expect(types).toContain('WebAPI')
    expect(types).toContain('BreadcrumbList')
  })
})

describe('analytics tags', () => {
  it('always ships the Cloudflare Web Analytics beacon', async () => {
    const { text } = await getText('/')
    expect(text).toContain('static.cloudflareinsights.com/beacon.min.js')
    expect(text).toContain('efb68a7bc53942bfb1ebb54c11e63714')
  })

  it('omits GA4 when GA_MEASUREMENT_ID is unset (test env)', async () => {
    const { text } = await getText('/')
    expect(text).not.toContain('googletagmanager.com/gtag/js')
    expect(text).not.toContain('gtag(')
  })

  it('emits GA4 gtag when GA_MEASUREMENT_ID is a valid G- id', async () => {
    const { text } = await getText('/', undefined, { DB: undefined, GA_MEASUREMENT_ID: 'G-TESTMEASURE1' })
    expect(text).toContain('googletagmanager.com/gtag/js?id=G-TESTMEASURE1')
    expect(text).toContain("gtag('config','G-TESTMEASURE1'")
    // CF beacon still present alongside GA4
    expect(text).toContain('static.cloudflareinsights.com/beacon.min.js')
  })

  it('discloses both analytics tools on /privacy', async () => {
    const { text } = await getText('/privacy')
    expect(text).toContain('Cloudflare Web Analytics')
    expect(text).toContain('Google Analytics 4')
  })
})

describe('routing & error pages', () => {
  it('redirects /browse without params to the default facet', async () => {
    const res = await req('/browse')
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toContain('facet=monitored')
  })

  it('404s an unknown category, api and arbitrary path with the NotFound page', async () => {
    for (const path of ['/c/nope', '/api/nope-nope', '/totally/unknown/path']) {
      const { res, text } = await getText(path)
      expect(res.status, path).toBe(404)
      expect(text, path).toContain('<html lang="en">')
    }
  })

  it('301-redirects the pre-rename /developers onto /agents', async () => {
    const res = await req('/developers')
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('/agents')
  })

  it('preserves a deep-linked ?q= through the /browse default redirect (SearchAction target)', async () => {
    const res = await req('/browse?q=weather')
    expect(res.status).toBe(302)
    const loc = res.headers.get('location') ?? ''
    expect(loc).toContain('facet=monitored')
    expect(loc).toContain('q=weather')
  })

  it('redirects a not-yet-rendered OG card to the site card instead of 404ing', async () => {
    const res = await req('/og/api-does-not-exist.png')
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/og/home.png')
  })
})
