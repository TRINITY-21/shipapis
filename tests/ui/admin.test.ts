import { beforeEach, describe, expect, it } from 'vitest'
import { app } from '../../src/app'
import { clearCookie, issueSession, readCookie, sessionCookie, timingSafeEqual, verifySession } from '../../src/lib/admin-session'
import { resetThrottle } from '../../src/middleware/admin-auth'

const PASSWORD = 'correct-horse-battery-staple'

/** The console needs no D1 for the auth surface; pages that read data 503 without it, by design. */
const env = (over: Record<string, unknown> = {}) => ({ ADMIN_PASSWORD: PASSWORD, ...over }) as never

const get = (path: string, opts: { cookie?: string; env?: Record<string, unknown> } = {}) =>
  app.fetch(
    new Request(`https://shipapis.dev${path}`, { headers: opts.cookie ? { Cookie: opts.cookie } : {} }),
    env(opts.env),
  )

const postForm = (path: string, body: Record<string, string>, opts: { cookie?: string; env?: Record<string, unknown> } = {}) =>
  app.fetch(
    new Request(`https://shipapis.dev${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(opts.cookie ? { Cookie: opts.cookie } : {}),
      },
      body: new URLSearchParams(body).toString(),
    }),
    env(opts.env),
  )

/** Sign in and return the session cookie value, ready to pass back as a Cookie header. */
async function signIn(): Promise<string> {
  const res = await postForm('/admin/login', { password: PASSWORD })
  const setCookie = res.headers.get('Set-Cookie') ?? ''
  return setCookie.split(';')[0]
}

beforeEach(() => resetThrottle())

describe('admin session tokens', () => {
  it('round-trips a valid session', async () => {
    const token = await issueSession(PASSWORD)
    expect(await verifySession(PASSWORD, token)).toBe(true)
  })

  it('rejects a token signed with a different password (rotation kills sessions)', async () => {
    const token = await issueSession(PASSWORD)
    expect(await verifySession('some-other-password', token)).toBe(false)
  })

  it('rejects an expired token even though the signature is valid', async () => {
    const token = await issueSession(PASSWORD, Date.now() - 48 * 60 * 60 * 1000)
    expect(await verifySession(PASSWORD, token)).toBe(false)
  })

  it('rejects a tampered expiry — the signature covers it', async () => {
    const token = await issueSession(PASSWORD)
    const forged = `${Date.now() + 10 ** 9}.${token.split('.')[1]}`
    expect(await verifySession(PASSWORD, forged)).toBe(false)
  })

  it('rejects garbage and empty tokens', async () => {
    for (const t of ['', 'x', 'abc.def', '.', undefined]) {
      expect(await verifySession(PASSWORD, t)).toBe(false)
    }
  })

  it('compares in constant time without changing semantics', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true)
    expect(timingSafeEqual('abc', 'abd')).toBe(false)
    expect(timingSafeEqual('abc', 'abcd')).toBe(false)
    expect(timingSafeEqual('', '')).toBe(true)
  })

  it('sets a hardened cookie and drops Secure only for plain-http local dev', () => {
    const secure = sessionCookie('t', true)
    expect(secure).toContain('HttpOnly')
    expect(secure).toContain('SameSite=Strict')
    expect(secure).toContain('Secure')
    expect(sessionCookie('t', false)).not.toContain('Secure')
    expect(clearCookie(true)).toContain('Max-Age=0')
  })

  it('parses one cookie out of a crowded header', () => {
    expect(readCookie('a=1; shipapis_admin=tok; b=2', 'shipapis_admin')).toBe('tok')
    expect(readCookie('a=1', 'shipapis_admin')).toBeUndefined()
    expect(readCookie(undefined, 'shipapis_admin')).toBeUndefined()
  })
})

describe('admin gate', () => {
  it('fails CLOSED when ADMIN_PASSWORD is unset, as an ordinary 404 that admits nothing', async () => {
    for (const path of ['/admin', '/admin/login', '/admin/submissions', '/admin/subscribers', '/admin/catalog']) {
      const res = await app.fetch(new Request(`https://shipapis.dev${path}`), {} as never)
      expect(res.status, path).toBe(404)
      const body = await res.text()
      // Nothing may hint that a console lives here or that a secret is merely missing.
      expect(body, path).not.toContain('ADMIN_PASSWORD')
      expect(body, path).not.toContain('not configured')
      expect(body.toLowerCase(), path).not.toContain('admin console')
    }
  })

  it('404s an unconfigured console identically to a genuinely unknown URL', async () => {
    const admin = await app.fetch(new Request('https://shipapis.dev/admin'), {} as never)
    const bogus = await app.fetch(new Request('https://shipapis.dev/definitely-not-a-page'), {} as never)
    expect(admin.status).toBe(bogus.status)
    // Same rendered page — no length, wording or header tell to distinguish them.
    expect(await admin.text()).toBe(await bogus.text())
  })

  it('redirects an anonymous visitor to login, preserving the destination', async () => {
    const res = await get('/admin/subscribers')
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/admin/login?next=%2Fadmin%2Fsubscribers')
  })

  it('never serves admin data to a forged cookie', async () => {
    const res = await get('/admin/subscribers', { cookie: 'shipapis_admin=9999999999999.deadbeef' })
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toContain('/admin/login')
  })

  it('rejects a wrong password without revealing which part was wrong', async () => {
    const res = await postForm('/admin/login', { password: 'nope' })
    expect(res.status).toBe(401)
    const body = await res.text()
    expect(body).toContain('Incorrect password.')
    expect(res.headers.get('Set-Cookie')).toBeNull()
  })

  it('issues a session on the right password and lets it through', async () => {
    const cookie = await signIn()
    expect(cookie).toContain('shipapis_admin=')
    const res = await get('/admin', { cookie })
    // With no DB binding the page 503s — but it got PAST the gate, which is what this asserts.
    expect(res.status).toBe(503)
    expect(res.headers.get('location')).toBeNull()
  })

  it('throttles repeated failures from one IP', async () => {
    const attempt = () =>
      app.fetch(
        new Request('https://shipapis.dev/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'CF-Connecting-IP': '203.0.113.9' },
          body: new URLSearchParams({ password: 'wrong' }).toString(),
        }),
        env(),
      )
    let last = await attempt()
    for (let i = 0; i < 10; i++) last = await attempt()
    expect(last.status).toBe(429)
    expect(await last.text()).toContain('Too many attempts')
  })

  it('refuses an off-site next= redirect after login (no open redirect)', async () => {
    const res = await postForm('/admin/login', { password: PASSWORD, next: 'https://evil.example/pwn' })
    expect(res.headers.get('location')).toBe('/admin')
  })

  it('omits Secure under LOCAL_DEV so the cookie survives http://localhost', async () => {
    // `wrangler dev` reports the request URL as https://shipapis.dev even on plain-http localhost,
    // so deriving Secure from the URL silently breaks every local login. LOCAL_DEV is the signal.
    const res = await postForm('/admin/login', { password: PASSWORD }, { env: { LOCAL_DEV: '1' } })
    expect(res.headers.get('Set-Cookie')).not.toContain('Secure')
  })

  it('sets Secure in production, where LOCAL_DEV is absent', async () => {
    const res = await postForm('/admin/login', { password: PASSWORD })
    expect(res.headers.get('Set-Cookie')).toContain('Secure')
  })

  it('clears the cookie on logout', async () => {
    const res = await postForm('/admin/logout', {}, { cookie: await signIn() })
    expect(res.headers.get('Set-Cookie')).toContain('Max-Age=0')
    expect(res.headers.get('location')).toBe('/admin/login')
  })
})

