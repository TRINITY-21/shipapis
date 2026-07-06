import { describe, expect, it } from 'vitest'
import {
  breadcrumbLd,
  detailDesc,
  detailTitle,
  faqLd,
  itemListLd,
  webApiLd,
} from '../../src/ui/lib/seo'
import { makeApi, makeApis } from '../helpers/fixtures'

describe('detailTitle / detailDesc', () => {
  it('advertises uptime for a monitored API', () => {
    const api = makeApi({ name: 'Open-Meteo', status: 'healthy', auth: 'none' })
    const title = detailTitle(api, 'Weather')
    expect(title).toContain('Open-Meteo')
    expect(title).toContain('% uptime · shipapis')
    expect(detailDesc(api, 'Weather')).toMatch(/% uptime \(90d\)/)
  })

  it('labels a catalogued (unmonitored) API honestly', () => {
    const api = makeApi({ name: 'SomeAPI', status: 'unmonitored', auth: 'apiKey', sampleEndpoint: '/d?api_key=YOUR_API_KEY' })
    expect(detailTitle(api, 'Weather')).toContain('(catalogued)')
    expect(detailDesc(api, 'Weather')).toMatch(/Not probed by shipapis yet/)
  })
})

describe('breadcrumbLd', () => {
  it('numbers positions and omits the item URL for the current (last) crumb', () => {
    const ld = breadcrumbLd([['Home', '/'], ['Weather', '/category/weather'], ['Open-Meteo']])
    expect(ld['@type']).toBe('BreadcrumbList')
    expect(ld.itemListElement.map((e) => e.position)).toEqual([1, 2, 3])
    expect(ld.itemListElement[0].item).toBe('https://shipapis.dev/')
    expect(ld.itemListElement[2]).not.toHaveProperty('item')
  })
})

describe('itemListLd', () => {
  it('counts items and links each to its detail page', () => {
    const items = makeApis([{ slug: 'a' }, { slug: 'b' }])
    const ld = itemListLd('Weather APIs', items)
    expect(ld.numberOfItems).toBe(2)
    expect(ld.itemListElement[0]).toMatchObject({ position: 1, url: 'https://shipapis.dev/api/a' })
    expect(ld.itemListElement[1].position).toBe(2)
  })
})

describe('faqLd', () => {
  it('maps q/a pairs into Question/Answer nodes', () => {
    const ld = faqLd([{ q: 'What?', a: 'This.' }])
    expect(ld['@type']).toBe('FAQPage')
    expect(ld.mainEntity[0]).toMatchObject({
      '@type': 'Question',
      name: 'What?',
      acceptedAnswer: { '@type': 'Answer', text: 'This.' },
    })
  })
})

describe('webApiLd', () => {
  it('declares the API free with a zero-price offer', () => {
    const ld = webApiLd(makeApi({ name: 'X', docsUrl: 'https://d' }), 'Weather')
    expect(ld['@type']).toBe('WebAPI')
    expect(ld.isAccessibleForFree).toBe(true)
    expect(ld.offers).toMatchObject({ price: '0', priceCurrency: 'USD' })
    expect(ld.documentation).toBe('https://d')
  })
})
