import { describe, expect, it } from 'vitest'
import { metaFields, metaSourceLabel } from '../../src/ui/lib/meta-field'
import { makeApi } from '../helpers/fixtures'

const byLabel = (api: Parameters<typeof metaFields>[0]) =>
  Object.fromEntries(metaFields(api).map((f) => [f.label, f]))

describe('metaFields', () => {
  it('returns the full canonical row set', () => {
    const labels = metaFields(makeApi()).map((f) => f.label)
    expect(labels).toEqual([
      'Auth',
      'CORS',
      'Commercial use',
      'HTTPS',
      'Free tier',
      'Rate limit',
      'Card required',
      'Data license',
    ])
  })

  it('derives honest default sources without provenance metadata', () => {
    const rows = byLabel(makeApi({ cors: 'unknown', commercialUse: 'unclear' }))
    expect(rows['Auth'].source).toBe('documented')
    expect(rows['CORS'].source).toBe('pending') // unknown cors → pending
    expect(rows['Commercial use'].source).toBe('pending') // unclear → pending
    expect(rows['Rate limit'].source).toBe('pending')
  })

  it('marks CORS as an import probe when a concrete value is present', () => {
    const rows = byLabel(makeApi({ cors: 'yes' }))
    expect(rows['CORS'].source).toBe('import')
    expect(rows['CORS'].tone).toBe('good')
  })

  it('applies tone rules for CORS, HTTPS, commercial and card', () => {
    const yes = byLabel(makeApi({ cors: 'yes', https: true, commercialUse: 'yes', requiresCard: false }))
    expect(yes['CORS'].tone).toBe('good')
    expect(yes['HTTPS'].tone).toBe('good')
    expect(yes['Commercial use'].tone).toBe('good')
    expect(yes['Card required'].tone).toBe('good')

    const no = byLabel(makeApi({ cors: 'no', https: false, commercialUse: 'no', requiresCard: true }))
    expect(no['CORS'].tone).toBe('bad')
    expect(no['HTTPS'].tone).toBe('bad')
    expect(no['Commercial use'].tone).toBe('bad')
    expect(no['Card required'].tone).toBe('meh')
  })

  it('honors explicit provenance overrides', () => {
    const api = {
      ...makeApi({ cors: 'yes' }),
      metaProvenance: {
        auth: 'probed' as const,
        cors: 'probed' as const,
        commercialUse: 'documented' as const,
        https: 'probed' as const,
        freeTier: 'documented' as const,
        rateLimit: 'probed' as const,
      },
    }
    const rows = byLabel(api)
    expect(rows['Auth'].source).toBe('probed')
    expect(rows['CORS'].source).toBe('probed')
    expect(rows['Rate limit'].source).toBe('probed')
  })
})

describe('metaSourceLabel', () => {
  it('maps each source to human copy', () => {
    expect(metaSourceLabel('probed')).toBe('live probe')
    expect(metaSourceLabel('documented')).toBe('from docs')
    expect(metaSourceLabel('import')).toBe('import probe')
    expect(metaSourceLabel('pending')).toBe('pending')
  })
})
