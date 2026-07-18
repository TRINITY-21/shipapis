// Gate + hygiene for everything under /admin.
//
// Three jobs, all of which must happen before any handler runs:
//  1. Fail CLOSED when ADMIN_PASSWORD is unbound. An admin console that falls open because a secret
//     is missing is worse than one that's unreachable. It fails as a plain 404 — byte-identical to
//     any other unknown URL — so an unconfigured deployment doesn't advertise that a console exists
//     here at all, let alone that it's mid-setup and worth coming back to.
//  2. Verify the signed session cookie, else bounce to /admin/login.
//  3. Force `no-store, private`. app.ts edge-caches any 200 that doesn't set Cache-Control
//     (s-maxage=120) — without this, subscriber emails would sit in Cloudflare's shared cache.

import type { Context, MiddlewareHandler } from 'hono'
import { SESSION_COOKIE, readCookie, verifySession } from '../lib/admin-session'
import { NotFound } from '../ui/pages/NotFound'
import type { Env } from '../workers/env'

/** Admin responses must never be cached, by the edge or the browser. */
export function noStore(headers: Headers) {
  headers.set('Cache-Control', 'no-store, private, max-age=0, must-revalidate')
  // Belt and braces: admin HTML must not be indexed even if a URL leaks into a crawler's frontier.
  headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
}

/** Applies to /admin/* — including /admin/login, which needs the cache + header hygiene but not the gate. */
export const adminHygiene: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  await next()
  noStore(c.res.headers)
}

/**
 * The response an unconfigured console gives: the site's ordinary 404, with nothing in the status,
 * body or headers that distinguishes /admin from a typo. Never replace this with a message that
 * names ADMIN_PASSWORD — that tells a stranger exactly what's missing and to check back later.
 */
export function notHere(c: Context<{ Bindings: Env }>) {
  return c.html(<NotFound />, 404)
}

export const requireAdmin: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const password = c.env.ADMIN_PASSWORD
  if (!password) return notHere(c)
  const token = readCookie(c.req.header('Cookie'), SESSION_COOKIE)
  if (!(await verifySession(password, token))) {
    // Round-trip the intended destination so login lands you where you were headed.
    const path = new URL(c.req.url).pathname
    const next = path && path !== '/admin' ? `?next=${encodeURIComponent(path)}` : ''
    return c.redirect(`/admin/login${next}`, 302)
  }
  await next()
}

/**
 * Best-effort brute-force throttle, per isolate. Workers spread requests across isolates so this is
 * not a hard global limit — it's a speed bump that makes online guessing impractical without adding
 * a D1 write (and a self-inflicted DoS vector) to every login attempt. The real strength is the
 * password itself; pick a long one.
 */
const attempts = new Map<string, { n: number; until: number }>()
const MAX_ATTEMPTS = 8
const LOCKOUT_MS = 10 * 60 * 1000

export function throttleCheck(ip: string, now = Date.now()): { allowed: boolean; retryInMin: number } {
  const rec = attempts.get(ip)
  if (!rec) return { allowed: true, retryInMin: 0 }
  if (now > rec.until) {
    attempts.delete(ip)
    return { allowed: true, retryInMin: 0 }
  }
  if (rec.n < MAX_ATTEMPTS) return { allowed: true, retryInMin: 0 }
  return { allowed: false, retryInMin: Math.ceil((rec.until - now) / 60_000) }
}

export function recordFailure(ip: string, now = Date.now()) {
  const rec = attempts.get(ip)
  if (rec && now <= rec.until) rec.n += 1
  else attempts.set(ip, { n: 1, until: now + LOCKOUT_MS })
}

export function clearFailures(ip: string) {
  attempts.delete(ip)
}

/** Test seam — the throttle is isolate-global, so suites that exercise it need a reset. */
export function resetThrottle() {
  attempts.clear()
}