describe('admin pages stay out of analytics, caches and search', () => {
  it('emits no beacon, no GA4 and no tracking of any kind on the login page', async () => {
    const html = await (await get('/admin/login')).text()
    expect(html).not.toContain('cloudflareinsights')
    expect(html).not.toContain('googletagmanager')
    expect(html).not.toContain('gtag')
    expect(html).not.toContain('data-cf-beacon')
  })

  it('marks admin responses noindex and never-cache', async () => {
    const res = await get('/admin/login')
    expect(res.headers.get('Cache-Control')).toContain('no-store')
    expect(res.headers.get('Cache-Control')).toContain('private')
    expect(res.headers.get('X-Robots-Tag')).toContain('noindex')
    const html = await res.text()
    expect(html).toContain('noindex, nofollow, noarchive, nosnippet')
  })

  it('does not let the edge-cache middleware overwrite no-store', async () => {
    // app.ts sets s-maxage=120 on any uncached 200 — subscriber emails must never land in a shared cache.
    const res = await get('/admin/login')
    expect(res.headers.get('Cache-Control')).not.toContain('s-maxage')
  })

  it('disallows /admin in robots.txt', async () => {
    const txt = await (await app.fetch(new Request('https://shipapis.dev/robots.txt'), {} as never)).text()
    expect(txt).toContain('Disallow: /admin')
  })

  it('keeps admin URLs out of the sitemap', async () => {
    const xml = await (await app.fetch(new Request('https://shipapis.dev/sitemap.xml'), {} as never)).text()
    // Substring-matching '/admin' would false-positive on /api/administrative-divisions-db, so
    // match the actual URL boundary instead.
    expect(xml).not.toMatch(/<loc>https:\/\/shipapis\.dev\/admin(\/|<)/)
  })
})
