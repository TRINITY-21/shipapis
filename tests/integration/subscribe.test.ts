import { describe, expect, it } from 'vitest'
import { getText, req } from '../helpers/app'

const post = (body: unknown, asText = false) =>
  req('/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: asText ? (body as string) : JSON.stringify(body),
  })

// No DB in the test harness, so a valid address reaches the 503 persistence guard — everything up
// to (but not including) the D1 write is exercised hermetically.
describe('POST /subscribe', () => {
  it('rejects a non-JSON body with 400', async () => {
    expect((await post('nope', true)).status).toBe(400)
  })

  it('silently accepts and drops a honeypot-filled subscribe', async () => {
    const res = await post({ email: 'a@b.com', company: 'spambot' })
    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
  })

  it('400s an invalid email', async () => {
    const res = await post({ email: 'not-an-email' })
    expect(res.status).toBe(400)
    expect((await res.json()).ok).toBe(false)
  })

  it('passes validation for a real email (reaches the persistence step)', async () => {
    expect((await post({ email: 'reader@example.com' })).status).toBe(503)
  })
})

describe('newsletter form', () => {
  it('ships the footer subscribe form with a honeypot on the home page', async () => {
    const { text } = await getText('/')
    expect(text).toContain('class="newsletter"')
    expect(text).toContain('name="company"') // honeypot
  })
})

describe('/unsubscribe', () => {
  it('400s a GET with no e/t params (shows the invalid-link page)', async () => {
    const { res, text } = await getText('/unsubscribe')
    expect(res.status).toBe(400)
    expect(text).toContain("didn't work")
  })

  it('400s a GET with e/t but no verifiable token (no DB in tests)', async () => {
    const res = await req('/unsubscribe?e=x%40y.com&t=abc')
    expect(res.status).toBe(400)
  })

  it('supports one-click POST (RFC 8058) — 400 without a valid token', async () => {
    const res = await req('/unsubscribe?e=x%40y.com&t=abc', { method: 'POST' })
    expect(res.status).toBe(400)
  })
})
