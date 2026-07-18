import { afterEach, describe, expect, it, vi } from 'vitest'
import { sendSubmissionApproved, sendSubmissionReceived } from '../../src/lib/submission-email'

const KEY = { RESEND_API_KEY: 'test-key' }

/** Capture the JSON body Resend would receive, without touching the network. */
function stubFetch(ok = true) {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = []
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init.body)) })
    return new Response('{}', { status: ok ? 200 : 422 })
  })
  return calls
}

afterEach(() => vi.unstubAllGlobals())

describe('submission emails', () => {
  it('no-ops without a Resend key instead of throwing (local/tests)', async () => {
    const calls = stubFetch()
    expect(await sendSubmissionReceived({}, 'a@b.co', { name: 'X', endpointUrl: 'u', docsUrl: 'd' })).toBe(false)
    expect(await sendSubmissionApproved({}, 'a@b.co', { name: 'X', slug: 'x', category: 'Fun' })).toBe(false)
    expect(calls).toHaveLength(0)
  })

  it('reports failure rather than throwing when Resend rejects', async () => {
    stubFetch(false)
    expect(await sendSubmissionApproved(KEY, 'a@b.co', { name: 'X', slug: 'x', category: 'Fun' })).toBe(false)
  })

  it('survives a network error — email must never break the approval it announces', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('socket hang up')
    })
    expect(await sendSubmissionApproved(KEY, 'a@b.co', { name: 'X', slug: 'x', category: 'Fun' })).toBe(false)
  })

  it('sends the received notice with both html and text parts', async () => {
    const calls = stubFetch()
    const ok = await sendSubmissionReceived(KEY, 'dev@example.com', {
      name: 'Dog CEO',
      endpointUrl: 'https://dog.ceo/api/breeds/image/random',
      docsUrl: 'https://dog.ceo/dog-api/documentation',
    })
    expect(ok).toBe(true)
    expect(calls).toHaveLength(1)
    const b = calls[0].body
    expect(calls[0].url).toBe('https://api.resend.com/emails')
    expect(b.to).toEqual(['dev@example.com'])
    expect(b.subject).toContain('Dog CEO')
    // A text/plain alternative keeps it out of spam folders and readable in plain-text clients.
    expect(String(b.text)).toContain('https://dog.ceo/api/breeds/image/random')
    expect(String(b.html)).toContain('Dog CEO')
  })

  it('sends the approval notice with the live listing URL and no fabricated score', async () => {
    const calls = stubFetch()
    await sendSubmissionApproved(KEY, 'dev@example.com', { name: 'Sunrise Sunset', slug: 'sunrise-sunset', category: 'Weather' })
    const b = calls[0].body
    expect(String(b.html)).toContain('https://shipapis.dev/api/sunrise-sunset')
    expect(String(b.text)).toContain('https://shipapis.dev/api/sunrise-sunset')
    // The listing has no health data yet; the email must say so rather than imply a score.
    expect(String(b.text)).toContain('Not scored yet')
  })

  it('escapes submitter-controlled text — the API name is untrusted input', async () => {
    const calls = stubFetch()
    await sendSubmissionApproved(KEY, 'dev@example.com', {
      name: '<img src=x onerror=alert(1)>',
      slug: 'x',
      category: 'Fun',
    })
    const html = String(calls[0].body.html)
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img src=x')
  })

  it('sends from the verified shipapis.dev domain', async () => {
    const calls = stubFetch()
    await sendSubmissionApproved(KEY, 'a@b.co', { name: 'X', slug: 'x', category: 'Fun' })
    expect(String(calls[0].body.from)).toContain('@shipapis.dev')
  })
})
