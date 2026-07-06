import { describe, expect, it } from 'vitest'
import {
  apiLogoHost,
  apiLogoHosts,
  apiLogoShape,
  apiLogoSrc,
  brandLogoHost,
} from '../../src/data/api-logo'

describe('brandLogoHost', () => {
  it('strips a known API subdomain to the registrable root', () => {
    expect(brandLogoHost('api.themoviedb.org')).toBe('themoviedb.org')
    expect(brandLogoHost('docs.stripe.com')).toBe('stripe.com')
  })
  it('returns null for a two-label host', () => {
    expect(brandLogoHost('themoviedb.org')).toBeNull()
  })
  it('does not strip a non-brand subdomain', () => {
    expect(brandLogoHost('foo.example.com')).toBeNull()
  })
})

describe('apiLogoHosts', () => {
  it('emits brand root before the raw host, deduped across docs+base', () => {
    const hosts = apiLogoHosts({ docsUrl: 'https://api.themoviedb.org/3', baseUrl: 'https://api.themoviedb.org' })
    expect(hosts).toEqual(['themoviedb.org', 'api.themoviedb.org'])
  })
  it('skips unparseable and localhost URLs', () => {
    expect(apiLogoHosts({ docsUrl: 'not-a-url', baseUrl: 'http://localhost:8787' })).toEqual([])
  })
})

describe('apiLogoHost', () => {
  it('prefers a non-api host', () => {
    expect(apiLogoHost({ docsUrl: 'https://api.themoviedb.org', baseUrl: 'https://api.themoviedb.org' })).toBe('themoviedb.org')
  })
  it('returns null when no host resolves', () => {
    expect(apiLogoHost({ docsUrl: '', baseUrl: '' })).toBeNull()
  })
})

describe('apiLogoSrc', () => {
  it('builds a relative icon proxy path by default', () => {
    expect(apiLogoSrc({ docsUrl: 'https://frankfurter.dev', baseUrl: 'https://api.frankfurter.dev' })).toBe(
      '/icons/frankfurter.dev?sz=64&v=3',
    )
  })
  it('builds an absolute URL when requested', () => {
    expect(
      apiLogoSrc({ docsUrl: 'https://frankfurter.dev', baseUrl: 'https://api.frankfurter.dev' }, { absolute: true, size: 128 }),
    ).toBe('https://shipapis.dev/icons/frankfurter.dev?sz=128&v=3')
  })
  it('returns null when no host resolves', () => {
    expect(apiLogoSrc({ docsUrl: '', baseUrl: '' })).toBeNull()
  })
})

describe('apiLogoShape', () => {
  it('returns host + absolute url fields', () => {
    expect(apiLogoShape({ docsUrl: 'https://frankfurter.dev', baseUrl: 'https://api.frankfurter.dev' })).toEqual({
      logo_host: 'frankfurter.dev',
      logo_url: 'https://shipapis.dev/icons/frankfurter.dev?sz=64&v=3',
    })
  })
  it('nulls both fields when no host resolves', () => {
    expect(apiLogoShape({ docsUrl: '', baseUrl: '' })).toEqual({ logo_host: null, logo_url: null })
  })
})
