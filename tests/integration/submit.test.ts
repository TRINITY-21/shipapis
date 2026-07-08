import { describe, expect, it } from 'vitest'
import { getText, req } from '../helpers/app'

const post = (body: unknown, asText = false) =>
  req('/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: asText ? (body as string) : JSON.stringify(body),
  })

// The test harness runs with no DB and no TURNSTILE_SECRET_KEY, so Turnstile verification is
// skipped (dev/test) and everything up to the DB write is exercised hermetically.
const VALID = {
  name: 'Example API',
  category: 'weather',
  base_url: 'https://api.example.com/v1',
  sample_endpoint: '/forecast?lat=52',
  docs_url: 'https://example.com/docs',
  auth: 'none',
}

describe('POST /submit', () => {
  it('rejects a non-JSON body with 400', async () => {
    const res = await post('not json', true)
    expect(res.status).toBe(400)
  })

  it('silently accepts and drops a honeypot-filled submission', async () => {
    const res = await post({ ...VALID, company: 'spambot ltd' })
    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
  })

  it('400s on missing/invalid fields and names them', async () => {
    const res = await post({ name: 'x', base_url: 'http://insecure.com', sample_endpoint: '', docs_url: 'nope' })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.error).toMatch(/base_url/)
    expect(body.error).toMatch(/docs_url/)
  })

  it('rejects a non-https base_url', async () => {
    const res = await post({ ...VALID, base_url: 'http://api.example.com' })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/base_url/)
  })

  it('passes validation for a well-formed submission (reaches the persistence step)', async () => {
    // With no DB bound in tests, a fully-valid payload gets past validation to the 503 DB guard —
    // proving validation + the (skipped) bot check let a real submission through.
    const res = await post(VALID)
    expect(res.status).toBe(503)
  })
})

describe('GET /submit', () => {
  it('renders the form with a honeypot and an email field', async () => {
    const { res, text } = await getText('/submit')
    expect(res.status).toBe(200)
    expect(text).toContain('name="company"') // honeypot
    expect(text).toContain('name="email"')
    expect(text).toContain('id="submit-form"')
  })
})
